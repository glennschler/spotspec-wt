var path = require('path')
var fs = require('fs')
var webpack = require('webpack')

var nodeModules = {}

fs.readdirSync(path.join(__dirname, './node_modules/awsspotter/node_modules'))
  .filter(function (x) {
    return ['.bin'].indexOf(x) === -1
  })
  .forEach(function (mod) {
    nodeModules[mod] = 'commonjs ' + mod
  })

var wtName = 'wt-spotter'
var libDir = path.join(__dirname, 'lib')
var buildDir = path.join(__dirname, 'build')
module.exports = {
  entry: path.join(libDir, wtName + '.js'),
  target: 'node',
  output: {
    path: buildDir,
    filename: wtName + '-packed.js'
  },
  plugins: [
    // prepend the entire output text with this text
    new webpack.BannerPlugin('module.exports =',
      { raw: true, entryOnly: false })
  ],
  module: {
  },
  externals: nodeModules
}
