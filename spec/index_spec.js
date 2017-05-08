'use strict';

const LambdaTester = require('lambda-tester');
const Aws = require('aws-sdk');
Aws.config.update({region: 'eu-west-1'});
const zlib = require('zlib');
const https = require('https');
const LogEventParser = require('scrivito-log-event-parser');
const S3LogParser = require('s3-log-parser');

describe("cloudwatch2loggly", () => {
  var CloudWatch2Loggly = require('../index');
  var event;
  var handleEvent = () => { return LambdaTester(CloudWatch2Loggly.handler).event(event); };

  beforeEach(() => {
    process.env.kmsEncryptedCustomerToken = "Zm9v";
    process.env.logglyHostName = "the loggly host";
    process.env.logglyTags = "the loggly tags";

    this.decryptResult = {promise: () => { return Promise.resolve({Plaintext: "token"}); }};
    this.kms = {decrypt: () => { return this.decryptResult; }};
    this.kmsSpy = spyOn(Aws, 'KMS').and.returnValue(this.kms);

    this.request = {
      on: () => {},
      write: () => {},
      end: () => { this.request.onEnd(); },
      setTimeout: () => {},
    };
    this.requestSpy = spyOn(https, 'request').and.callFake((options, responseHandler) => {
      var res = {on: (key, callback) => { res[key] = callback; }};
      responseHandler(res);
      this.request.onEnd = () => { res.end(); };
      return this.request;
    });

    this.logSpy = spyOn(console, 'log');
  });

  sharedExamplesFor("logging the Loggly response", () => {
    it("logs the Loggly response", (done) => {
      this.requestSpy.and.callFake((options, responseHandler) => {
        var res = {on: (key, callback) => { res[key] = callback; }};
        res.statusCode = 200;
        responseHandler(res);
        this.request.onEnd = () => {
          res.data("part one");
          res.data("part two");
          res.end();
        };
        return this.request;
      });

      handleEvent().expectResult(() => {
        expect(this.logSpy).toHaveBeenCalledWith("Loggly response status code: 200");
        expect(this.logSpy).toHaveBeenCalledWith("Loggly responded: part one");
        expect(this.logSpy).toHaveBeenCalledWith("Loggly responded: part two");
      }).verify(done);
    });
  });

  // This sounds wrong but is what has been observed:
  // Loggly returns an OK result but the response's “end” callback is not being called within the
  // lambda's timeout. The request timeout isn't triggered either.
  sharedExamplesFor("handling not properly ended response", () => {
    beforeEach(() => {
      this.requestSpy.and.callFake((options, responseHandler) => {
        var res = {on: (key, callback) => { res[key] = callback; }};
        responseHandler(res);
        this.request.onEnd = () => { res.data('{"response": "ok"}'); };
        return this.request;
      });
    });

    it("succeeds nevertheless", (done) => { handleEvent().expectResult().verify(done); });

    describe("when a response chunk is not JSON", () => {
      beforeEach(() => {
        this.requestSpy.and.callFake((options, responseHandler) => {
          var res = {on: (key, callback) => { res[key] = callback; }};
          responseHandler(res);
          this.request.onEnd = () => {
            res.data("this ain't JSON");
            res.data('{"response": "ok"}');
          };
          return this.request;
        });
      });

      it("succeeds nevertheless", (done) => { handleEvent().expectResult().verify(done); });
    });
  });

  sharedExamplesFor("handling failed request", () => {
    beforeEach(() => {
      this.requestSpy.and.callFake((options, responseHandler) => {
        var res = {on: (key, callback) => { res[key] = callback; }};
        responseHandler(res);
        this.request.onEnd = () => { throw "failure"; };
        return this.request;
      });
    });

    it("fails with the occurred error", (done) => {
      handleEvent().expectError((error) => {
        expect(error).toEqual(Error("failure"));
      }).verify(done);
    });
  });

  describe("with CloudWatchLogs source", () => {
    var buildEvent = (e) => {
      return {"awslogs": {"data": zlib.gzipSync(JSON.stringify(e)).toString("base64")}};
    };

    beforeEach(() => {
      event = buildEvent({
        logEvents: ["event 1", "event 2", "event 3"],
        logGroup: "log group",
        logStream: "log stream",
      });

      this.parseSpy = spyOn(LogEventParser, 'parse').and.returnValue("parsed event");
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

    itBehavesLike("logging the Loggly response");
    itBehavesLike("handling not properly ended response");
    itBehavesLike("handling failed request");

    describe("when log event contains UTF-8", () => {
      beforeEach(() => {
        this.parseSpy.and.callFake((input) => { return `parsed ${input}`; });
        event = buildEvent({
          logEvents: ["€vent", "üvent", "evenд"],
          logGroup: "log group",
          logStream: "log stream",
        });
      });

      it("transfers the events to Loggly", (done) => {
        var requestWriteSpy = spyOn(this.request, 'write');
        var requestEndSpy = spyOn(this.request, 'end').and.callThrough();
        handleEvent().expectResult(() => {
          expect(this.requestSpy).toHaveBeenCalled();
          expect(requestWriteSpy).
              toHaveBeenCalledWith('"parsed €vent"\n"parsed üvent"\n"parsed evenд"');
          expect(requestEndSpy).toHaveBeenCalled();
        }).verify(done);
      });
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

    describe("when token decryption fails", () => {
      beforeEach(() => { stubAwsServiceCall(this.kms, 'decrypt').setReturnValue(Error('fail')); });

      it("fails with the occurred error", (done) => {
        handleEvent().expectError((error) => {
          expect(error).toEqual(Error("fail"));
        }).verify(done);
      });
    });
  });

  describe("with S3 source", () => {
    var buildEvent = (keySuffix = "") => {
      return {
        Records: [
          {
            s3: {
              bucket: {name: "test bucket"},
              object: {key: `log obj key${keySuffix}`, size: 123},
            },
          },
          {
            s3: {
              bucket: {name: "other test bucket"},
              object: {key: `other log obj key${keySuffix}`, size: 123},
            },
          },
        ],
      };
    };


    beforeEach(() => {
      event = buildEvent();

      var s3 = new Aws.S3();
      spyOn(Aws, 'S3').and.returnValue(s3);
      this.s3DownloadSpy = spyOn(s3, 'getObject').and.returnValues(
        {promise: () => { return Promise.resolve({Body: Buffer.from("s3\ninput\ndata")}); }},
        {promise: () => { return Promise.resolve({Body: "other s3\nother input\nother data"}); }}
      );
      this.s3TagSpy = spyOn(s3, 'getBucketTagging').and.returnValues(
        {promise: () => {
          return Promise.resolve({
            TagSet: [
              {Key: 'loggly-customer-token', Value: "bucket token"},
              {Key: 'loggly-tag', Value: "the bucket tags"},
            ],
          });
        }},
        {promise: () => {
          return Promise.resolve({
            TagSet: [
              {Key: 'loggly-customer-token', Value: "other token"},
              {Key: 'loggly-tag', Value: "the other tags"},
            ],
          });
        }}
      );

      this.parseSpy = spyOn(S3LogParser, 'parse').and.returnValues(
        ["parsed s3", "parsed input", "parsed data"],
        ["parsed other s3", "parsed other input", "parsed other data"]
      );
    });

    it("reads all the log data from S3", (done) => {
      handleEvent().expectResult(() => {
        expect(this.s3DownloadSpy)
            .toHaveBeenCalledWith({Bucket: 'test bucket', Key: 'log obj key'});
        expect(this.s3DownloadSpy).toHaveBeenCalledWith({
            Bucket: 'other test bucket', Key: 'other log obj key'});
      }).verify(done);
    });

    it("parses the events using the S3LogParser", (done) => {
      handleEvent().expectResult(() => {
        expect(this.parseSpy).toHaveBeenCalledWith("s3\ninput\ndata");
        expect(this.parseSpy).toHaveBeenCalledWith("other s3\nother input\nother data");
      }).verify(done);
    });

    it("transfers the events to Loggly", (done) => {
      var requestWriteSpy = spyOn(this.request, 'write');
      var requestEndSpy = spyOn(this.request, 'end').and.callThrough();
      handleEvent().expectResult(() => {
        expect(this.requestSpy).toHaveBeenCalledTimes(2);
        var requestOptions = this.requestSpy.calls.argsFor(0)[0];
        expect(requestOptions.hostname).toEqual("the loggly host");
        expect(requestOptions.path).toEqual('/bulk/bucket token/tag/the%20bucket%20tags');
        expect(requestOptions.method).toEqual('POST');
        expect(requestOptions.headers)
            .toEqual({"Content-Type": 'application/json', "Content-Length": 40});

        requestOptions = this.requestSpy.calls.argsFor(1)[0];
        expect(requestOptions.hostname).toEqual("the loggly host");
        expect(requestOptions.path).toEqual('/bulk/other token/tag/the%20other%20tags');
        expect(requestOptions.method).toEqual('POST');
        expect(requestOptions.headers)
            .toEqual({"Content-Type": 'application/json', "Content-Length": 58});

        expect(requestWriteSpy)
            .toHaveBeenCalledWith('"parsed s3"\n"parsed input"\n"parsed data"');
        expect(requestWriteSpy)
            .toHaveBeenCalledWith('"parsed other s3"\n"parsed other input"\n"parsed other data"');

        expect(requestEndSpy).toHaveBeenCalledTimes(2);
      }).verify(done);
    });

    itBehavesLike("logging the Loggly response");
    itBehavesLike("handling not properly ended response");
    itBehavesLike("handling failed request");

    describe("when S3 object is compressed", () => {
      beforeEach(() => {
        event = buildEvent(".gz");

        this.s3DownloadSpy.and.returnValues(
          {promise: () => { return Promise.resolve({Body: zlib.gzipSync("s3\ninput\ndata")}); }},
          {promise: () => { return Promise.resolve({
            Body: zlib.gzipSync("other s3\nother input\nother data")
          }); }}
        );
      });

      it("parses the uncompressed data", (done) => {
        handleEvent().expectResult(() => {
          expect(this.parseSpy).toHaveBeenCalledWith("s3\ninput\ndata");
          expect(this.parseSpy).toHaveBeenCalledWith("other s3\nother input\nother data");
        }).verify(done);
      });
    });
  });

  describe("with unexpected source", () => {
    var buildEvent = (e) => { return {"some": "event"}; };

    beforeEach(() => { event = buildEvent(); });

    it("fails", (done) => {
      handleEvent().expectError((error) => {
        expect(error).toEqual(Error("Unexpected event: { some: 'event' }"));
      }).verify(done);
    });
  });
});
