'use strict'

/**
* Helper utility to convert file text to base64-ecoded
*/
const ParseArgs = require('yargs')
const Fs = require('fs')
const Path = require('path')

let argv = ParseArgs.demand('file')
            .alias('f', 'file')
            .describe('f', 'Base64 encode a file').argv

if (!argv || !argv.f) {
  process.exit(0)
}

let fileName = Path.join(__dirname, '..', argv.f)

// must send base64 to AWS
Fs.readFile(fileName, 'base64', function (err, userData) {
  if (err) {
    console.error(err || 'No userData')
  } else {
    console.info(userData)
  }
})
