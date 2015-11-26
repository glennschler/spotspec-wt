'use strict'
/*
* @module wt-spotter
*/
const Const = require('spotspec').Const
const Intern = require('spotspec').Intern
const SpotSpec = require('spotspec').SpotSpec
const LogWrap = require('spotspec').LogWrap
const Util = require('util')
const EventEmitter = require('events').EventEmitter

/**
* internals
* @private
*/
var internals = {
  // for webtasks which are requested more than once
  sessionData: {},

  // logging
  logger: null,
  initLogger: function (isLogging) {
    internals.logger = new LogWrap(isLogging).logger
  },

  // alias
  emitAsync: Intern.emitAsync,

  // some internal contants
  EVENT_COMPLETE: 'complete'
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

  internals.mergeSecrets(construct, cmdOptions, wtSecrets)

  // proces the task
  var taskReq = new TaskRequest(construct, cmdOptions)

  taskReq.once(internals.EVENT_COMPLETE, function (err, data) {
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

// Merge the webtask.io secrets with the runtime request options
internals.mergeSecrets = function (construct, cmdOptions, wtSecrets) {
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
internals.getSpotter = function (options, runArgs) {
  let session = internals.sessionData
  let spotter = null

  // If webtask.io is still using the same recent container the session exists
  if (session.hasOwnProperty('sessionSpotter')) {
    spotter = session.sessionSpotter.spotter
    internals.logger.info('reusing session spotter: ', true)

    // Representing the spotter which already exist, send an Initialized event
    let rcData = { state: Const.STATE_READY }
    Intern.emitAsync.call(spotter, Const.EVENT_INITIALIZED, null, rcData)
  } else {
    options.isLogging = runArgs.isLogging
    spotter = new SpotSpec(options)

    // save the spotter instance for session lifetime reuse
    session.sessionSpotter = { 'spotter': spotter }
  }

  return spotter
}

internals.runTask = function (spotter, runOptions) {
  if (!runOptions.hasOwnProperty('task')) {
    return (new Error('Missing task name in attributes'))
  }
  let task = runOptions.task
  delete runOptions.task  // do not pollute real aws options

  if (task === 'price') {
    // now make the price request
    this.price(spotter, runOptions)
  } else if (task === 'launch') {
    this.launch(spotter, runOptions)
  }
}

/**
* Constructs a new webtask handler for the SpotSpec Library
* @constructor
*/
function TaskRequest (initOptions, runOptions) {
  EventEmitter.call(this)
  let self = this
  let spotter = internals.getSpotter(initOptions, runOptions)

  internals.initLogger(runOptions.isLogging)
  this.logger = internals.logger

  // the event handler for the SpotSpec
  spotter.once(Const.EVENT_INITIALIZED, function (err, initData) {
    if (err) {
      delete internals.sessionData.sessionSpotter
      let error = new Error('Failed to initialize: ' + JSON.stringify(err))

      Intern.emitAsync.call(self, internals.EVENT_COMPLETE, error)
    } else {
      console.log('Initialized event:\n', initData)
      internals.runTask.call(self, spotter, runOptions)
    }
  })
}
Util.inherits(TaskRequest, EventEmitter)

/**
* Make the price request
**/
TaskRequest.prototype.price = function (spotter, runOptions) {
  let self = this

  spotter.once(Const.EVENT_PRICED, function (err, pricesData) {
    // pass it along
    let rcData = {
      event: Const.EVENT_PRICED,
      data: pricesData
    }

    Intern.emitAsync.call(self, internals.EVENT_COMPLETE, err, rcData)
  })

  // make the ec2 request
  spotter.prices(runOptions)
}

/**
* Make the launch request
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

  spotter.once(Const.EVENT_LAUNCHED, function (err, launchedData) {
    // pass it along
    let rcData = {
      event: Const.EVENT_LAUNCHED,
      data: launchedData
    }

    Intern.emitAsync.call(self, internals.EVENT_COMPLETE, err, rcData)
  })

  // make the ec2 request
  spotter.launch(options, specs)
}
