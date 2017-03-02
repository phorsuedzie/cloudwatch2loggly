var tty = require('tty');

if (tty.isatty(process.stdout.fd)) {
  const SpecReporter = require('jasmine-spec-reporter').SpecReporter;

  jasmine.getEnv().clearReporters();               // remove default reporter logs
  jasmine.getEnv().addReporter(new SpecReporter({  // add jasmine-spec-reporter
    spec: {
      displayPending: true,
    },
    summary: {
      displayStacktrace: true,
    },
  }));
}
