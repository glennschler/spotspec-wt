/*
* @module AwsSpotter-webtask
*/
const Const = require('awsspotter').Const
const Intern = require('awsspotter').Intern
const AwsSpotter = require('awsspotter').AwsSpotter
const Util = require('util')
const EventEmitter = require('events').EventEmitter

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

internal.mergeSecrets = function (construct, cmdOptions, wtSecrets) {
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

  // The task is to launch, and secrets has userData file data
  if (cmdOptions.task === 'launch' && wtSecrets.hasOwnProperty('userData')) {
    cmdOptions.userData = wtSecrets.userData
  }
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
