# spotspec-wt
Manage Amazon Elastic Compute Cloud (Amazon EC2) spot instances using webtask.io

####  * * * warning * * *
This is a work in progress. The quick instructions are below.
Developed with Node version 5.x. Not yet on Windows. Webpack, and the wt-cli babel option make it possible to run as a webtask.io container

```
git clone https://github.com/glennschler/spotspec-wt.git
npm install
```

#### Get Started
As a proof of concept, create a webtask which launches a given machine instance type in a given region. This will show that AWS Identity and Access Management (IAM) user credentials can be securely stored for use in a webtask. Once the webtask is proven and understood through these steps, a larger goal to fully manage EC2 spot instance will be possible.

1. Webpack the `./lib/wt-spotter.js` to a single file which is required by webtask.io. The resulting `build/wt-spotter-packed.js` is file to be used when calling wt-create.
  ```
  npm run webpack
  ```

1. NPM install command has already installed all dependencies locally. Now initialize wt-cli, if it has not been done in the past.
  * There are detailed instructions at https://webtask.io/cli.
  ```
  npm run wt-init
  ```

1. Create an EC2 IAM user following this [aws guide](http://docs.aws.amazon.com/IAM/latest/UserGuide/Using_SettingUpUser.html#Using_CreateUser_console). Here are the quick steps:
  * Sign in to the [AWS Management Console](https://console.aws.amazon.com/iam/) and open the IAM console.
  * In the navigation pane, choose **Users**, and then choose **Create New Users**.
  * Enter a user name. Check **Generate an access key**, and choose **Create**.
  * Once created, choose **Show User Security Credentials**. Save the credentials for the webtask. You will not have access to *this* secret access key again after you close.

  * Attach a policy to limit the user permissions to specific AWS resources. For more information, see [Attaching Managed Policies](http://docs.aws.amazon.com/IAM/latest/UserGuide/policies_using-managed.html#attach-managed-policy-console). Assign a policy which only allows the spot request action. The [spotspec](https://github.com/glennschler/spotspec#example-aws-iam-policy-to-price-and-launch) README shows a good policy. Here is a much shorter example:
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
    {
      "Action": [ "ec2:RequestSpotInstances" ],
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

5. To create a webtask token, the webtask.io CLI command ```wt create``` uploads code along with the EC2 credentials. Both are encrypted and stored. This create command returns a url which represents the new webtask token. Even though the code and secrets are cryptographically protected, the created webtask token url still needs be well protected.
  * A well formed EC2 IAM policy, such as specified above, is an additional level of protection to restrict access.
  * The code uploaded in this example is part of this repository and it's dependencies, so is publicly available for your review. Understand that any code that is used to create a webtask token needs to be trusted with **your** IAM credentials.

  ```bash
  # Set to where the webtask code exists. This is a file in this repository
  export WT_GITHUB=.

  # The file which was created with the `npm run webpack` command
  export WT_CODE=$WT_GITHUB/build/wt-spotter-packed.js
  ```

  * In this JSON string replace the enclosed {secret} in both the accessKeyId and secretAccessKey with the real IAM user's credentials. Plus the optional aws MFA token device serial numbers

  ```bash
  # Prepare base64 encoded cloud-init user data to launch with the new AWS instances
  export WT_USERDATA=$(npm run -s encodeFn -- node_modules/spotspec/test/userDataDockerAWSLinux.txt)

  export WT_SECRET=$(npm run -s toJson -- --accessKeyId==<<secret>> \
  --secretAccessKey=<<secret>> --serialNumber==<<secret>> \
  --userData=$WT_USERDATA)
  ```

  * Call the webtask.io CLI command ```wt create```.
  * The optional exp=+10 parameter instructs the webtask token to expire in 10 minutes. Only when evaluating these steps.
  * The above JSON $WT_SECRET is sent using the wt --secret parameter.

  ```bash
  export WT_OPTS='--exp=+10'

  # This will do this -> wt create $WT_CODE $WT_OPTS --secret wtData=$WT_SECRET
  npm run -s wt-create > wt-create.log
  ```

  ```bash
  # Echo the previous output to view the created webtask token url
  echo wt-create.log
  ```
  >```bash
    https://webtask.it.auth0.com/api/run/{container}/{jt-name}?webtask_no_cache=1
    ```

6. Now the webtask request is available to execute remotely, and repeatedly. This example shows using the `CURL` command line. Another better example is an IFTTT recipe which makes a similar HTTP request, though instead is triggered by an incoming SMS or email.

  * Replace the post data JSON arguments "region", "type", "price", etc... as needed.
  * Request the $WT_URL which was created during the previous ```wt create``` step.
  * To format the output, optionally pipe the output to a python command as demonstrated here.

  ```json

  # Every minute the token code changes
  export WT_TOKEN=123456

  # send the LAUNCH task request
  curl -s $(cat wt-create.log) --trace-ascii "./out.log" \
  -H "Content-Type: application/json" \
  -X POST -d \ '{"construct":{"keys":{"region":"us-west-1"},"upgrade":{"tokenCode":"'$WT_TOKEN'"}},"attributes":{"type":"m3.large","dryRun":"false","isLogging":"true","ami":"ami-d5ea86b5","keyName":"yourKeyName","securityGroups":[],"price":"0.0083","task":"launch"}}' \
  | python -mjson.tool
  ```
  >```json
    {
        "code": 400,
        "details": "Error: Failed to initialize: {\"message\":\"MultiFactorAuthentication failed with invalid MFA one time pass code......
    }
    ```
