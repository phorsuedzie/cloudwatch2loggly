'use strict';

const LambdaTester = require('lambda-tester');
const Aws = require('aws-sdk');
Aws.config.update({region: 'eu-west-1'});
const zlib = require('zlib');
const http = require('http');
const LogEventParser = require('scrivito-log-event-parser');

describe("cloudwatch2loggly", () => {
  var CloudWatch2Loggly;

  var event;
  var handleEvent = () => { return LambdaTester(CloudWatch2Loggly.handler).event(event); };
  var buildEvent = (e) => {
    return {"awslogs": {"data": zlib.gzipSync(JSON.stringify(e)).toString("base64")}};
  };

  beforeEach(() => {
    process.env.kmsEncryptedCustomerToken = "Zm9v";

    event = buildEvent({
      logEvents: ["event 1", "event 2", "event 3"],
      logGroup: "log group",
      logStream: "log stream",
    });
    this.decryptResult = {Plaintext: "token"};
    this.kms = {decrypt: (params, callback) => { callback(null, this.decryptResult); }};
    this.kmsSpy = spyOn(Aws, 'KMS').and.returnValue(this.kms);

    this.parseSpy = spyOn(LogEventParser, 'parse').and.returnValue("parsed event");

    spyOn(http, 'request').and.callFake((options, responseHandler) => {
      var res = {on: (key, callback) => { res[key] = callback; }};
      responseHandler(res);
      res['end']();
    });
  });

  it("decrypts the Loggly API token", (done) => {
    var decryptSpy = spyOn(this.kms, 'decrypt').and.callFake((params, callback) => {
      expect(params).toEqual({CiphertextBlob: new Buffer("Zm9v", 'base64')});
      callback(null, this.decryptResult);
    });
    // tempoarily, to complete functional tests before refactoring
    CloudWatch2Loggly = require('../index');
    handleEvent().expectResult(() => {
      expect(decryptSpy).toHaveBeenCalled();
    }).verify(done);
  });

  it("parses the events using the LogEventParser", (done) => {
    handleEvent().expectResult(() => {
      expect(this.parseSpy).toHaveBeenCalledWith("event 1", "log group", "log stream");
      expect(this.parseSpy).toHaveBeenCalledWith("event 2", "log group", "log stream");
      expect(this.parseSpy).toHaveBeenCalledWith("event 3", "log group", "log stream");
    }).verify(done);
  });
});
