# deploy-lambda-action [![ts](https://github.com/int128/deploy-lambda-action/actions/workflows/ts.yaml/badge.svg)](https://github.com/int128/deploy-lambda-action/actions/workflows/ts.yaml)

This is an action to update an existing Lambda function.

## Getting Started

Here is an example workflow to build and deploy a container image to Lambda function.

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v3
      - uses: aws-actions/configure-aws-credentials@v1
        with:
          role-to-assume: arn:aws:iam::ACCOUNT:role/ROLE
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

      - uses: int128/deploy-lambda-action@v1
        with:
          function-name: my-function
          image: ${{ steps.metadata.outputs.tags }}
```

## Specification

### Inputs

| Name | Default | Description
|------|----------|------------
| `function-name` | (required) | Lambda function name
| `image` | (required) | URI of container image, i.e., `ACCOUNT.dkr.ecr.REGION.amazonaws.com/NAME`
| `alias-name` | - | Alias name
| `alias-description` | - | Alias description

### Outputs

| Name | Description
|------|------------
| `example` | example output
