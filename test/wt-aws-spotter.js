/*
* @module AwsSpotter
*/
var AWS = require('aws-sdk');
var EventEmitter = require('events').EventEmitter;
var EvUtil = require('util');

// The webtask.io entry-point
module.exports = function(context, cb) {
  var awsCreds = context.data.wtData; // Secure data set during the 'wt create'
  awsCreds = parseJson(awsCreds);

  // EC2 IAM user credentials must exist
  if (!awsCreds || !awsCreds.accessKeyId || !awsCreds.secretAccessKey) {
    return cb(new Error('EC2 secrets are missing'));
  }

  // These run time execution arguments are sent as JSON postdata
  var runArgs = context.body;

  // The EC2 region is sent at execution time. Merge with the EC2 credentials
  awsCreds.region = !runArgs ? '' : runArgs.region;
  var instanceType = !runArgs ? '' : runArgs.type;

  // wrap the error
  var returnError = function(errMsg) {
    logInfo('Error:', errMsg);
    return cb(errMsg);
  }

  // Initialize this Spotter
  var spotter = null;
  try {
    spotter = new Spotter(awsCreds);
  }
  catch (e) {
    returnError(errMsg);
  }

  // Listen for price history results
  spotter.on('prices', function (pricesData) {
    if (pricesData instanceof Error) {
      returnError(pricesData);
    }
    else {
      return cb(null, pricesData);
    }
  });

  // Make the price history request
  spotter.spotPrices(instanceType);
}

/**
 * Constructs an EC2 Spotter
 * @constructor
 * @arg {object[]} awsCredentials - the ec2 IAM credentials in JSON
 *
 */
function Spotter (awsCredentials) {
  EventEmitter.call(this);

  awsCredentials.sslEnabled = true;

  // Initialize the awsConfig
  try {
    AWS.config.update(awsCredentials);
  }
  catch (awsErr) {
    throw awsErr;
  }

  logInfo('Loaded EC2 for ', {
    Region: awsCredentials.region
  });

  this.ec2 = new AWS.EC2();
}
EvUtil.inherits(Spotter, EventEmitter);

/**
* Get the latest spot prices
* @arg {string} type - the instance type to be priced e.g. m3.medium
* @fires Spotter#prices {object[]}
*/
Spotter.prototype.spotPrices = function (type) {
  var now = new Date();
  var future = new Date(now);

  // Add one day into the future to retrieve the current spot price
  future.setDate(future.getDate() + 1);

  var instanceTypes = [type]; // the vm type e.g. t1.micro
  var params = {
    DryRun: false,
    InstanceTypes: instanceTypes,
    ProductDescriptions: ['Linux/UNIX'],
    EndTime: future,
    StartTime: now
  };

  logInfo('Request Prices:', this.ec2.config.region, type);

  // Make the request to get the latest spot prices
  this.ec2.describeSpotPriceHistory(params, function (err, data) {
    if (err) {
      this.emit('prices', err);
      return;
    }

    if (data.NextToken !== '') {
       // Not relevant when using the Instance Type filter
    };

    var spotPrices = data.SpotPriceHistory;
    logInfo('\n%j', spotPrices);

    /**
    * Prices event
    * @event Spotter#prices {object[]} array of ec2 spotPriceHistory objects
    */
    this.emit('prices', spotPrices);
  }.bind(this));
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
