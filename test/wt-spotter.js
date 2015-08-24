/**
* This is hand built Bootstrap for a webtask.io webtask
* 1st attempt used [WebPack]{@link https://webpack.github.io/ to create a
* similar js bundle file, though was not enough. So that webpack bundle output
* was used as a template to  create this file.
* Next need to automate a solution using webpack properly or use browserfy or
* [require.js]{@link http://requirejs.org/docs/node.html}
* Goal is to bundle up a private or local node module to be used by node.js
* instance in a webtask.io container.
* Webtask.io already provides access to core nodejs and many popular npm
* repositories, so those do not need to be replaced/transformed.
*
*/
/******/ module.exports = (function WebtaskBootstrap(modules) { // webtask.io.Bootstrap
/******/
/******/ 	// The require function
/******/ 	function __wt_require__(moduleId) {
/******/
/******/    // create the module cache if it does not exist
/******/    if (typeof installedModules === 'undefined') {
/******/      installedModules = []
/******/    }
/******/
/******/    // Check if module is in cache
/******/    if(installedModules[moduleId])
/******/    	return installedModules[moduleId].exports;
/******/
/******/    // Create a new module (and put it into the cache)
/******/    var module = installedModules[moduleId] = {
/******/    	exports: {},
/******/    	id: moduleId,
/******/    	loaded: false
/******/    };
/******/
/******/    // Execute the module function only once!
/******/    modules[moduleId].call(module.exports, module, module.exports,
/******/      __wt_require__);
/******/
/******/    // Flag the module as loaded
/******/    module.loaded = true;
/******/
/******/    // Return the exports of the module
/******/    return module.exports;
/******/  }
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __wt_require__(0);
/******/ }) // packed by __wt_require__
/******/ ([
/*** wt_packed [0]
****/
function WebTask_m(module, exports, __wt_require__) {
/*
* @module AwsSpotter-webtask
*/
const AWS = require('aws-sdk')
const Util = require('util')
const AwsSpotter = __wt_require__(1)
const Const = __wt_require__(2).Const
const Intern = __wt_require__(2).Intern

var sessionData = {};  // for webtasks that re-use this module on a second request

/**
* The webtask.io module export
*/
module.exports = function(context, cb) {
  if (!context.hasOwnProperty('data')) {
    return cb(new Error('Missing Webtask.io create data'))
  } else if (!context.hasOwnProperty('body')) {
    return cb (new Error('Missing Webtask.io request body'))
  }

  var wtSecrets = context.data.wtData; // Secure data set during the 'wt create'
  wtSecrets = parseJson(wtSecrets);

  // These run time execution arguments are sent as JSON postdata
  var runArgs = context.body;
  runArgs = parseJson(runArgs);

  // EC2 IAM user credentials must exist
  if (!wtSecrets || !wtSecrets.accessKeyId || !wtSecrets.secretAccessKey) {
    return cb(new Error('EC2 secrets are missing'));
  }

  if (typeof runArgs === 'undefined') {
    return cb(new Error('AwsSpotter arguments are missing'));
  }

  // the two json argumets sent in the run args
  var construct = runArgs.construct
  var attributes = runArgs.attributes

  if (construct.hasOwnProperty('keys')) {
    // Merge in from the secrets
    construct.keys.accessKeyId = wtSecrets.accessKeyId
    construct.keys.secretAccessKey = wtSecrets.secretAccessKey
  }

  if (wtSecrets.hasOwnProperty('serialNumber') &&
      construct.hasOwnProperty('upgrade')) {
    construct.upgrade.serialNumber = wtSecrets.serialNumber
  }

  test(construct, attributes, cb)
}

// helper to parse json
var parseJson = function (jsonStrIn) {
  var jsonStrOut

  try {
    jsonStrOut = JSON.parse(jsonStrIn);
  } catch (parseError) {
    jsonStrOut = null
  }

  if (jsonStrOut === null) {
    // try again after making it a string. Maybe it already was json
    jsonStrOut = parseJson(JSON.stringify(jsonStrIn))
  }

  return jsonStrOut;
}

// wrap for future 3rd party logger
var logInfo = function () {
  console.info(Util.format.apply(this, arguments));
}

// initialize the AWS service
var test = function (construct, attributes, cb) {
  var spotter

  // If webtask.io is still using the same recent container
  if (sessionData.hasOwnProperty('sessionSpotter') &&
      construct.reusePastSession) {
    spotter = sessionData.sessionSpotter.spotter
    console.log('reusing session spotter: ', true)

    // send another Initialized event to continue
    Intern.emitNextTick.call(spotter, Const.EVENT_INITIALIZED,
        null, { state: Const.STATE_READY })
  } else {
    spotter = new AwsSpotter(construct, attributes.isLogging)
    sessionData.sessionSpotter = { 'spotter': spotter }
  }

  // the event handler
  spotter.once(Const.EVENT_INITIALIZED, function onInitialize (err, initData) {
    if (err) {
      return cb(new Error(err))
    } else {
      console.log('Initialized event:\n', initData)

      // now make the price request
      price(attributes)
    }
  })

  // make the price request
  var price = function (cmdOptions) {
    var priceOpts = {
      type: cmdOptions.type || 'm3.medium',
      product: cmdOptions.product || 'Linux/UNIX',
      dryRun: cmdOptions.dryRun
    }

    // the event handler
    spotter.once(Const.EVENT_PRICED, function onPrices (err, pricesData) {
      if (err) {
        return cb(new Error(err))
      } else {
        return cb(null, pricesData)
      }
    })

    // make the ec2 request
    spotter.spotPrices(priceOpts)
  }
}
},  // module end
/*** wt_packed [1]
****/
function AwsSpotter_m(module, exports, __wt_require__) {
  const AWS = require('aws-sdk')
  const Util = require('util')
  const AwsSvc = __wt_require__(3)
  const Const = __wt_require__(2).Const
  const Intern = __wt_require__(2).Intern

  /**
  * internals
  * @private
  */
  var internals = {
    logger: null,
    initLogger: Intern.fnInitLogger
  }

  /**
  * Constructs a new AwsSpotter Library
  * @constructor
  * @arg {AwsSvc#constructOpts} construct - The AWS service IAM credentials
  * @arg {boolean} [isLogging] - Use internal logging
  * @throws {error}
  * @emits {AwsSpotter#initialized}
  */
  function AwsSpotter (constructOps, isLogging) {
    if (this.constructor.name === 'Object') {
      throw new Error('Object must be instantiated using new')
    }
    var self = this

    // Have the superclass constuct as an EC2 service
    AwsSvc.call(this, AWS.EC2, constructOps, isLogging)
    internals.initLogger(isLogging)

    internals.logger.info('Loading EC2 for: ' + constructOps.keys.region)

    this.on(Const.EVENT_COMPLETE, function onComplete (err, data) {
      /**
      * Emitted as the response to constuct AwsSpotter
      * @event AwsSpotter#initialized
      * @param {?error} err - Only on error
      * @param {object} [data] - Null on error
      */
      Intern.emitNextTick.call(self, Const.EVENT_INITIALIZED, err, data)
    })
  }
  Util.inherits(AwsSpotter, AwsSvc)

  /**
  * @typedef {object} AwsSpotter#SpotPriceHistory
  * @property {string} InstanceType
  * @property {string} ProductDescription
  * @property {string} SpotPrice
  * @property {date} Timestamp
  * @property {string} AvailabilityZone
  */

  /**
  * @typedef {object} AwsSpotter#PriceOptions
  * @property {string} type - The instance type to be priced e.g. m3.medium
  * @property {string} [product=Linux/UNIX] - e.g. 'Windows'
  * @property {boolean} [dryRun=true] - Only verify parameters.
  */

  /**
  * spotPrices - Request the latest spot prices
  * @arg {AwsSpotter#PriceOptions}
  * @emits AwsSpotter#priced
  */
  AwsSpotter.prototype.spotPrices = function (options) {
    var self = this
    var now = new Date()
    var future = new Date(now)

    // Add one day into the future to retrieve the current spot price
    future.setDate(future.getDate() + 1)

    var instanceTypes = [options.type]  // the vm type e.g. t1.micro
    var params = {
      DryRun: Intern.isTrueOrUndefined(options.dryRun),
      InstanceTypes: instanceTypes,
      ProductDescriptions: [options.product || 'Linux/UNIX'],
      EndTime: future,
      StartTime: now
    }

    var ec2Service = this._services.ec2
    internals.logger.info('Request Prices:', ec2Service.config.region, params)

    // Make the request to get the latest spot prices
    var req = ec2Service.describeSpotPriceHistory(params)

    req.on('error', function onError (err) {
      internals.logger.warn('Prices Error:\n', err)
      Intern.emitNextTick.call(self, Const.EVENT_PRICED, err)
    })

    req.on('success', function onSuccess (resp) {
      var data = resp.data
      if (data.NextToken !== '') {
        // Not relevant when using the Instance Type filter
      }

      var spotPrices = data.SpotPriceHistory
      internals.logger.info('Prices:\n', spotPrices)

      /**
      * Emitted as the response to a spotPrices request
      * @event AwsSpotter#priced
      * @param {?error} err - Only on error
      * @param {AwsSpotter#SpotPriceHistory[]} [priceData] - Null on error
      */
      Intern.emitNextTick.call(self, Const.EVENT_PRICED, null, spotPrices)
    })

    req.send()
  }

  /**
  * The following properties are nessesary or highly recommended.
  * @typedef {object} AwsSpotter#SpotOptions
  * @property {string} ami - The amazon machine image name
  * @property {string} type - The amazon Instance Type e.g. m3.medium
  * @property {string} price - The maximaum price limit
  * @property {string} keyName - The name of the key pair needed to access the launched instance. See [user guide]{@link http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-key-pairs.html}
  * @property {boolean} [dryRun=true] - Only verify launch parameters. if TRUE, do not launch an instance
  * @property {number} [count=1] - The InstanceCount number to launch
  * @property {string[]} [securityGroupIds] - Array of one or more security group ids. See [user guide]{@link http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-network-security.html}
  * @property {string[]} [securityGroups] - Array of one or more security group names. See [user guide]{@link http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-network-security.html}
  * @property {string} [userData] - cloud-init *base64-encoded* text. See [user guide]{@link http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/user-data.html#user-data-cloud-init}
  */

  /**
  * Additional control properties defined in the LaunchSpecification property
  * of requestSpotInstances params [aws doc]{@link http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EC2.html#requestSpotInstances-property}
  * @typedef {object} AwsSpotter#LaunchSpecification
  */

  /**
  * Launch a spot instance
  * @arg {AwsSpotter#SpotOptions} options - Mandatory or suggested parameters
  * @arg {AwsSpotter#LaunchSpecification} [launchSpec] - Additional LaunchSpecification properties
  * @throws {error}
  * @emits AwsSpotter#launched
  */
  AwsSpotter.prototype.spotLaunch = function spotLaunch (options, launchSpec) {
    var self = this
    if (typeof options === 'undefined') {
      throw new Error('Missing required launch options')
    }

    // Nessesary to launch a new instance
    var launchSpecification = {
      ImageId: options.ami,
      KeyName: options.keyName,
      InstanceType: options.type
    }

    // These are suggested as important though still optional
    var optionalProps = {
      SecurityGroupIds: options.securityGroupIds,
      SecurityGroups: options.securityGroups,
      UserData: options.userData
    }

    // Add the suggested optional ones next, ignoring the undefined
    Intern.addOptions(launchSpecification, optionalProps)
    Intern.addOptions(launchSpecification, launchSpec) // add the rest last

    // These are the aws request options, including the LaunchSpecification opts
    var params = {
      DryRun: Intern.isTrueOrUndefined(options.dryRun),
      SpotPrice: options.price,
      InstanceCount: options.count || 1,
      LaunchSpecification: launchSpecification
    }

    // Make the spot launch request
    var ec2Service = this._services.ec2
    var req = ec2Service.requestSpotInstances(params)

    req.on('error', function onError (err) {
      internals.logger.warn('error: ', err)
      Intern.emitNextTick.call(self, Const.EVENT_LAUNCHED, null, err)
    })

    req.on('success', function onSuccess (resp) {
      internals.logger.warn('launched: ', resp.data)

      /**
      * Emitted as the response to a spotLaunch request
      * @event AwsSpotter#launched
      * @param {?error} err - Only on error
      * @param {object} [launchData] - Null on error
      */
      Intern.emitNextTick.call(self, Const.EVENT_LAUNCHED, resp.data)
    })

    req.send()
  }

  /**
  * Describe the status of all current spot requests
  */
  AwsSpotter.prototype.spotDescribe = function spotDescribe () {
    var params = {
      DryRun: false
    // ,InstanceIds : ['i-xxxxx']
    }

    var ec2Service = this._services.ec2

    // Make the request to get the latest spot request details
    ec2Service.describeSpotInstanceRequests(params,
      function cbDescribeSpotRequests (err, data) {
        if (err) {
          internals.logger.warn(err, err.stack) // an error occurred
        } else if (data.hasOwnProperty('SpotInstanceRequests')) {
          // internals.logger.info(spotRespToString(data))
        }
      })
  }

  /**
  * Describe the status of all instances
  */
  AwsSpotter.prototype.instancesDescribe = function instancesDescribe () {
    var params = { DryRun: false }
    var ec2Service = this._services.ec2

    // make the request to descibe all instances
    ec2Service.describeInstances(params,
      function cbDescribeInstances (err, data) {
        if (err) {
          internals.logger.warn(err, err.stack) // an error occurred
        } else if (data.hasOwnProperty('Reservations')) {
          for (var key in data.Reservations) {
            var instances = data.Reservations[key].Instances
            internals.logger.info(instances)
            // logReservation(instances)
          }
        }
      })
  }

  /**
  * Terminate an instance
  */
  AwsSpotter.prototype.terminateInstances = function terminateInstances (inId) {
    var instanceIds = [inId]
    var ec2Service = this._services.ec2
    var params = {
      DryRun: false,
      InstanceIds: instanceIds
    }

    // request an instance termination
    ec2Service.terminateInstances(params,
      function cbTerminstateInstances (err, data) {
        if (err) {
          internals.logger.warn(err, err.stack) // an error occurred
        } else {
          data.TerminatingInstances.forEach(function (entry) {
            internals.logger.info(entry)
          })
        }
      })
  }

  /**
  * Cancel a spot request
  */
  AwsSpotter.prototype.cancelSpotRequest = function cancelSpotRequest (reqId) {
    var spotRequestIds = [reqId]
    var ec2Service = this._services.ec2
    var params = {
      DryRun: false,
      SpotInstanceRequestIds: spotRequestIds
    }

    // request the cancelation
    ec2Service.cancelSpotInstanceRequests(params,
      function cbCancelSpotRequests (err, data) {
        if (err) {
          internals.logger.warn(err, err.stack) // an error occurred
        } else {
          data.CancelledSpotInstanceRequests.forEach(function (entry) {
            internals.logger.info(entry)
          })
        }
      })
  }

  /**
  * @module AwsSpotter
  * @description Manage AWS EC2 Spot instances
  */
  module.exports = AwsSpotter
},
/*** wt_packed [2]
****/
function Intern_m(module, exports, __wt_require__) {
  /**
  * @private
  * @namespace {object} Intern
  */
 function Intern () {}

 /**
 * @private
 * @function Intern#emitNextTick
 *
 * Emit event on the next tick
 */
 Intern.emitNextTick = function (eventName, err, data) {
   if (this.constructor.name === 'Function') {
     throw new Error('Caller must be an emitter')
   }

   process.nextTick(function emitNextTick () {
     this.emit(eventName, err, data)
   }.bind(this))
 }

 /**
 * Handle the string or undefined, default to true for 'undefined'
 * @private
 * @function Intern#isTrueOrUndefined
 */
 Intern.isTrueOrUndefined = function (val) {
   return (typeof val === 'undefined') || ('' + val) === 'true'
 }

 /**
 * Merge in new object properties, without overwriting the existing
 * @private
 * @function Intern#addOptions
 */
 Intern.addOptions = function (existingObj, newProps) {
   for (var propName in newProps) {

     // AWS option properties always start with upper case
     var newPropName = propName.charAt(0).toUpperCase() + propName.substr(1)

     // never overwrite an existing property & never insert 'undefined'
     if (existingObj.hasOwnProperty(newPropName)) continue
     if (typeof newProps[propName] === 'undefined') continue

     existingObj[newPropName] = newProps[propName]
   }
 }

 /**
 * Function to be assigned to an objects logger method
 * @private
 * @function Intern#fnInitLogger
 */
 Intern.fnInitLogger = function (isLogging) {
   if (this.constructor.name === 'Function') {
     throw new Error('Missing object context')
   }

   var internals = this // the commonly used name of callers

   if (!internals.hasOwnProperty('logger')) {
     throw new Error('Missing property "logger" in current context')
   } else if (internals.logger !== null) {
     return          // must be null to initialize a new logger
   } else if (!isLogging) {
     // stub the logger out
     internals.logger = {}
     internals.logger.info = function () {}
     internals.logger.error = function () {}
     internals.logger.warn = function () {}
     return
   }

   var Winston = require('winston')

   var winstonTransport = new (Winston.transports.Console)({
     json: false,
     colorize: true
   })

   internals.logger = new (Winston.Logger)({
     transports: isLogging ? [winstonTransport] : []
   })
 }

 /**
 * @typedef {namespace} Const
 * @private
 */
 var Const = {
   // Event names

   EVENT_CREDENTIAL: 'credential',
   EVENT_COMPLETE: 'complete',
   EVENT_INITIALIZED: 'initialized',
   EVENT_PRICED: 'priced',
   EVENT_LAUNCHED: 'launched',

   // Event states

   STATE_READY: 'ready',
   STATE_UPGRADED: 'upgraded'
 }

 /**
 * @module Intern
 * @description Helper for AwsSpotter
 */
 module.exports = {
   Intern: Intern,
   Const: Const
 }
},
/*** wt_packed [3]
****/
function AwsSvc_m(module, exports, __wt_require__) {
  const AWS = require('aws-sdk')
  const EventEmitter = require('events').EventEmitter
  const Util = require('util')
  const Const = __wt_require__(2).Const
  const Intern = __wt_require__(2).Intern

  /**
  * internals
  * @private
  */
  var internals = {
    logger: null,
    initLogger: Intern.fnInitLogger
  }

  /**
  * Initialize the requested AWS service using the given Credentials
  * @private
  */
  internals.newService = function (awsConfig, RequestedAwsService, cb) {
    var newServiceObj

    try {
      // Instantiate an object of the requested Aws service class
      newServiceObj = new RequestedAwsService(awsConfig)
    } catch (err) {
      return cb(err)
    }

    // return the new service
    return cb(null, { newAwsService: newServiceObj })
  }

  /**
  * Create MFA short term credentials
  * @constructor
  * @private
  */
  internals.Credentials = function (constructOps) {
    EventEmitter.call(this)
    var self = this
    var opsToConfig = constructOps.keys

    opsToConfig.apiVersion = 'latest'
    opsToConfig.sslEnabled = true

    this._awsConfig = new AWS.Config(opsToConfig)

    if (!constructOps.hasOwnProperty('upgrade')) {
      // Upgrade creditials not necessary. Tell the caller ready.
      Intern.emitNextTick.call(this, Const.EVENT_CREDENTIAL,
        null, { state: Const.STATE_READY })
      return
    }

    // Need to update with the MFA token passed in with the credentials
    var upgrade = constructOps.upgrade

    this.update(upgrade, function cbUpdateCreds (err, data) {
      if (err) {
        Intern.emitNextTick.call(self, Const.EVENT_CREDENTIAL, err)
      } else {
        // keep the new config
        self._awsConfig = data.newAwsConfig

        Intern.emitNextTick.call(self, Const.EVENT_CREDENTIAL,
          null, { state: Const.STATE_UPGRADED })
      }
    })
  }
  Util.inherits(internals.Credentials, EventEmitter)

  /**
  * Create MFA short term credentials
  * @private
  */
  internals.Credentials.prototype.update = function (opsToUpgrade, cb) {
    var self = this
    var stsParams = {
      DurationSeconds: opsToUpgrade.durationSeconds | 900,  // 15 minute default
      SerialNumber: opsToUpgrade.serialNumber,
      TokenCode: opsToUpgrade.tokenCode
    }

    var sts = new AWS.STS(this._awsConfig)

    // Request short term credentials from the STS service
    sts.getSessionToken(stsParams, function cbGetSessionToken (err, data) {
      if (err) {
        return cb(err)
      }

      var awsConfig = self._awsConfig // for reference only

      // Update the AWS Config using the short term credentials
      var newAwsCredentials = {
        accessKeyId: data.Credentials.AccessKeyId,
        secretAccessKey: data.Credentials.SecretAccessKey,
        sessionToken: data.Credentials.SessionToken,
        region: awsConfig.region,
        sslEnabled: awsConfig.sslEnabled,
        apiVersion: awsConfig.apiVersion
      }

      // Return the updated config
      var newAwsConfig = new AWS.Config(newAwsCredentials)

      return cb(null, { newAwsConfig: newAwsConfig, state: Const.STATE_UPGRADED })
    })
  }

  /**
  * Subset of [aws docs]{@link http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Credentials.html}
  * @typedef {object} AwsSvc#AWSCredentials
  * @property {string} accessKeyId
  * @property {string} secretAccessKey
  * @property {string} region
  */

  /**
  * Subset of [aws docs]{@link http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/STS.html#getSessionToken-property}
  * @typedef {object} AwsSvc#AWSSessionToken
  * @property {string} serialNumber - MFA serial number
  * @property {string} tokenCode - MFA token code
  * @property {string} [durationSeconds=900] - The duration, in seconds, that the credentials should remain valid
  */

  /**
  * Credentials and optional MFA
  * @typedef {object} AwsSvc#constructOpts
  * @property {AwsSvc#AWSCredentials} keys - AWS config credentials
  * @property {AwsSvc#AWSSessionToken} [upgrade] - MFA attributes
  */

  /**
   * Constructs a new AwsSvc object for managing aws credentials
   * @constructor
   * @abstract
   * @arg {class} requestedSvc - The AWS.Service class to instantiate [aws docs]{@link http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Service.html}
   * @arg {AwsSvc#constructOpts} construct - The AWS serice IAM credentials
   * @arg {boolean} [isLogging] - Use internal logging
   * @throws {error}
   * @emits {AwsSvc#complete}
   */
  function AwsSvc (requestedSvc, constructOps, isLogging) {
    if (this.constructor.name === 'Object') {
      throw new Error('Must be instantiated using new')
    } else if (this.constructor.name === 'AwsSvc') {
      throw new Error('Abstract class ' +
        this.constructor.name + ' should not be instantiated')
    }
    EventEmitter.call(this)
    internals.initLogger(isLogging)
    var self = this

    // initialize the property bag of AWS services which will be created
    this._services = {}

    var credsManager = new internals.Credentials(constructOps)

    credsManager.on(Const.EVENT_CREDENTIAL, function onCredsComplete (err, data) {
      var eventName = Const.EVENT_CREDENTIAL
      if (err) {
        internals.logger.warn(eventName, err)

        Intern.emitNextTick.call(self, Const.EVENT_COMPLETE, err)
        return
      }

      internals.logger.info(eventName, 'success')

      if (self._services.hasOwnProperty(requestedSvc.serviceIdentifier)) {
        var serviceName = requestedSvc.serviceIdentifier
        internals.logger.info('Refreshing service: ' + serviceName)
      }

      // Always instantiate the requested aws service, even if old one exists
      internals.newService(credsManager._awsConfig, requestedSvc, cbNewService)
    })

    // callback handler for creation of new AWS service
    var cbNewService = function (err, data) {
      if (err) {
        Intern.emitNextTick.call(self, Const.EVENT_COMPLETE, err)
        return
      }

      var newAwsService = data.newAwsService
      var serviceName = requestedSvc.serviceIdentifier

      // keep the new service object
      self._services[serviceName] = newAwsService

      /**
      * Emitted as the response to constuct AwsSvc
      * @event AwsSvc#complete
      * @param {?error} err - Only on error
      * @param {object} [state] - Null on error
      */
      Intern.emitNextTick.call(self, Const.EVENT_COMPLETE, null,
        { state: Const.STATE_READY })
    }
  }
  Util.inherits(AwsSvc, EventEmitter)

  /**
  * @module AwsSvc
  * @description Manage AWS Services
  */
  module.exports = AwsSvc
}

/******/ ]);  // Packed by __wt_require__
