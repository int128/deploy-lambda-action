import * as core from '@actions/core'
import * as fs from 'fs/promises'
import {
  Architecture,
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
import assert from 'assert'

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
  if (!architecture) return undefined
  if (architecture === 'x86_64') return [architecture]
  if (architecture === 'arm64') return [architecture]
  throw new Error(`unknown architecture: ${architecture}`)
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
