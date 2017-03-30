'use strict';

const LambdaTester = require('lambda-tester');
const Aws = require('aws-sdk');
Aws.config.update({region: 'eu-west-1'});
const zlib = require('zlib');
const http = require('http');

describe("cloudwatch2loggly", () => {
  var CloudWatch2Loggly;

  var event;
  var handleEvent = () => { return LambdaTester(CloudWatch2Loggly.handler).event(event); };
  beforeEach(() => {
    event = {
      "awslogs": {
        "data": zlib.gzipSync('{"logEvents":[]}').toString("base64")
      }
    };
    this.decryptResult = {Plaintext: "token"};
    this.kms = {decrypt: (params, callback) => { callback(null, this.decryptResult); }};
    this.kmsSpy = spyOn(Aws, 'KMS').and.returnValue(this.kms);

    // tempoarily, to complete functional tests before refactoring
    process.env.kmsEncryptedCustomerToken = "Zm9v";

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
});
