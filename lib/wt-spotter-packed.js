module.exports =
/******/  (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	/*
	* @module AwsSpotter-webtask
	*/
	const Util = __webpack_require__(1)
	const EventEmitter = __webpack_require__(2).EventEmitter
	const AwsSpotter = __webpack_require__(3).AwsSpotter
	const Const = __webpack_require__(3).Const
	const Intern = __webpack_require__(3).Intern

	/**
	* internals
	* @private
	*/
	var internals = {
	  sessionData: {},  // for webtasks which are requested more than once
	  logger: null,
	  initLogger: Intern.fnInitLogger
	}

	/**
	* The webtask.io module export
	*/
	module.exports = function (context, cb) {
	  if (!context.hasOwnProperty('data')) {
	    return cb(new Error('Missing Webtask.io create data'))
	  } else if (!context.hasOwnProperty('body')) {
	    return cb(new Error('Missing Webtask.io request body'))
	  }

	  // Secure data JSON 'secrets' set during the 'wt create'
	  var wtSecrets = context.data.wtData
	  wtSecrets = internals.parseJson(wtSecrets)

	  // Run time execution arguments are sent as JSON postdata of the task request
	  var runArgs = context.body
	  runArgs = internals.parseJson(runArgs)

	  // Two json arguments exist in the run args
	  var construct = runArgs.construct
	  var cmdOptions = runArgs.attributes

	  // The runArgs provide the json, with some empty field which are filled
	  // by the secure webtask secrets
	  if (construct.hasOwnProperty('keys')) {
	    // Merge in from the secrets
	    construct.keys.accessKeyId = wtSecrets.accessKeyId
	    construct.keys.secretAccessKey = wtSecrets.secretAccessKey
	  }

	  // If AWS service will use a MFA Token, the serialNumber was sent as a secret
	  if (construct.hasOwnProperty('upgrade') &&
	        wtSecrets.hasOwnProperty('serialNumber')) {
	    construct.upgrade.serialNumber = wtSecrets.serialNumber
	  }

		if (wtSecrets.hasOwnProperty('userData')) {
			cmdOptions.userData = wtSecrets.userData
	  }

	  // proces the task
	  var taskReq = new TaskRequest(construct, cmdOptions)

	  taskReq.on(Const.EVENT_COMPLETE, function (err, data) {
	    // all done, return the results to the callers callback
	    return cb(err, data)
	  })
	}

	// helper to parse json. Handle string or an object, only Object returned
	internals.parseJson = function (jsonStrIn) {
	  var jsonObOut = null

	  if (typeof jsonStrIn === 'undefined') {
	    return null
	  } else if (typeof jsonStrIn === 'object') {
	    // object in, object out
	    return jsonStrIn
	  }

	  try {
	    jsonObOut = JSON.parse(jsonStrIn)
	  } catch (parseError) { }

	  return jsonObOut
	}

	// Create a new spotter or return a previous created one.
	// A previous one will exist for the short lifetime of container
	internals.getSpotter = function (construct, cmdOptions) {
	  var session = internals.sessionData
	  var spotter = null

	  // If webtask.io is still using the same recent container
	  if (session.hasOwnProperty('sessionSpotter') && construct.reusePastSession) {
	    spotter = session.sessionSpotter.spotter
	    internals.logger.info('reusing session spotter: ', true)

	    // Representing the spotter which already exist, send an Initialized event
	    Intern.emitNextTick.call(spotter, Const.EVENT_INITIALIZED,
	        null, { state: Const.STATE_READY })
	  } else {
	    spotter = new AwsSpotter(construct, cmdOptions.isLogging)
	    session.sessionSpotter = { 'spotter': spotter }
	  }

	  return spotter
	}

	/**
	* Constructs a new webtask handler for the AwsSpotter Library
	* @constructor
	*/
	function TaskRequest (construct, cmdOptions) {
	  EventEmitter.call(this)
	  var self = this
	  var spotter = internals.getSpotter(construct, cmdOptions)

	  // the event handler for the AwsSpotter
	  spotter.once(Const.EVENT_INITIALIZED, function (err, initData) {
	    if (err) {
	      delete internals.sessionData.sessionSpotter
	      var error = new Error('Failed to initialize: ' + JSON.stringify(err))

	      Intern.emitNextTick.call(self, Const.EVENT_COMPLETE, error)
	    } else {
	      console.log('Initialized event:\n', initData)

	      if (!cmdOptions.hasOwnProperty('task')) {
	        return (new Error('Missing task name in attributes'))
	      } else if (cmdOptions.task === 'price') {
	        // now make the price request
	        self.price(spotter, cmdOptions)
	      } else if (cmdOptions.task === 'launch') {
	        self.launch(spotter, cmdOptions)
	      }
	    }
	  })
	}
	Util.inherits(TaskRequest, EventEmitter)

	/**
	* Make the price request
	**/
	TaskRequest.prototype.price = function (spotter, cmdOptions) {
	  var self = this
	  var priceOpts = {
	    type: cmdOptions.type || 'm3.medium',
	    product: cmdOptions.product || 'Linux/UNIX',
	    dryRun: cmdOptions.dryRun
	  }

	  spotter.once(Const.EVENT_PRICED, function (err, pricesData) {
	    // pass it along
	    self.emit(Const.EVENT_COMPLETE, err, pricesData)
	  })

	  // make the ec2 request
	  spotter.spotPrices(priceOpts)
	}

	/**
	* Make the price request
	**/
	TaskRequest.prototype.launch = function (spotter, cmdOptions) {
	  var self = this
	  var options = {
	    securityGroups: cmdOptions.securityGroups || [], // firewall specs "Names" defined in your EC2
	    keyName: cmdOptions.keyName || '',                         // keyName to pair when using SSH
	    dryRun: cmdOptions.dryRun,
	    ami: cmdOptions.ami,    // Amazon Linux VM HVM SSD image name
	    type: cmdOptions.type,
	    price: cmdOptions.price
	  }

	  // userData is cloud-init data
	  if (cmdOptions.hasOwnProperty('userData')) {
	    options.userData = cmdOptions.userData
	  }

	  var specs = {}

	  spotter.once(Const.EVENT_LAUNCHED, function (launchedData, err) {
	    // pass it along
	    self.emit(Const.EVENT_COMPLETE, err, launchedData)
	  })

	  // make the ec2 request
	  spotter.spotLaunch(options, specs)
	}


/***/ },
/* 1 */
/***/ function(module, exports) {

	module.exports = require("util");

/***/ },
/* 2 */
/***/ function(module, exports) {

	module.exports = require("events");

/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	const AWS = __webpack_require__(4)
	const Util = __webpack_require__(1)
	const AwsSvc = __webpack_require__(5)
	const Const = __webpack_require__(6).Const
	const Intern = __webpack_require__(6).Intern

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
	  var self = this
	  var params = { DryRun: false }
	  var ec2Service = this._services.ec2

	  // Make the request to get the latest spot prices
	  var req = ec2Service.describeInstances(params)

	  req.on('error', function onError (err) {
	    internals.logger.warn('Instance Describe Error:\n', err)
	    Intern.emitNextTick.call(self, Const.EVENT_INSTANCES, err)
	  })

	  req.on('success', function onSuccess (resp) {
	    var data = resp.data

	    if (data.hasOwnProperty('Reservations')) {
	      for (var key in data.Reservations) {
	        var instances = data.Reservations[key].Instances
	        internals.logger.info('Instance:', instances)
	      }
	    }

	    /**
	    * Emitted as the response to a spotPrices request
	    * @event AwsSpotter#priced
	    * @param {?error} err - Only on error
	    * @param {AwsSpotter#SpotPriceHistory[]} [priceData] - Null on error
	    */
	    Intern.emitNextTick.call(self, Const.EVENT_INSTANCES, null, data.Reservations)
	  })

	  req.send()
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
	module.exports = {
	  AwsSpotter: AwsSpotter,
	  Const: Const,
	  Intern: Intern
	}


/***/ },
/* 4 */
/***/ function(module, exports) {

	module.exports = require("aws-sdk");

/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	const AWS = __webpack_require__(4)
	const EventEmitter = __webpack_require__(2).EventEmitter
	const Util = __webpack_require__(1)
	const Const = __webpack_require__(6).Const
	const Intern = __webpack_require__(6).Intern

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
	* @private
	*/
	internals.Credentials = function (constructOps) {
	  EventEmitter.call(this)

	  constructOps.keys.apiVersion = 'latest'
	  constructOps.keys.sslEnabled = true

	  if (constructOps.hasOwnProperty('upgrade')) {
	    // Update with the MFA token passed in with the credentials
	    this._update(constructOps)
	    return
	  }

	  // Else not using a MFA token
	  this._awsConfig = new AWS.Config(constructOps.keys)

	  // Upgrade creditials not necessary. Tell the caller ready.
	  Intern.emitNextTick.call(this, Const.EVENT_CREDENTIAL,
	                        null, { state: Const.STATE_READY })
	}
	Util.inherits(internals.Credentials, EventEmitter)

	/**
	* Create MFA short term credentials
	* @private
	*/
	internals.Credentials.prototype._update = function (constructOps) {
	  var self = this
	  var opsToUpgrade = constructOps.upgrade
	  var stsParams = {
	    DurationSeconds: opsToUpgrade.durationSeconds | 900,  // 15 minute default
	    SerialNumber: opsToUpgrade.serialNumber,
	    TokenCode: opsToUpgrade.tokenCode
	  }

	  var sts = new AWS.STS(constructOps.keys)

	  // Request short term credentials from the STS service
	  var req = sts.getSessionToken(stsParams)

	  req.on('error', function (err, response) {
	    Intern.emitNextTick.call(self, Const.EVENT_CREDENTIAL, err)
	  })

	  req.on('success', function (response) {
	    var data = response.data

	    if (!data.hasOwnProperty('Credentials')) {
	      return handleMissingData(response)
	    }

	    onSuccess(response)
	  })

	  req.send()

	  /**
	  * Successful response
	  */
	  var onSuccess = function (response) {
	    // Update the AWS Config using the new short term credentials
	    var data = response.data
	    var awsConfig = constructOps.keys
	    var newAwsCredentials = {
	      accessKeyId: data.Credentials.AccessKeyId,
	      secretAccessKey: data.Credentials.SecretAccessKey,
	      sessionToken: data.Credentials.SessionToken,
	      region: awsConfig.region,
	      sslEnabled: awsConfig.sslEnabled,
	      apiVersion: awsConfig.apiVersion
	    }

	    // Create the config to be used for future requests
	    self._awsConfig = new AWS.Config(newAwsCredentials)

	    Intern.emitNextTick.call(self, Const.EVENT_CREDENTIAL,
	      null, { state: Const.STATE_UPGRADED, config: newAwsCredentials })
	  }

	  /**
	  * @todo Temporary. Handle the AWS issue when using node-inspector
	  * with node v 0.12.x and iojs 3.x
	  */
	  var handleMissingData = function (response) {
	    internals.logger.info('Success, but no Credentials data streamed: ' +
	      JSON.stringify(response.httpResponse.headers))

	    Intern.emitNextTick.call(self, Const.EVENT_CREDENTIAL,
	      new Error('Internal: aws service failed to stream data on success'))
	    return false
	  }
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

	  credsManager.on(Const.EVENT_CREDENTIAL, function (err, data) {
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


/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

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

	  var Winston = __webpack_require__(7)

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
	  EVENT_INSTANCES: 'instances',
	  EVENT_SPOTS: 'spots',
	  EVENT_TERMINATED: 'terminated',

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


/***/ },
/* 7 */
/***/ function(module, exports) {

	module.exports = require("winston");

/***/ }
/******/ ]);
