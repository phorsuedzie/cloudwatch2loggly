'use strict';

const AWS = require('aws-sdk'),
    https = require('https'),
    util = require('util'),
    zlib = require('zlib'),
    LogEventParser = require('scrivito-log-event-parser');

var postEventsToLoggly = function(token, parsedEvents) {
  // Join all events for sending via bulk endpoint.
  var finalEvent = parsedEvents.map(JSON.stringify).join('\n');

  var options = {
    hostname: process.env.logglyHostName,
    path: '/bulk/' + token + '/tag/' + encodeURIComponent(process.env.logglyTags),
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'Content-Length': finalEvent.length},
    timeout: 2000,
  };

  return new Promise((resolve, reject) => {
    console.log(`Sending ${parsedEvents.length} events to loggly.`);

    var perform = () => {
      var req = https.request(options, function (res) {
        console.log(`Loggly response status code: ${res.statusCode}`)
        res.on('data', function (chunk) {
          console.log(`Loggly responded: ${chunk}`);
          try {
            if (JSON.parse(chunk).response === "ok") {
              resolve();
            }
          } catch(e) {}
        });
        res.on('end', function () { resolve(); });
      });

      req.setTimeout(9900, () => {
        console.log("Request to Loggly timed out. Retrying...");
        perform();
      });

      req.write(finalEvent);
      req.end();
    };

    perform();
  });
};

var processCloudWatchLogsEvent = function(event) {
  var kms = new AWS.KMS();

  return kms.decrypt({
    CiphertextBlob: new Buffer(process.env.kmsEncryptedCustomerToken, 'base64')
  }).promise().then((data) => {
    var token = data.Plaintext.toString('ascii');
    var payload = new Buffer(event.awslogs.data, 'base64');
    var rawPayload = zlib.gunzipSync(payload).toString();
    var parsedPayload;
    try {
      parsedPayload = JSON.parse(rawPayload);
    } catch(e) {
      console.log("Error while parsing json. Input: " + rawPayload);
      throw e;
    }
    var parsedEvents = parsedPayload.logEvents.map(function(logEvent) {
      return LogEventParser.parse(logEvent, parsedPayload.logGroup, parsedPayload.logStream);
    });

    return postEventsToLoggly(token, parsedEvents);
  });
};

exports.handler = function (event, context, callback) {
  var processingPromise;

  if (event.awslogs) {
    processingPromise = processCloudWatchLogsEvent(event);
  } else if (event.Records) {
    var s3 = new AWS.S3();

    processingPromise = Promise.all(event.Records.map((record) => {
      return s3.getObject({Bucket: record.s3.bucket.name, Key: record.s3.object.key}).promise();
    }));
  } else {
    throw `Unexpected event: ${util.inspect(event)}`;
  }

  processingPromise.then(() => { callback(); }).catch((error) => { callback(error); });
};
