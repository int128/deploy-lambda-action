import assert from 'node:assert'
import * as fs from 'node:fs/promises'
import * as core from '@actions/core'
import {
  Architecture,
  CreateAliasCommand,
  type CreateAliasCommandInput,
  type CreateAliasCommandOutput,
  LambdaClient,
  ResourceConflictException,
  UpdateAliasCommand,
  type UpdateAliasCommandInput,
  type UpdateAliasCommandOutput,
  UpdateFunctionCodeCommand,
  waitUntilPublishedVersionActive,
} from '@aws-sdk/client-lambda'

type Inputs = {
  functionName: string
  imageURI?: string
  zipPath?: string
  architecture?: string
  aliasName?: string
  aliasDescription?: string
}

type Outputs = {
  functionVersion: string
  functionVersionARN: string
  functionAliasARN?: string
}

export const run = async (inputs: Inputs): Promise<Outputs> => {
  const client = new LambdaClient({})
  const updatedFunction = await updateFunctionCode(client, inputs)
  const functionVersion = updatedFunction.Version
  const functionVersionARN = updatedFunction.FunctionArn
  core.info(`Published version ${functionVersion}`)
  core.info(`Available version ${functionVersionARN}`)
  assert(functionVersion)
  assert(functionVersionARN)

  if (!inputs.aliasName) {
    return { functionVersion, functionVersionARN }
  }
  core.info(`Waiting for version ${functionVersion} to be active`)
  await waitUntilPublishedVersionActive(
    { client, maxWaitTime: 300 },
    { FunctionName: inputs.functionName, Qualifier: functionVersion },
  )
  const alias = await createOrUpdateAlias(client, {
    FunctionName: inputs.functionName,
    FunctionVersion: functionVersion,
    Name: inputs.aliasName,
    Description: inputs.aliasDescription,
  })
  const functionAliasARN = alias.AliasArn
  core.info(`Available alias ${functionAliasARN}`)
  assert(functionAliasARN)
  return { functionVersion, functionVersionARN, functionAliasARN }
}

const updateFunctionCode = async (client: LambdaClient, inputs: Inputs) => {
  if (inputs.zipPath) {
    core.info(`Updating function ${inputs.functionName} to archive ${inputs.zipPath}`)
    const zipFile = await fs.readFile(inputs.zipPath)
    return await client.send(
      new UpdateFunctionCodeCommand({
        FunctionName: inputs.functionName,
        ZipFile: zipFile,
        Publish: true,
        Architectures: parseArchitecture(inputs.architecture),
      }),
    )
  }
  if (inputs.imageURI) {
    core.info(`Updating function ${inputs.functionName} to image ${inputs.imageURI}`)
    return await client.send(
      new UpdateFunctionCodeCommand({
        FunctionName: inputs.functionName,
        ImageUri: inputs.imageURI,
        Publish: true,
        Architectures: parseArchitecture(inputs.architecture),
      }),
    )
  }
  throw new Error(`either image-uri or zip-path must be set`)
}

const parseArchitecture = (architecture: string | undefined): Architecture[] | undefined => {
  if (!architecture) {
    return undefined
  }
  if (architecture === Architecture.x86_64 || architecture === Architecture.arm64) {
    return [architecture]
  }
  throw new Error(`architecture must be either ${Architecture.x86_64} or ${Architecture.arm64}: ${architecture}`)
}

const createOrUpdateAlias = async (
  client: LambdaClient,
  input: CreateAliasCommandInput & UpdateAliasCommandInput,
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
