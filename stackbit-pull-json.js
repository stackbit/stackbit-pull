#!/usr/bin/env node

const commander = require('commander')
const { createFromJsonFile } = require('./stackbit-pull')

if (require.main === module) {
  commander
      .option('--json-file <json-file>', '[required] json file')
      .parse(process.argv)

  const jsonFile = commander['jsonFile']

  if (!jsonFile) {
    commander.help(helpText => `${helpText}
Error: '--json-file' argument must be specified\n\n`)
  }
  
  console.log(`creating files from json file ${jsonFile}`)

  return createFromJsonFile(jsonFile)
}
