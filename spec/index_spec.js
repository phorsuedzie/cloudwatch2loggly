'use strict';

const LambdaTester = require('lambda-tester');
const Aws = require('aws-sdk');
Aws.config.update({region: 'eu-west-1'});
const zlib = require('zlib');
const https = require('https');
const LogEventParser = require('scrivito-log-event-parser');

describe("cloudwatch2loggly", () => {
  var CloudWatch2Loggly = require('../index');

  var event;
  var handleEvent = () => { return LambdaTester(CloudWatch2Loggly.handler).event(event); };
  var buildEvent = (e) => {
    return {"awslogs": {"data": zlib.gzipSync(JSON.stringify(e)).toString("base64")}};
  };

  beforeEach(() => {
    process.env.kmsEncryptedCustomerToken = "Zm9v";
    process.env.logglyHostName = "the loggly host";
    process.env.logglyTags = "the loggly tags";

    event = buildEvent({
      logEvents: ["event 1", "event 2", "event 3"],
      logGroup: "log group",
      logStream: "log stream",
    });

    this.decryptResult = {promise: () => { return Promise.resolve({Plaintext: "token"}); }};
    this.kms = {decrypt: () => { return this.decryptResult; }};
    this.kmsSpy = spyOn(Aws, 'KMS').and.returnValue(this.kms);

    this.parseSpy = spyOn(LogEventParser, 'parse').and.returnValue("parsed event");

    this.request = {
      on: () => {},
      write: () => {},
      end: () => { this.request.onEnd(); },
    };
    this.requestSpy = spyOn(https, 'request').and.callFake((options, responseHandler) => {
      var res = {on: (key, callback) => { res[key] = callback; }};
      responseHandler(res);
      this.request.onEnd = () => { res['end'](); };
      return this.request;
    });

    this.logSpy = spyOn(console, 'log');
  });

  it("decrypts the Loggly API token", (done) => {
    var decryptSpy = spyOn(this.kms, 'decrypt').and.returnValue(this.decryptResult);
    handleEvent().expectResult(() => {
      expect(decryptSpy).toHaveBeenCalledWith({CiphertextBlob: new Buffer("Zm9v", 'base64')});
    }).verify(done);
  });

  it("parses the events using the LogEventParser", (done) => {
    handleEvent().expectResult(() => {
      expect(this.parseSpy).toHaveBeenCalledWith("event 1", "log group", "log stream");
      expect(this.parseSpy).toHaveBeenCalledWith("event 2", "log group", "log stream");
      expect(this.parseSpy).toHaveBeenCalledWith("event 3", "log group", "log stream");
    }).verify(done);
  });

  it("transfers the events to Loggly", (done) => {
    var requestWriteSpy = spyOn(this.request, 'write');
    var requestEndSpy = spyOn(this.request, 'end').and.callThrough();
    handleEvent().expectResult(() => {
      expect(this.requestSpy).toHaveBeenCalled();
      var requestOptions = this.requestSpy.calls.argsFor(0)[0];
      expect(requestOptions.hostname).toEqual("the loggly host");
      expect(requestOptions.path).toEqual('/bulk/token/tag/the%20loggly%20tags');
      expect(requestOptions.method).toEqual('POST');
      expect(requestOptions.headers)
          .toEqual({"Content-Type": 'application/json', "Content-Length": 44});

      expect(requestWriteSpy)
          .toHaveBeenCalledWith('"parsed event"\n"parsed event"\n"parsed event"');

      expect(requestEndSpy).toHaveBeenCalled();
    }).verify(done);
  });

  describe("when JSON parsing fails", () => {
    beforeEach(() => {
      event = {
        "awslogs": {
          "data": zlib.gzipSync("this ain't json").toString("base64")
        }
      };
    });

    it("logs details and fails with the occurred error", (done) => {
      handleEvent().expectError((error) => {
        expect(error).toEqual(SyntaxError('Unexpected token h in JSON at position 1'));
        expect(this.logSpy)
            .toHaveBeenCalledWith("Error while parsing json. Input: this ain't json");
      }).verify(done);
    });
  });
});
