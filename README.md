# deploy-lambda-action [![ts](https://github.com/int128/deploy-lambda-action/actions/workflows/ts.yaml/badge.svg)](https://github.com/int128/deploy-lambda-action/actions/workflows/ts.yaml)

This is an action to deploy a code to an existing Lambda function.
It is equivalent to [`aws lambda update-function-code`](https://awscli.amazonaws.com/v2/documentation/api/latest/reference/lambda/update-function-code.html) command but works without AWS CLI installed.

## Getting Started

Before using this action, you need to create a Lambda function.
This action is designed to manage a function and code separately as follows:

- Manage a Lambda function with your IaC tool such as Terraform or CloudFormation.
- Deploy the function code in GitHub Actions.

### Deploy an archive

Here is an example to deploy a zip archive to a Lambda function.

```yaml
on:
  pull_request:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v6
      # Build an archive
      - run: zip dist.zip ...
      # Deploy a function
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::ACCOUNT:role/ROLE
          aws-region: REGION
      - uses: int128/deploy-lambda-action@v1
        with:
          function-name: my-function
          alias-name: ${{ github.event.pull_request.number && format('pr-{0}', github.event.pull_request.number) || github.ref_name }}
          alias-description: GitHub Actions ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
          zip-path: dist.zip
```

For pull_request events, it creates an alias of pull request number such as `pr-12345`.
For push events, it creates an alias of branch name such as `main` or `production`.

### Deploy a container image

Here is an example to deploy a container image to a Lambda function.

```yaml
on:
  pull_request:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v6
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::ACCOUNT:role/ROLE
          aws-region: REGION

      # Build a container image
      - uses: aws-actions/amazon-ecr-login@v1
        id: ecr
      - uses: docker/metadata-action@v4
        id: metadata
        with:
          images: ${{ steps.ecr.outputs.registry }}/${{ github.repository }}
          flavor: latest=false
      - uses: docker/build-push-action@v3
        with:
          push: true
          tags: ${{ steps.metadata.outputs.tags }}
          labels: ${{ steps.metadata.outputs.labels }}

      # Deploy a function
      - uses: int128/deploy-lambda-action@v1
        with:
          function-name: my-function
          image-uri: ${{ steps.metadata.outputs.tags }}
          alias-name: ${{ steps.metadata.outputs.version }}
          alias-description: GitHub Actions ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

This example creates an alias following the naming convention of [docker/metadata-action](https://github.com/docker/metadata-action).

For pull_request events, it creates an alias of pull request number such as `pr-12345`.
For push events, it creates an alias of branch name such as `main` or `production`.

## Terraform examples

### Lambda function

Here is an example of Lambda function with an archive.

```terraform
# Terraform
resource "aws_lambda_function" "example" {
  function_name = "example"
  role          = aws_iam_role.example_lambda.arn
  handler       = "main"
  runtime       = "provided.al2"

  # The function code is updated by GitHub Actions.
  filename = archive_file.dummy.output_path
  lifecycle {
    ignore_changes = [
      filename,
      publish,
    ]
  }
}

resource "aws_iam_role" "example_lambda" {
  name               = "example-lambda"
  assume_role_policy = data.aws_iam_policy_document.example_lambda_assume_role.json
}

data "aws_iam_policy_document" "example_lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "archive_file" "dummy" {
  type        = "zip"
  output_path = "dummy.zip"

  source {
    content  = "dummy"
    filename = "main"
  }
}
```

### GitHub Actions IAM role

This action requires the following permissions:

- `lambda:UpdateFunctionCode`
- `lambda:CreateAlias`
- `lambda:UpdateAlias`

Here is an example of IAM Role for GitHub Actions.

```terraform
# Terraform
resource "aws_iam_role" "github_actions_deploy_lambda" {
  name               = "github-actions-deploy-lambda"
  assume_role_policy = data.aws_iam_policy_document.github_actions_deploy_lambda_assume_role.json
}

data "aws_iam_policy_document" "github_actions_deploy_lambda_assume_role" {
  statement {
    principals {
      type        = "Federated"
      identifiers = ["arn:aws:iam::ACCOUNT:oidc-provider/token.actions.githubusercontent.com"]
    }
    actions = ["sts:AssumeRoleWithWebIdentity"]
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:OWNER/REPO:*"]
    }
  }
}

resource "aws_iam_role_policy" "github_actions_deploy_lambda" {
  role   = aws_iam_role.github_actions_deploy_lambda.id
  name   = "update-lambda"
  policy = data.aws_iam_policy_document.github_actions_deploy_lambda.json
}

data "aws_iam_policy_document" "github_actions_deploy_lambda" {
  statement {
    effect = "Allow"
    actions = [
      "lambda:UpdateFunctionCode",
      "lambda:CreateAlias",
      "lambda:UpdateAlias",
    ]
    resources = [
      "arn:aws:lambda:REGION:ACCOUNT:function:FUNCTION",
    ]
  }
}
```

## Specification

### Inputs

| Name                | Description                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `function-name`     | Name of the function                                                                                                                        |
| `image-uri`         | URI of the container image, i.e., `ACCOUNT.dkr.ecr.REGION.amazonaws.com/NAME:VERSION` or `ACCOUNT.dkr.ecr.REGION.amazonaws.com/NAME@DIGEST` |
| `zip-path`          | Path to the archive                                                                                                                         |
| `architecture`      | If set, update the architecture of the function. Either `x86_64` or `arm64` (optional)                                                      |
| `alias-name`        | If set, create or update the function alias (optional)                                                                                      |
| `alias-description` | Description of the function alias (optional)                                                                                                |

Either `image-uri` or `zip-path` must be set.

### Outputs

| Name                   | Description              |
| ---------------------- | ------------------------ |
| `function-version`     | Published version        |
| `function-version-arn` | ARN of published version |
| `function-alias-arn`   | ARN of alias             |
