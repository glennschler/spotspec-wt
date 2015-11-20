var path = require('path')
var fs = require('fs')
var webpack = require('webpack')

var nodeModules = {}

fs.readdirSync(path.join(__dirname, './node_modules'))
  .filter(function (x) {
    return ['.bin'].indexOf(x) === -1
  })
  .forEach(function (mod) {
    // Do not exclude module 'spotspec'. PACK IT!
    // since webtask.io does not have in it's module registry
    if (mod !== 'spotspec') {
      nodeModules[mod] = 'commonjs ' + mod
    }
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
    // prefix the entire output text with this text
    new webpack.BannerPlugin('"use latest"\n' +
          'global.Object.assign = global.Object.assign ||' +
          ' require("object-assign")\nmodule.exports =',
      { raw: true, entryOnly: false })
  ],
  externals: nodeModules
}
