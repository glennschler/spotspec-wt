# spotspec-wt
Manage Amazon Elastic Compute Cloud (Amazon EC2) spot instances using webtask.io

####  * * * warning * * *
This readme is a work in progress. The quick instructions are below

```
git clone https://github.com/glennschler/spotspec-wt.git
npm install

# The resulting `build\wt-spotter-packed.js` is file to be used when calling wt-create
npm run webpack
```

#### Get Started
As a proof of concept, create a webtask which requests the launches a given machine instance type in a given region. This will show that AWS Identity and Access Management (IAM) user credentials can be securely stored for use in a webtask. Once the webtask is proven and understood through these steps, a larger goal to fully manage EC2 spot instance will be possible.

1. Create an EC2 IAM user following this [aws guide](http://docs.aws.amazon.com/IAM/latest/UserGuide/Using_SettingUpUser.html#Using_CreateUser_console). Here are the quick steps:
  * Sign in to the [AWS Management Console](https://console.aws.amazon.com/iam/) and open the IAM console.
  * In the navigation pane, choose **Users**, and then choose **Create New Users**.
  * Enter a user name. Check **Generate an access key**, and choose **Create**.
  * Once created, choose **Show User Security Credentials**. Save the credentials for the webtask. You will not have access to *this* secret access key again after you close.

2. Attach a policy to limit the user permissions to specific AWS resources. For more information, see [Attaching Managed Policies](http://docs.aws.amazon.com/IAM/latest/UserGuide/policies_using-managed.html#attach-managed-policy-console). Assign a policy which only allows the spot price history action. The [spotspec](https://github.com/glennschler/spotspec) README shows a good policy. This is a shorter example:
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
    {
      "Action": [ "ec2:DescribeSpotPriceHistory" ],
      "Effect": "Allow",
      "Resource": "*",
      "Condition": {
        "Bool": { "aws:SecureTransport": "true" },
        "StringEquals": {
          "ec2:Region": [ "us-east-1", "us-west-2" ]
        }
      }
    }]
  }
  ```

4. NPM install command has already installed. Now initialize, if not already.
  * There are detailed instructions at https://webtask.io/cli.
  ```
  npm run wt-init
  ```

5. To create a webtask token, the webtask.io CLI command ```wt create``` will upload code along with the EC2 credentials. Both are encrypted and stored. This create command will return a url which represents the new webtask token. Even though the code and secrets are cryptographically protected, the webtask token url still needs be well protected.
  * The EC2 IAM policy specified above is an additional level of protection, since it does not allow actions which might incur AWS cost.
  * The code uploaded in this example is part of this repository, so is publicly available for your review. Understand that any code that is used to create a webtask token needs to be trusted with **your** user's IAM credentials.

  ```bash
  # Set to where the webtask code exists. This is a file in this repository
  export WT_GITHUB=.

  # The file which was created with the `npm run webpack` command
  export WT_CODE=$WT_GITHUB/build/wt-spotter-packed.js
  ```

  * In this JSON string replace the enclosed {secret} in both the accessKeyId and secretAccessKey with the real IAM user's credentials. Plus the optional aws MFA token device serial numbers
  ```bash
  export WT_SECRET='{"accessKeyId":"{secret}","secretAccessKey":"{secret}","serialNumber":"{serialNumber:arn....}"}'
  ```

  * Call the webtask.io CLI command ```wt create```.
  * The optional exp=+10 parameter instructs the webtask token to expire in 10 minutes.
  * The above JSON $WT_SECRET is sent using the wt --secret parameter.

  ```bash
  export WT_OPTS='--exp=+10'

  # This will do this -> export WT_URL=$(wt create $WT_CODE $WT_OPTS --secret wtData=$WT_SECRET)
  npm run wt-create
  ```

  ```bash
  # Echo the previous output to view the created webtask token url
  $ echo $WT_URL
  ```
  >
  ```bash
  https://webtask.it.auth0.com/api/run/{container}/{jt-name}?webtask_no_cache=1
  ```

6. Now the webtask request is available to execute remotely as a microservice.

  * Replace the post data JSON arguments "region" and "type" as needed.
  * Request the $WT_URL which was created during the previous ```wt create``` step.
  * To format the output, optionally pipe the output to a python command as demonstrated here.

  ```bash

  # Every minute the token code changes
  export WT_TOKEN=123456

  # send the request
  curl -s $WT_URL --trace-ascii "./out.log" \
  -H "Content-Type: application/json" \
  -X POST -d \ '{"construct":{"keys":{"region":"us-west-1"},"upgrade":{"tokenCode":"'$WT_TOKEN'"}},"attributes":{"type":"m3.large","dryRun":"false","isLogging":"true","ami":"ami-d5ea86b5","keyName":"yourKeyName","securityGroups":[],"fileUserData":"node_modules/spotspec/test/userDataDockerAWSLinux.txt","price":"0.0083","task":"launch"}}' | python -mjson.tool
  ```
  >
  ```bash
    {
      "code": 400,
      "details": "Error: Failed to initialize: {\"message\":\"MultiFactorAuthentication failed with invalid MFA one time pass code......
  }
  ```
