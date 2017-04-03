desc('Creates a package for upload to AWS.');
task('package', {async: true}, function () {
  const $ = require('procstreams');
  const Tempy = require('tempy');
  const Path = require('path');

  return new Promise((resolve, reject) => {
    $("git rev-parse HEAD").data((err, stdout, stderr) => {
      if (err) { throw err; }
      resolve(stdout.toString().trim());
    });
  }).then((commit) => {
    return new Promise((resolve, reject) => {
      var packageFileName = `package_${Path.basename(__dirname)}_${commit}.zip`;
      process.chdir(Tempy.directory());
      jake.exec([
        `rsync -a ${__dirname}/.git .`,
        `git reset --hard ${commit}`,
        "npm install --production",
        "zip -r package.zip index.js node_modules",
        `cp package.zip ${__dirname}/${packageFileName}`,
      ], {printStdout: true, printStderr: true}, () => {
        resolve({commit, packageFileName});
      });
    });
  }).then((result) => {
    console.log(`Package created in ${result.packageFileName}`);
    complete({commit: result.commit, path: `${__dirname}/${result.packageFileName}`});
  });
});

desc("Deploys the package on AWS.");
task('deploy', ['package'], {async: true}, function(functionName) {
  if (!functionName) {
    throw "You have to specify a function name to deploy to.";
  }

  const Aws = require('aws-sdk');
  const fs = require('fs');
  console.log(`Deploying to AWS profile ${Aws.config.credentials.profile}.`);

  var package = jake.Task['package'].value;
  var lambda = new Aws.Lambda({region: 'eu-west-1'});
  lambda.updateFunctionCode({
    FunctionName: functionName,
    ZipFile: fs.readFileSync(package.path),
  }).promise().then(() => {
    return lambda.publishVersion({
      FunctionName: functionName,
      Description: package.commit,
    }).promise();
  }).then((result) => {
    return lambda.updateAlias({
      FunctionName: functionName,
      Name: 'active',
      FunctionVersion: result.Version,
    }).promise();
  })
});
