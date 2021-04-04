#! /usr/bin/env node
const commander = require('commander');

const { writeFiles } = require('@stackbit/stackbit-pull-core');
const { pull } = require('./datocms');

module.exports = {
    pull
};

if (require.main === module) {
    commander
        .option('--ssg <ssg>', '[required] Which SSG are you using [jekyll, hugo, gatbsby]')
        .option('--datocms-access-token <datocmsAccessToken>', '[required] DatoCMS access token')
        .parse(process.argv);

    const ssgType = commander['ssg'];
    if (!ssgType) {
        commander.help((helpText) => helpText + `\nError: '--ssg' argument must be specified\n\n`);
    }

    const accessToken = process.env['DATOCMS_ACCESS_TOKEN'] || commander['datocmsAccessToken'];
    if (!accessToken) {
        commander.help((helpText) => helpText + `\nError: '--datocms-access-token' argument must be specified\n\n`);
    }

    pull(ssgType, accessToken, {})
        .then((response) => {
            return writeFiles(response);
        })
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
