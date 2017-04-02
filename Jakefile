const $ = require('procstreams');
const Tempy = require('tempy');
const Path = require('path');

desc('Creates a package for upload to AWS');
task('package', {async: true}, function () {
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
        resolve(packageFileName);
      });
    });
  }).then((file) => {
    console.log(`Package created in ${file}`);
    complete();
  });
});
