# wt-aws-spotter
Manage EC2 spot instances using webtasks

#####Secure EC2 IAM user credentials in a webtask.io
As a proof of concept, create a webtask which gets the current spot price of a certain EC2 machine Instance Type. Once the webtask is proven and understood through these steps, a larger goal to fully manage EC2 spot instance will be possible.

1. Create an EC2 IAM user following this [aws guide](http://docs.aws.amazon.com/IAM/latest/UserGuide/Using_SettingUpUser.html#Using_CreateUser_console). Here are the quick steps:
  * Sign in to the [AWS Management Console](https://console.aws.amazon.com/iam/) and open the IAM console
  * In the navigation pane, choose **Users**, and then choose **Create New Users**
  * Enter a user name. Select **Generate an access key**. Choose **Create**
  * Once created, choose **Show User Security Credentials**. Save the creditials for the webtask. You will not have access to *this* secret access key again after you close

2. Attach a policy to limit the user permissions to specific AWS resources. For more information, see [Attaching Managed Policies](http://docs.aws.amazon.com/IAM/latest/UserGuide/policies_using-managed.html#attach-managed-policy-console). Assign a policy which only allows the spot history action. The following shows a good policy:
  ```
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Action": [
          "ec2:DescribeSpotPriceHistory"
        ],
        "Effect": "Allow",
        "Resource": "*",
        "Condition": {
          "Bool": { "aws:SecureTransport": "true" }
        }
      }
    ]
  }
  ```

3. If missed earlier, create and save new IAM user [access credentials](http://docs.aws.amazon.com/IAM/latest/UserGuide/ManagingCredentials.html#Using_CreateAccessKey)

4. Install and initialize the [webtask.io CLI](https://webtask.io/cli).

5. Create the webtask. Using this example, replace the {secret} in accessKeyId and secretAccessKey with the real IAM user's credentials.
  * Anything following the --secrets parameter is encrypted by webtask.io with AES256-CBC
  ```
  # Set to where the webtask code exists
  export WT_CODE=https://raw.githubusercontent.com/glennschler/wt-aws-spotter/master/wt-spotPricer.js
  ```

  * The optional exp=+10 parameter instructs the webtask to expire in 10 minutes
  ```
  export WT_URL=$(wt create $WT_CODE --exp=+10 --name ec2SpotTest \
  --secret wtData='{ "accessKeyId": "{secret}", "secretAccessKey": "{secret}" }')
  ```
  ```
  # Echo the previous commands output to view the webtask url
  echo $WT_URL
  ```

6. Now the webtask is available to execute remotely as a microservice. Make the request using the url which was output by the previous ```wt create```

  * Replace the arguments for "region" and "type" as needed
  * Request the URL which was created during the previous step
  * To format the output, optionally pipe the output to a python command as demonstrated here
  ```
  curl -s $WT_URL \
  -H "Content-Type: application/json" \
  -X POST -d '{"region":"us-west-1","type":"m3.medium"}' | python -mjson.tool
  ```
