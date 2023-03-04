import * as core from '@actions/core'
import { run } from './run'

const main = async (): Promise<void> => {
  await run({
    functionName: core.getInput('function-name', { required: true }),
    image: core.getInput('image', { required: true }),
    aliasName: core.getInput('alias-name'),
    aliasDescription: core.getInput('alias-description'),
  })
}

main().catch((e) => core.setFailed(e instanceof Error ? e : String(e)))
