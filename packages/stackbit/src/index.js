#! /usr/bin/env node
const commander = require('commander');

const { writeFiles } = require('@stackbit/stackbit-pull-core');
const { pull } = require('./stackbit');

module.exports = {
    pull
};

if (require.main === module) {
    commander
        .option('--stackbit-pull-api-url <stackbitPullApiUrl>', '[required] stackbit pull API URL')
        .option(
            '--stackbit-api-key <stackbitApiKey>',
            '[required] stackbit API key, can be also specified through STACKBIT_API_KEY environment variable'
        )
        .option('--environment <environment>', '[optional] environment to pull data for')
        .parse(process.argv);

    const stackbitPullApiUrl = commander['stackbitPullApiUrl'];
    const apiKey = process.env['STACKBIT_API_KEY'] || commander['stackbitApiKey'];

    // Environment to pull data for, defaults to Netlify's BRANCH
    const environment = commander['environment'] || process.env['BRANCH'];

    if (!stackbitPullApiUrl) {
        commander.help((helpText) => helpText + `\nError: '--stackbit-pull-api-url' argument must be specified\n\n`);
    }

    if (!apiKey) {
        commander.help(
            (helpText) => helpText + `\nError: either '--stackbit-api-key' argument or 'STACKBIT_API_KEY' must be specified\n\n`
        );
    }

    console.log(`fetching data for project from ${stackbitPullApiUrl}`);

    pull({ stackbitPullApiUrl, apiKey, environment })
        .then((response) => {
            return writeFiles(response);
        })
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
