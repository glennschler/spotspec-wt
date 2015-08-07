var AWS = require('aws-sdk');
var EventEmitter = require('events').EventEmitter;
var EvUtil = require('util');

/**
* internals
* @private
*/
var internals = {};

internals.init = function (isLogging) {
  if (isLogging) {
    this.logger = console;
  }
};

internals.log = function (level, message, meta) {
  if (typeof this.logger === 'undefined') return; // exit if not logging

  if (typeof meta === 'undefined') {
    this.logger.log(level, message);
  }
  else {
    this.logger.log(level, message, meta);
  }
}

// help log
internals.logInfo = function (message, meta) {
  internals.log('info', message, meta);
}

// help log error
internals.logError = function (message, meta) {
  internals.log('error', message, meta);
}

/**
* @typedef AWSCredentials - Selections from [aws docs]{@link http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EC2.html#constructor-property}
* @type {object}
* @property {string} accessKeyId - The IAM users AWS access key ID
* @property {string} secretAccessKey - The IAM users AWS secret access key
* @property {string} region - The region to send service requests to
*/

/**
 * Constructs a new AwsSpotter Library
 * @constructor
 * @arg {AWSCredentials[]} awsCredentials - The ec2 IAM credentials for every region
 * @arg {boolean} isLogging - Use internal logging
 */
function AwsSpotter (awsCredentials, isLogging) {
  internals.init(isLogging);
  EventEmitter.call(this);

  awsCredentials.sslEnabled = true;

  // Initialize the awsConfig
  try {
    AWS.config.update(awsCredentials);
  }
  catch (awsErr) {
    throw awsErr;
  }

  internals.logInfo('Loaded EC2 for: ' + awsCredentials.region);

  this.ec2 = new AWS.EC2();
}
EvUtil.inherits(AwsSpotter, EventEmitter);

/**
* @typedef SpotPriceHistory
* @type {object}
* @property {string} InstanceType
* @property {string} ProductDescription
* @property {string} SpotPrice
* @property {date} Timestamp
* @property {string} AvailabilityZone
*/

/**
* spotPrices - Request the latest spot prices
* @arg {string} type - The instance type to be priced e.g. m3.medium
* @arg {string} [ProductDesc=Linux/UNIX] - e.g. 'Windows'
* @emits AwsSpotter#prices
*/
AwsSpotter.prototype.spotPrices = function (type, productDesc) {
  var now = new Date();
  var future = new Date(now);

  // Add one day into the future to retrieve the current spot price
  future.setDate(future.getDate() + 1);

  if (typeof productDesc === 'undefined') {
    productDesc = 'Linux/UNIX';
  }

  var instanceTypes = [type]; // the vm type e.g. t1.micro
  var params = {
    DryRun: false,
    InstanceTypes: instanceTypes,
    ProductDescriptions: [productDesc],
    EndTime: future,
    StartTime: now
  };

  internals.logInfo('Request Prices:', this.ec2.config.region, type);

  // Make the request to get the latest spot prices
  this.ec2.describeSpotPriceHistory(params, function (err, data) {
    if (err) {
      this.emit('error', err);
      return;
    }

    if (data.NextToken !== '') {
       // Not relevant when using the Instance Type filter
    };

    var spotPrices = data.SpotPriceHistory;
    internals.logInfo('Prices:\n', spotPrices);

    /**
    * Emitted as the response to a spotPrices request
    * @event AwsSpotter#prices
    * @type {SpotPriceHistory[]}
    */
    this.emit('prices', spotPrices);
  }.bind(this));
};

/**
* @typedef LaunchSpec
* @type {object}
* @property {string} ami - The amazon machine image name
* @property {string} type - The amazon Instance Type e.g. m3.medium
* @property {string} price - The maximaum price limit
* @property {string} userData - Optional cloud-init text. See [user guide]{@link http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/user-data.html#user-data-cloud-init}
*/

/**
* @typedef EC2Options - Selections from [aws doc]{@link http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EC2.html#requestSpotInstances-property}
* @type {object}
* @property {string[]} securityGroupIds - Array of one or more security group ids. See [user guide]{@link http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-network-security.html}
* @property {string} keyName - The name of the key pair needed to access the launched instance. See [user guide]{@link http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-key-pairs.html}
* @property {boolean} dryRun - Only verify launch parameters. if TRUE, do not launch an instance
*/

