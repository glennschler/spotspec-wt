var path = require('path')
var fs = require('fs')

var nodeModules = {}
fs.readdirSync('node_modules')
  .filter(function (x) {
    return ['.bin'].indexOf(x) === -1
  })
  .forEach(function (mod) {
    nodeModules[mod] = 'commonjs ' + mod
  })

fs.readdirSync('../node_modules')
  .filter(function (x) {
    return ['.bin'].indexOf(x) === -1
  })
  .forEach(function (mod) {
    nodeModules[mod] = 'commonjs ' + mod
  })

var wtName = 'wt-spotter'
module.exports = {
  entry: './lib/' + wtName + '.js',
  target: 'node',
  output: {
    path: path.join(__dirname, 'lib'),
    filename: wtName + '-packed.js'
  },
  module: {
  },
  externals: nodeModules
}
