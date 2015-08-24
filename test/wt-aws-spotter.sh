#! /usr/bin/env bash
#
# A quick helper, to demonstate the README instructions
#
export STR_MAN="wt-spotPricer accessKeyId secretAccessKey [serialNumber] [tokenCode]"
export WT_EC2_REGION="us-east-1"      # a default
export WT_INSTANCE_TYPE="m3.medium"   # a default
export WT_DRY_RUN=false   # a default

if [ $# -lt 2 ]; then
  echo $STR_MAN
  exit
elif [ $# -lt 3 ]; then
  echo $STR_MAN
  echo 'missing MFA [serialNumber]'
  export WT_SERIALNUMBER=''
elif [ $# -lt 4 ]; then
  echo $STR_MAN
  echo 'missing MFA [tokenCode]'
  export WT_SERIALNUMBER=''
  export WT_TOKEN_CODE=''
else
  export WT_SERIALNUMBER=$3
  export WT_TOKEN_CODE=$4
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
export WT_SECRET='{"accessKeyId":"'$1'","secretAccessKey":"'$2'","serialNumber":"'$WT_SERIALNUMBER'"}'
export WT_OPTS='--exp=+10'
export WT_URL=$(wt create $WT_CODE $WT_OPTS --secret wtData=$WT_SECRET)
echo $WT_URL

curl -s $WT_URL \
-H "Content-Type: application/json" \
-X POST -d '{"construct":{"keys":{"region":"'$WT_EC2_REGION'"},"upgrade":{"tokenCode":"'$WT_TOKEN_CODE'"}},'\
'"attributes":{"type":"'$WT_INSTANCE_TYPE'","dryRun":"'$WT_DRY_RUN'","isLogging":"false"}}' | python -mjson.tool

echo "Testing with a second request to reuse the previous spotter object"
curl -s $WT_URL \
-H "Content-Type: application/json" \
-X POST -d '{"construct":{"reusePastSession":true},'\
'"attributes":{"type":"m3.large","dryRun":"'$WT_DRY_RUN'","isLogging":"false "}}' | python -mjson.tool
