'use strict';

const AWS = require('aws-sdk');
const https = require('https');
const util = require('util');
const zlib = require('zlib');
const LogEventParser = require('scrivito-log-event-parser');
const S3LogParser = require('s3-log-parser');

var postEventsToLoggly = function(token, tag, parsedEvents) {
  // Join all events for sending via bulk endpoint.
  var finalEvent = parsedEvents.map(JSON.stringify).join('\n');

  var options = {
    hostname: process.env.logglyHostName,
    path: '/bulk/' + token + '/tag/' + encodeURIComponent(tag),
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
  console.log("Processing CloudWatchLogs event...");
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

    return postEventsToLoggly(token, process.env.logglyTags, parsedEvents);
  });
};

var processS3Event = function(event) {
  console.log("Processing S3 event...");
  var s3 = new AWS.S3();

  return Promise.all(event.Records.map((record) => {
    var Bucket = record.s3.bucket.name;
    var Key = record.s3.object.key;
    var readData = s3.getObject({Bucket, Key}).promise().then((s3obj) => { return s3obj.Body; });
    var readBucketTags = s3.getBucketTagging({Bucket}).promise().then((data) => {
      var tags = {};
      data.TagSet.forEach((tag) => { tags[tag.Key] = tag.Value; });
      return tags;
    });

    if (Key.endsWith(".gz")) {
      readData = readData.then((compressedData) => { return zlib.gunzipSync(compressedData); });
    }

    console.log(`Processing record for object ${Key} in bucket ${Bucket}...`);
    return Promise.all([
      readData.then((data) => { return S3LogParser.parse(data.toString()); }),
      readBucketTags,
    ]).then((results) => {
      var parsedEvents = results[0];
      var bucketTags = results[1];
      var token = bucketTags['loggly-customer-token'];
      var tag = bucketTags['loggly-tag'];
      return postEventsToLoggly(token, tag, parsedEvents);
    });
  }));
};

exports.handler = function (event, context, callback) {
  var processingPromise;

  if (event.awslogs) {
    processingPromise = processCloudWatchLogsEvent(event);
  } else if (event.Records) {
    processingPromise = processS3Event(event);
  } else {
    throw `Unexpected event: ${util.inspect(event)}`;
  }

  processingPromise.then(() => { callback(); }).catch((error) => { callback(error); });
};
