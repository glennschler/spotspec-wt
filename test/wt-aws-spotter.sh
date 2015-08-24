#! /usr/bin/env bash
#
# A quick helper, to demonstate the README instructions
#
export STR_MAN="wt-spotPricer accessKeyId secretAccessKey [ec2-region] [instance-type]"
export WT_EC2_REGION="us-east-1"      # a default
export WT_INSTANCE_TYPE="m3.medium"   # a default
export WT_DRY_RUN=false   # a default

if [ $# -lt 2 ]; then
  echo $STR_MAN
  exit
elif [ $# -lt 3 ]; then
  echo $STR_MAN
  echo "missing [ec2-region] and [instance-type]"
else
  export WT_EC2_REGION=$3
fi

if [ $# -lt 4 ]; then
  echo $STR_MAN
  echo "missing [instance-type]"
else
  export WT_INSTANCE_TYPE=$4
fi

echo "ec2-region set to $WT_EC2_REGION"
echo "instance-type set to $WT_INSTANCE_TYPE"
echo "dry-run set to $WT_DRY_RUN"

# just in case there are old var values in the shell
export WT_SECRET=
export WT_URL=

# Set to where the webtask code exists. This is a file in this repository
# change to WT_GITHUB=. if all the repository files are local
export WT_GITHUB=https://raw.githubusercontent.com/glennschler/wt-aws-spotter/master
#export WT_GITHUB=.
export WT_CODE=$WT_GITHUB/test/wt-spotter.js
export WT_SECRET='{"accessKeyId":"'$1'","secretAccessKey":"'$2'"}'
export WT_OPTS='--exp=+10'
export WT_URL=$(wt create $WT_CODE $WT_OPTS --secret wtData=$WT_SECRET)
echo $WT_URL

curl $WT_URL \
-H "Content-Type: application/json" \
-X POST -d '{"construct":{"keys":{"accessKeyId":"","secretAccessKey":"","region":"'$WT_EC2_REGION'"},"upgrades":{"serialNumber":"","tokenCode":""}},'\
'"attributes":{"type":"'$WT_INSTANCE_TYPE'","dryRun":"'$WT_DRY_RUN'","isLogging":"true"}}' | python -mjson.tool
#-X POST -d '{"region":"'$WT_EC2_REGION'","type":"'$WT_INSTANCE_TYPE'","dryRun":"'$WT_DRY_RUN'","isLogging":"true"}' | python -mjson.tool
#-X POST -d '{"constuct":{"hello":"world"}}'
