'use strict';

const AWS = require('aws-sdk'),
    https = require('https'),
    util = require('util'),
    zlib = require('zlib'),
    LogEventParser = require('scrivito-log-event-parser');

exports.handler = function (event, context, callback) {
  function postEventsToLoggly(token, parsedEvents) {
    // Join all events for sending via bulk endpoint.
    var finalEvent = parsedEvents.map(JSON.stringify).join('\n');

    var options = {
      hostname: process.env.logglyHostName,
      path: '/bulk/' + token + '/tag/' + encodeURIComponent(process.env.logglyTags),
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Content-Length': finalEvent.length},
    };

    return new Promise((resolve, reject) => {
      console.log(`Sending ${parsedEvents.length} events to loggly.`);
      var req = https.request(options, function (res) {
        console.log(`Loggly response status code: ${res.statusCode}`)
        res.on('data', function (chunk) {
          console.log(`Loggly responded: ${chunk}`);
        });
        res.on('end', function () {
          resolve();
        });
      });

      req.write(finalEvent);
      req.end();
    });
  }

  var kms = new AWS.KMS();

  kms.decrypt({
    CiphertextBlob: new Buffer(process.env.kmsEncryptedCustomerToken, 'base64')
  }).promise().then((data) => {
    var token = data.Plaintext.toString('ascii');
    var payload = new Buffer(event.awslogs.data, 'base64');
    var rawPayload = zlib.gunzipSync(payload).toString('ascii');
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
