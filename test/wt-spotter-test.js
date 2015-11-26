var WebTask = require('../build/wt-spotter-packed.js')

/**
* Constructs a new WebTaskRequestor to test wt-spotter (without sending to webtask.io)
* @constructor
*/
function WebTaskRequestor () {
  var body = {
    construct: {
      keys: {
        region: 'us-west-1'
      },
      upgrade: {
        tokenCode: '',
        'durationSeconds': '900'    // 15 minutes
      }
    },
    'attributes': {
      'task': 'launch',
      'launchSpecification': { 'Placement': { }
        // 'AvailabilityZone': 'us-west-2b' }
      },
      'count': 1,
      'keyName': 'ec2SFO',
      'securityGroups': ['Fibertel NQN ssh', 'Fibertel NQN vpn', 'Speedy Zp ssh', 'Speedy Zp vpn'],
      'ami': 'ami-d5ea86b5', // PDX='ami-f0091d91',
      'type': 'm3.medium',
      'dryRun': 'false',
      'isLogging': 'true',
      'price': '0.0082'
    }
  }

  var wtSecrets = {
    accessKeyId: process.argv[2],
    secretAccessKey: process.argv[3],
    serialNumber: process.argv[4] ? process.argv[4] : null
  }

  var nextArgV = 6
  if (wtSecrets.serialNumber === null) {
    delete wtSecrets.serialNumber
    delete body.construct.upgrade
    nextArgV = nextArgV - 1
  } else {
    body.construct.upgrade.tokenCode = process.argv[5] ? process.argv[5] : ''
  }

  // The WebTask "Context"
  var context = {
    body: JSON.stringify(body)
  }

  if (process.argv[nextArgV] != null) {
    var fs = require('fs')
    var fileName = process.argv[nextArgV]
    var self = this

    fileName = require('path').resolve(__dirname, fileName)

    // must send base64 to AWS
    fs.readFile(fileName, 'base64', function (err, userData) {
      if (err) {
        throw new Error(err)
      }

      // put the base64 userData in the secrets
      wtSecrets.userData = userData

      context.data = { wtData: JSON.stringify(wtSecrets) }

      self.sendTask(context)
    })
  } else {
    context.data = { wtData: JSON.stringify(wtSecrets) }

    this.sendTask(context)
  }
}

/**
* sendTask - Request a web task
* @arg {context}
*/
WebTaskRequestor.prototype.sendTask = function (context) {
  var task = new WebTask(context, function cb (err, data) {
    console.log('cb: ', err ? 'error: ' + err : '',
        data ? 'data:' + JSON.stringify(data) : '')
  })

  // a nop to remove standards lint warning
  if (!task.hasOwnProperty('standards')) {
    task = null
  }
}

/**
* main()
*/
var wtTest = new WebTaskRequestor()

// a nop to remove standards lint warning
if (!wtTest.hasOwnProperty('standards')) {
  wtTest = null
}
