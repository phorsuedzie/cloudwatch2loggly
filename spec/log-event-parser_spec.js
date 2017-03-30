'use strict';
describe("LogEventParser", () => {
  const LogEventParser = require('scrivito-log-event-parser');

  describe("#parseEvent", () => {
    var timestamp = 1488391343691;
    var groupName = "a groupname";
    var streamName = "a streamname";
    var core_message;
    var message;
    var parseEvent = () => {
      return LogEventParser.parse({
        timestamp: timestamp,
        message: message(),
      }, groupName, streamName);
    };

    beforeEach(() => {
      core_message = "  \n  a message  \n  ";
      message = () => { return core_message; };
    });

    it("contains basic information and the trimmed message", () => {
      expect(parseEvent()).toEqual({
        logGroupName: "a groupname",
        logStreamName: "a streamname",
        timestamp: "2017-03-01T18:02:23.691Z",
        message: "a message",
      });
    });

    sharedExamplesFor("parsing a JSON message", () => {
      beforeEach(() => {
        core_message = '{"this":"is","some":"JSON"}\n';
      });

      it("contains the parsed message content", () => {
        expect(parseEvent()['this']).toEqual("is");
        expect(parseEvent()['some']).toEqual("JSON");
      });
    });

    itBehavesLike("parsing a JSON message");

    sharedExamplesFor("parsing a Rails log line", () => {
      beforeEach(() => {
        core_message = 'I, [2017-03-30T11:56:09.027640 #32] INFO -- : [some] [tags] the message\n';
      });

      it("contains the log level, process ID, tags and the message", () => {
        expect(parseEvent()['log_level']).toEqual("INFO");
        expect(parseEvent()['pid']).toEqual("32");
        expect(parseEvent()['log_tags']).toEqual(['some', 'tags']);
        expect(parseEvent()['message']).toEqual('the message');
      });
    });

    itBehavesLike("parsing a Rails log line");

    describe("for foreman message", () => {
      beforeEach(() => {
        core_message = "here goes the message (anything you want)\n";
        message = () => { return "18:02:23  my_proc.12  |  " + core_message };
      });

      it("contains the foreman process identifier and the core message", () => {
        expect(parseEvent().foreman_process).toEqual('my_proc.12');
        expect(parseEvent().message).toEqual("here goes the message (anything you want)");
      });

      itBehavesLike("parsing a JSON message");
      itBehavesLike("parsing a Rails log line");
    });
  });
});
