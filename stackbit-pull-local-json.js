#!/usr/bin/env node

const commander = require('commander');
const { createFromLocalJsonFile } = require('./stackbit-pull');

if (require.main === module) {
    commander
        .option('--json-file <json-file>', '[required] local json file')
        .parse(process.argv);

    const jsonFile = commander['jsonFile'];

    if (!jsonFile) {
        commander.help(
            (helpText) => `${helpText}
Error: '--json-file' argument must be specified\n\n`
        );
    }

    console.log(`creating files from local json file ${jsonFile}`);

    return createFromLocalJsonFile(jsonFile);
}
