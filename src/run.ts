import * as core from '@actions/core'
import {
  CreateAliasCommand,
  CreateAliasCommandInput,
  CreateAliasCommandOutput,
  LambdaClient,
  ResourceConflictException,
  UpdateAliasCommand,
  UpdateAliasCommandInput,
  UpdateAliasCommandOutput,
  UpdateFunctionCodeCommand,
} from '@aws-sdk/client-lambda'

type Inputs = {
  functionName: string
  image: string
  aliasName: string
  aliasDescription: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  const client = new LambdaClient({})

  core.info(`Updating function ${inputs.functionName} to ${inputs.image}`)
  const updatedFunction = await client.send(
    new UpdateFunctionCodeCommand({
      FunctionName: inputs.functionName,
      ImageUri: inputs.image,
      Publish: true,
    })
  )
  const functionVersion = updatedFunction.Version
  if (functionVersion === undefined) {
    throw new Error(`internal error: got undefined Version`)
  }
  core.info(`Published version ${functionVersion}`)

  if (!inputs.aliasName) {
    return
  }
  const alias = await createOrUpdateAlias(client, {
    FunctionName: inputs.functionName,
    FunctionVersion: functionVersion,
    Name: inputs.aliasName,
    Description: inputs.aliasDescription,
  })
  core.info(`Alias ${String(alias.AliasArn)} is available`)
}

const createOrUpdateAlias = async (
  client: LambdaClient,
  input: CreateAliasCommandInput & UpdateAliasCommandInput
): Promise<CreateAliasCommandOutput | UpdateAliasCommandOutput> => {
  core.info(`Creating alias ${String(input.Name)}`)
  try {
    return await client.send(new CreateAliasCommand(input))
  } catch (error) {
    if (error instanceof ResourceConflictException) {
      core.info(`Alias already exists: ${error.message}`)
      core.info(`Updating alias ${String(input.Name)}`)
      return await client.send(new UpdateAliasCommand(input))
    }
    throw error
  }
}
