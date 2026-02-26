import {
  CreateAliasCommand,
  LambdaClient,
  ResourceConflictException,
  UpdateAliasCommand,
  UpdateFunctionCodeCommand,
} from '@aws-sdk/client-lambda'
import { mockClient } from 'aws-sdk-client-mock'
import { expect, it } from 'vitest'
import { run } from '../src/run.js'

it('creates a function with a container image for a new alias', async () => {
  const lambdaClientMock = mockClient(LambdaClient)
  lambdaClientMock.on(UpdateFunctionCodeCommand).resolves({
    Version: '3',
    FunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:my-function:3',
  })
  lambdaClientMock.on(CreateAliasCommand).resolves({
    AliasArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:my-function:pr-123',
  })

  await expect(
    run({
      imageURI: '123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/my-image',
      functionName: 'my-function',
      aliasName: 'pr-123',
      aliasDescription: 'ref=refs/heads/main,sha=0123456789abcdef',
    }),
  ).resolves.toStrictEqual({
    functionVersion: '3',
    functionVersionARN: 'arn:aws:lambda:ap-northeast-1:123456789012:function:my-function:3',
    functionAliasARN: 'arn:aws:lambda:ap-northeast-1:123456789012:function:my-function:pr-123',
  })
})

it('creates a function with a zip file for a new alias', async () => {
  const lambdaClientMock = mockClient(LambdaClient)
  lambdaClientMock.on(UpdateFunctionCodeCommand).resolves({
    Version: '3',
    FunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:my-function:3',
  })
  lambdaClientMock.on(CreateAliasCommand).resolves({
    AliasArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:my-function:pr-123',
  })

  await expect(
    run({
      zipPath: `${__dirname}/fixtures/main.zip`,
      functionName: 'my-function',
      aliasName: 'pr-123',
      aliasDescription: 'ref=refs/heads/main,sha=0123456789abcdef',
    }),
  ).resolves.toStrictEqual({
    functionVersion: '3',
    functionVersionARN: 'arn:aws:lambda:ap-northeast-1:123456789012:function:my-function:3',
    functionAliasARN: 'arn:aws:lambda:ap-northeast-1:123456789012:function:my-function:pr-123',
  })
})

it('updates an existing alias', async () => {
  const lambdaClientMock = mockClient(LambdaClient)
  lambdaClientMock.on(UpdateFunctionCodeCommand).resolves({
    Version: '3',
    FunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:my-function:3',
  })
  lambdaClientMock.on(CreateAliasCommand).rejects({
    // See the actual payload: https://github.com/int128/deploy-lambda-action/issues/1137
    name: 'ResourceConflictException',
    message: 'ResourceConflictException',
    $metadata: {
      httpStatusCode: 409,
      requestId: '01234567-89ab-cdef-0123-456789abcdef',
      attempts: 1,
    },
    $fault: 'client',
    Type: 'User',
  })
  lambdaClientMock.on(UpdateAliasCommand).resolves({
    AliasArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:my-function:pr-123',
  })

  await expect(
    run({
      imageURI: '123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/my-image',
      functionName: 'my-function',
      aliasName: 'pr-123',
      aliasDescription: 'ref=refs/heads/main,sha=0123456789abcdef',
    }),
  ).resolves.toStrictEqual({
    functionVersion: '3',
    functionVersionARN: 'arn:aws:lambda:ap-northeast-1:123456789012:function:my-function:3',
    functionAliasARN: 'arn:aws:lambda:ap-northeast-1:123456789012:function:my-function:pr-123',
  })
})
