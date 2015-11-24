var path = require('path')
var fs = require('fs')
var webpack = require('webpack')

var nodeModules = {}

// Handle node_modules for npm@3 and npm@2. Flat or tree node_modules
var recurseExternals = function (curDir, dirName) {
  var joinedDir = path.join(curDir, dirName)
  fs.readdirSync(joinedDir)
    .filter(function (x) {
      return ['.bin'].indexOf(x) === -1
    })
    .forEach(function (mod) {
      // Do not exclude module 'spotspec'. PACK IT!
      // since webtask.io does not have in it's module registry
      if (mod !== 'spotspec') {
        nodeModules[mod] = 'commonjs ' + mod
      }

      var treeMods = path.join(joinedDir, mod)

      try {
        recurseExternals(treeMods, 'node_modules')
      } catch (err) {
        // nop. The top of the tree has been reached
      }
    })
}

// recurse through the node_modules tree (or not if node v5 flat structure)
recurseExternals(__dirname, 'node_modules')

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
