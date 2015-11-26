'use strict'

/**
* Helper merge webtask secrets into a json string
*/
const ParseArgs = require('yargs')

let argv = ParseArgs.demand('userData')
            .alias('u', 'userData')
            .demand('accessKeyId')
            .alias('a', 'accessKeyId')
            .demand('secretAccessKey')
            .alias('s', 'secretAccessKey')
            .demand('serialNumber')
            .alias('n', 'serialNumber')
            .describe('a', 'AWS accessKeyId')
            .describe('s', 'AWS accessKeyId')
            .describe('n', 'MFA device serialNumber')
            .describe('u', 'Base64 cloud-init user data')
            .argv

if (!argv) {
  process.exit(0)
}

let json = {
  accessKeyId: argv.a,
  secretAccessKey: argv.s,
  serialNumber: argv.n,
  userData: argv.u
}
console.log(JSON.stringify(json))
