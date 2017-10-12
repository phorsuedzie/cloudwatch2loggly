[![Build Status](https://travis-ci.org/infopark/cloudwatch2loggly.svg?branch=master)](https://travis-ci.org/infopark/cloudwatch2loggly)

# Dev setup
- `brew install npm`
- `brew install n`   # the node version manager
- `sudo n 6.10`      # use a static (old, LTS, AWS compatible) node version
- `npm install`
- `npm test`         # or ...
- `node_modules/.bin/jasmine` # For the unlucky ones ...

# Deployment

The deployment uses https://github.com/toaster/lambda-jakefile.
The target lambda function names are configured in `deploy.json`.
Deployment is as easy as:

```
AWS_PROFILE=prod jake deploy
```
