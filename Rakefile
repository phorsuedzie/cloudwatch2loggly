require 'tmpdir'

desc "Creates a package for upload to AWS"
task :package do
  repo_dir = File.expand_path("..", __FILE__)
  commit = `git rev-parse HEAD`
  Dir.mktmpdir do |dir|
    chdir(dir) do
      sh %!rsync -a #{repo_dir}/.git .!
      sh %!git reset --hard #{commit}!
      sh %!npm install --production!
      sh %!zip -r cloudwatch2loggly.zip index.js node_modules!
      sh %!cp cloudwatch2loggly.zip #{repo_dir}/!
    end
  end
end
