import { mockClient } from 'aws-sdk-client-mock'
import { CreateAliasCommand, LambdaClient, UpdateFunctionCodeCommand } from '@aws-sdk/client-lambda'
import { run } from '../src/run'

test('update function with new alias', async () => {
  const lambdaClientMock = mockClient(LambdaClient)
  lambdaClientMock.on(UpdateFunctionCodeCommand).resolves({
    Version: '3',
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
    })
  ).resolves.toBeUndefined()
})