/**
* Launch a spot instance
* @arg {EC2Options} ec2Options - Property bag of EC2 launch options
* @arg {LaunchSpec} launchSpec - Property bag specification for the new instance
*/
AwsSpotter.prototype.spotLaunch = function spotLaunch (options, specs) {
  var self = this;
  if (typeof specs === 'undefined') {
    throw new Error('Missing required launch specs');
  }

  if (typeof options === 'undefined') {
    throw new Error('Missing required ec2 options');
  }

  var securityGroupIds = options.securityGroupIds;
  var keyName = options.keyName;
  var dryRun = options.dryRun || false;

  // specs
  var ami = specs.ami;
  var type = specs.type;
  var price = specs.price;

  var specificationNew = {
    ImageId: ami,
    KeyName: keyName,  // ec2 keypair name
    InstanceType: type,
    SecurityGroupIds: securityGroupIds
  };

  // check if there is cloud-init data
  if (typeof specs.userData != 'undefined') {
    specificationNew.UserData = specs.userData;
  }

  var params = {
    DryRun: dryRun,
    SpotPrice: price, // required
    InstanceCount: 1,
    LaunchSpecification: specificationNew
  };

  // Make the spot launch request
  self.ec2.requestSpotInstances(params, function(err, data) {
    if (err) {
      internals.logError('error: ', err); // An error occurred
      self.emit('error', err);
    }
    else {
      internals.logInfo('launched: ', data); // Successful response

      /**
      * Emitted as the response to a spotPrices request
      * @event AwsSpotter#launched
      * @type {object[]}
      */
      self.emit('launched', data);
    }

    self = null;
  });
}

/**
* Describe the status of all current spot requests
*/
AwsSpotter.prototype.spotDescribe = function spotDescribe () {
  var params = {
    DryRun : false
    //,InstanceIds : ['i-xxxxx']
  };

  // Make the request to get the latest spot request details
  this.ec2.describeSpotInstanceRequests(params, function(err, data) {
    if (err) {
      internals.logError(err, err.stack); // an error occurred
    }
    else if (data.hasOwnProperty('SpotInstanceRequests')) {
      internals.logInfo(spotRespToString (data));
    }
  });
};

/**
* Describe the status of all instances
*/
AwsSpotter.prototype.instancesDescribe = function instancesDescribe ()
{
  var params = { DryRun : false };

  // make the request to descibe all instances
  this.ec2.describeInstances(params, function(err, data) {
    if (err) {
      internals.logError(err, err.stack); // an error occurred
    }
    else if (data.hasOwnProperty('Reservations')) {
      for (var key in data.Reservations) {
        var instances = data.Reservations[key].Instances;
        logReservation(instances);
      }
    }
  });
};

/**
* Terminate an instance
*/
AwsSpotter.prototype.terminateInstances = function terminateInstances (inId)
{
  var instanceIds = [ inId  ];

  var params = {
    DryRun: false,
    InstanceIds: instanceIds
  };

  // request an instance termination
  this.ec2.terminateInstances(params, function(err, data) {
    if (err) {
      internals.logError(err, err.stack); // an error occurred
    }
    else {
      data.TerminatingInstances.forEach(function(entry) {
        internals.logInfo(entry);
      });
    }
  });
};

/**
* Cancel a spot request
*/
AwsSpotter.prototype.cancelSpotRequest = function cancelSpotRequest (reqId)
{
  var spotRequestIds = [ reqId  ];

  var params = {
    DryRun: false,
    SpotInstanceRequestIds : spotRequestIds
  };

  // request the cancelation
  this.ec2.cancelSpotInstanceRequests(params, function(err, data) {
    if (err) {
      internals.logError(err, err.stack); // an error occurred
    }
    else {
      data.CancelledSpotInstanceRequests.forEach(function(entry) {
        internals.logInfo(entry);
      });
    }
  });
};

// --------------

module.exports = AwsSpotter;
