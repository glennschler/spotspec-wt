#! /usr/bin/env bash
#
# A quick helper, to demonstate the README instructions
#
export STR_MAN="wt-spotPricer accessKeyId secretAccessKey [ec2-region] [instance-type]"
export WT_EC2_REGION="us-east-1"      # a default
export WT_INSTANCE_TYPE="m3.medium"   # a default

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

# just in case there are old var values in the shell
export WT_SECRET=
export WT_URL=
export WT_GITHUB=https://raw.githubusercontent.com/glennschler
export WT_CODE=$WT_GITHUB/wt-aws-spotter/master/wt-aws-spotter.js
export WT_SECRET='{"accessKeyId":"'$1'","secretAccessKey":"'$2'"}'
export WT_OPTS='--exp=+10'
export WT_URL=$(wt create $WT_CODE $WT_OPTS --secret wtData=$WT_SECRET)
echo $WT_URL

curl -s $WT_URL \
-H "Content-Type: application/json" \
-X POST -d '{"region":"'$WT_EC2_REGION'","type":"'$WT_INSTANCE_TYPE'"}' | python -mjson.tool
