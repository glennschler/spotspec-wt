/*
* @module AwsSpotter-webtask
*/
const https = require('https');
const Util = require('util');
const vm = require('vm');
const mods = require('module');
const concat = require('concat-stream');

/**
* Proof of concept, require a remote module
* Since webtask.io does not have this Node module in their private npm cache,
* it must be manually loaded at run time. Probably not very efficient.
*/
var remoteRequire = function (callback) {
  var url = 'https://raw.githubusercontent.com/glennschler/aws-spotter-node/master/index.js';

  https.get(url, function(res) {
    res.setEncoding('utf8');
    res.pipe(concat({ encoding: 'string' }, function(remoteSrc) {
      var wrappedSrc = mods.wrap(remoteSrc);
      vm.runInThisContext(wrappedSrc,
        'AwsSpotter.js')(null, require, module, __filename, __dirname);

      var moduleClass = module.exports;
      callback(moduleClass);
    }));
  });
}


// The webtask.io entry-point
module.exports = function(context, cb) {
  var awsCreds = context.data.wtData; // Secure data set during the 'wt create'
  awsCreds = parseJson(awsCreds);

  // These run time execution arguments are sent as JSON postdata
  var runArgs = context.body;

  // EC2 IAM user credentials must exist
  if (!awsCreds || !awsCreds.accessKeyId || !awsCreds.secretAccessKey) {
    return cb(new Error('EC2 secrets are missing'));
  }

  if (typeof runArgs === 'undefined') {
    return cb(new Error('AwsSpotter arguments are missing'));
  }

  logInfo(typeof runArgs, runArgs);

  // The EC2 region is sent at execution time. Merge with the EC2 credentials
  awsCreds.region = !runArgs ? '' : runArgs.region;
  var instanceType = !runArgs ? '' : runArgs.type;

  // Fetch the AwsSpotter module and then make an AwsSpotter method call
  remoteRequire(function (requiredClass) {
    const AwsSpotter = requiredClass;

    var spotter = null;
    try {
      var isLogging = true;
      spotter = new AwsSpotter(awsCreds, isLogging);
    }
    catch (errMsg) {
      returnError('Error instantiating AwsSpotter:', errMsg);
    }

    if (spotter !== null) {
      spotPrices(spotter);
    }
  });

  // called back after the remote module is loaded
  var spotPrices = function (spotter) {
    var priceOpts = {
      type: runArgs.type || 'm3.medium',
      product: runArgs.product || 'Linux/UNIX',
      dryRun: runArgs.dryRun
    };


    // Listen for price history results
    spotter.on('prices', onPrices);

    // Make the price history request
    spotter.spotPrices(priceOpts);
  }

  // fired when the spotPrices request is complete
  var onPrices = function onPrices(pricesData, err) {
    if (pricesData === null) {
      returnError(pricesData);
    }
    else {
      return cb(null, pricesData);
    }
  };

  // wrap the error
  var returnError = function() {
    errMsg = Util.format.apply(this, arguments);
    logInfo('Error:', Util.format.apply(this, arguments));
    return cb(errMsg);
  }
};

// helper to parse json
var parseJson = function(jsonStr) {
  try {
    jsonStr = JSON.parse(jsonStr);
  }
  catch (parseError) {
    jsonStr = null;
  }
  return jsonStr;
}

// wrap for future 3rd party logger
var logInfo = function (message, meta) {
  console.info(message, meta);
}
