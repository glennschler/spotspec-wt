/*
* This is an cli test harness for verifiying the AwsSpotter
*
*/
var AwsSpotter = require('../');

if (process.argv.length < 5) {
  console.log('Expected [accessKeyId] [secretAccessKey] [region]');
  return;
}

var awsCredentials = {
  accessKeyId: process.argv[2], // IAM user credentials
  secretAccessKey: process.argv[3], // IAM user credentials
  region: process.argv[4]
};

var type = 'm3.medium';
var isLogging = true;

var spotter = new AwsSpotter(awsCredentials, isLogging);
spotter.spotPrices(type);

spotter.on('prices', function (data) {
  console.log('prices event fired:\n', data);
  exit();
});

spotter.on('error', function (err) {
  console.log('prices err: ' + err);
  exit();
});

var exit = function () {
  spotter = null;
  setTimeout(function() {
    console.log('Exiting.');
    process.exit(0);
  }, 100);
};
