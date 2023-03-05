import * as core from '@actions/core'
import { run } from './run'

const main = async (): Promise<void> => {
  const outputs = await run({
    functionName: core.getInput('function-name', { required: true }),
    imageURI: core.getInput('image', { required: true }),
    aliasName: core.getInput('alias-name'),
    aliasDescription: core.getInput('alias-description'),
  })
  core.setOutput('function-version', outputs.functionVersion)
  core.setOutput('function-version-arn', outputs.functionVersionARN)
  core.setOutput('function-alias-arn', outputs.functionAliasARN)
}

main().catch((e) => core.setFailed(e instanceof Error ? e : String(e)))
