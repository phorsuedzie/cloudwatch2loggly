'use strict';

var AWS = require('aws-sdk'),
    https = require('https'),
    util = require('util'),
    zlib = require('zlib'),
    LogEventParser = require('scrivito-log-event-parser');

// loggly url, token and tag configuration
// user need to edit while uploading code via blueprint
var logglyConfiguration = {
  hostName: process.env.logglyHostName,
  tags: process.env.logglyTags
};

// use KMS to decrypt customer token
var decryptParams = {CiphertextBlob: new Buffer(process.env.kmsEncryptedCustomerToken, 'base64')};

var kms = new AWS.KMS({apiVersion: '2014-11-01'});

kms.decrypt(decryptParams, function (error, data) {
  if (error) {
    logglyConfiguration.tokenInitError = error;
    console.log(error);
  } else {
    logglyConfiguration.customerToken = data.Plaintext.toString('ascii');
  }
});

// entry point
exports.handler = function (event, context, callback) {
  // joins all the events to a single event
  // and sends to Loggly using bulk endpoint
  function postEventsToLoggly(parsedEvents) {
    if (!logglyConfiguration.customerToken) {
      if (logglyConfiguration.tokenInitError) {
        console.log('error in decrypt the token. Not retrying.');
        return callback(logglyConfiguration.tokenInitError);
      }
      console.log('Cannot flush logs since authentication token has not been initialized yet. Trying again in 100 ms.');
      setTimeout(function () { postEventsToLoggly(parsedEvents) }, 100);
      return;
    }

    // get all the events, stringify them and join them
    // with the new line character which can be sent to Loggly
    // via bulk endpoint
    const finalEvent = parsedEvents.map(JSON.stringify).join('\n');

    // creating logglyURL at runtime, so that user can change the tag or customer token in the go
    // by modifying the current script
    // create request options to send logs
    try {
      const options = {
        hostname: logglyConfiguration.hostName,
        path: '/bulk/' + logglyConfiguration.customerToken + '/tag/' + encodeURIComponent(logglyConfiguration.tags),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': finalEvent.length
        }
      };

      const req = https.request(options, function (res) {
        res.on('data', function (result) {
          result = JSON.parse(result.toString());
          if (result.response === 'ok') {
            callback(null, 'all events are sent to Loggly');
          } else {
            console.log(result.response);
          }
        });
        res.on('end', function () {
          console.log('No more data in response.');
          callback();
        });
      });

      req.on('error', function (e) {
        console.log('problem with request: ' + e.toString());
        callback(e);
      });

      // write data to request body
      req.write(finalEvent);
      req.end();
    } catch (ex) {
      console.log(ex.message);
      callback(ex.message);
    }
  }

  const payload = new Buffer(event.awslogs.data, 'base64');

  zlib.gunzip(payload, function (error, result) {
    if (error) {
      callback(error);
    } else {
      var result_parsed = JSON.parse(result.toString('ascii'));
      var parsedEvents = result_parsed.logEvents.map(function(logEvent) {
        return LogEventParser.parse(logEvent, result_parsed.logGroup, result_parsed.logStream);
      });

      postEventsToLoggly(parsedEvents);
    }
  });
};
