#! /usr/bin/env bash
#
if [ $# -lt 2 ]; then
  echo "wt-spotPricer accessKeyId secretAccessKey [ec2-region]"
  exit
fi

if [ $# -lt 3 ]; then
  echo "wt-spotPricer accessKeyId secretAccessKey [ec2-region]"
  echo "missing [ec2-region]"
  export WT_EC2_REGION="us-east-1"
  echo "ec2-region defaulted to $WT_EC2_REGION"
else
  export WT_EC2_REGION=$3
fi

# just in case there are old var values in the shell
export WT_SECRET=
export WT_URL=
export WT_GITHUB=https://raw.githubusercontent.com/glennschler
export WT_CODE=$WT_GITHUB/wt-aws-spotter/master/wt-aws-spotter.js
export WT_SECRET='{"accessKeyId":"'$1'","secretAccessKey":"'$2'"}'
export WT_OPTS='--exp=+10 --name ec2SpotTest'
export WT_URL=$(wt create $WT_CODE $WT_OPTS --secret wtData=$WT_SECRET)
echo $WT_URL

curl -s $WT_URL \
-H "Content-Type: application/json" \
-X POST -d '{"region":"'$WT_EC2_REGION'","type":"m3.medium"}' | python -mjson.tool
