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

exports.handler = function (event, context, callback) {
  var kms = new AWS.KMS();

  kms.decrypt({
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
  }).then(() => { callback(); }).catch((error) => { callback(error); });
};
