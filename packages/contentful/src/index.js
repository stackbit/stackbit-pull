#! /usr/bin/env node
const _ = require('lodash');
const commander = require('commander');

const { writeFiles } = require('@stackbit/stackbit-pull-core');
const { pull } = require('./contentful');

module.exports = {
    pull
};

if (require.main === module) {
    commander
        .option('--ssg <ssg>', '[required] Which SSG are you using [jekyll, hugo, gatbsby]')
        .option('--contentful-space-id <contentfulSpaceId>', '[required] Contentful Space ID')
        .option('--contentful-access-token <contentfulAccessToken>', '[required] Contentful access token')
        .option('--contentful-environment <contentfulEnvironment>', '[optional] Contentful environment')
        .parse(process.argv);

    const ssgType = commander['ssg'];
    if (!ssgType) {
        commander.help((helpText) => helpText + `\nError: '--ssg' argument must be specified\n\n`);
    }

    const spaceId = process.env['CONTENTFUL_SPACE_ID'] || commander['contentfulSpaceId'];
    if (!spaceId) {
        commander.help((helpText) => helpText + `\nError: '--contentful-space-id' argument must be specified\n\n`);
    }

    const accessToken = process.env['CONTENTFUL_ACCESS_TOKEN'] || commander['contentfulAccessToken'];
    if (!accessToken) {
        commander.help((helpText) => helpText + `\nError: '--contentful-access-token' argument must be specified\n\n`);
    }

    let environment = process.env['CONTENTFUL_ENVIRONMENT'] || commander['contentfulEnvironment'] || 'master';
    if (process.env['BRANCH'] && process.env['BRANCH_TO_ENVIRONMENT']) {
        try {
            environment = _.get(JSON.parse(process.env['BRANCH_TO_ENVIRONMENT']), process.env['BRANCH'], environment);
        } catch (err) {
            console.error('error parsing BRANCH_TO_ENVIRONMENT', err);
        }
    }

    pull(spaceId, ssgType, accessToken, { environment })
        .then((response) => {
            return writeFiles(response);
        })
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
