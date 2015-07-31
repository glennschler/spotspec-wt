# wt-aws-spotter
Manage Amazon Elastic Compute Cloud (Amazon EC2) spot instances using webtask.io

####Get Started
As a proof of concept, create a webtask which requests the current spot price of a given machine instance type in a given region. This will show that AWS Identity and Access Management (IAM) user credentials can be securely stored for use in a webtask. Once the webtask is proven and understood through these steps, a larger goal to fully manage EC2 spot instance will be possible.

1. Create an EC2 IAM user following this [aws guide](http://docs.aws.amazon.com/IAM/latest/UserGuide/Using_SettingUpUser.html#Using_CreateUser_console). Here are the quick steps:
  * Sign in to the [AWS Management Console](https://console.aws.amazon.com/iam/) and open the IAM console.
  * In the navigation pane, choose **Users**, and then choose **Create New Users**.
  * Enter a user name. Check **Generate an access key**, and choose **Create**.
  * Once created, choose **Show User Security Credentials**. Save the credentials for the webtask. You will not have access to *this* secret access key again after you close.

2. Attach a policy to limit the user permissions to specific AWS resources. For more information, see [Attaching Managed Policies](http://docs.aws.amazon.com/IAM/latest/UserGuide/policies_using-managed.html#attach-managed-policy-console). Assign a policy which only allows the spot price history action. The following shows a good policy for this first goal:
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

3. If missed earlier or using an existing IAM user, create new [access credentials](http://docs.aws.amazon.com/IAM/latest/UserGuide/ManagingCredentials.html#Using_CreateAccessKey). Save the credentials for the webtask.

4. Install and initialize the webtask.io CLI. There are detailed instructions at https://webtask.io/cli.

5. To create a webtask token, the webtask.io CLI command ```wt create``` will upload code along with the EC2 credentials. Both are encrypted and stored, though represented as a url which can be executed as a webtask request in the future. Even though the code and secrets are cryptographically protected, the webtask token url still needs be well protected.
  * The EC2 IAM limit policy specified above is an additional level of protection, since it is does not allow actions which might incur AWS cost.
  * The code uploaded in this example is part of this repository, so is publicly available for your review. Understand that any code that is used to create a webtask token needs to be trusted with **your** user's IAM credentials.
  * This example sets a single --secret option as named parameter with a JSON string value. Replace the enclosed {secret} in both the accessKeyId and secretAccessKey with the real IAM user's credentials.
    ```bash
    # Set to where the webtask code exists. This is a file in this repository
    export WT_GITHUB=https://raw.githubusercontent.com/glennschler
    export WT_CODE=$WT_GITHUB/wt-aws-spotter/master/wt-spotPricer.js
    ```
    ```bash
    # Change the {secret} values to the real IAM credential values
    export WT_SECRET='{"accessKeyId":"{secret}","secretAccessKey":"{secret}"}'
    ```
  * Call the webtask.io CLI ```wt create```
  * The optional exp=+10 parameter instructs the webtask token to expire in 10 minutes
    ```bash
    export WT_OPTS='--exp=+10 --name ec2SpotTest'
    export WT_URL=$(wt create $WT_CODE $WT_OPTS --secret wtData=$WT_SECRET)
    ```
    ```bash
    # Echo the previous output to view the created webtask token url
    echo $WT_URL
    ```

6. Now the webtask request is available to execute remotely as a microservice.

  * Replace the post data JSON arguments "region" and "type" as needed
  * Request the WT_URL which was created during the previous ```wt create``` step
  * To format the output, optionally pipe the output to a python command as demonstrated here
  ```bash
  curl -s $WT_URL \
  -H "Content-Type: application/json" \
  -X POST -d '{"region":"us-west-2","type":"m3.medium"}' | python -mjson.tool
  ```
