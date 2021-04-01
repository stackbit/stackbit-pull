#! /usr/bin/env node
const _ = require('lodash');
const commander = require('commander');

const { writeFiles } = require('@stackbit/stackbit-pull-core');
const { pull } = require('./sanity');

module.exports = {
    pull
};

if (require.main === module) {
    commander
        .option('--ssg <ssg>', '[required] Which SSG are you using [jekyll, hugo, gatbsby]')
        .option('--sanity-project-id <sanityProjectId>', '[required] Sanity Project ID')
        .option('--sanity-access-token <sanityAccessToken>', '[required] Sanity access token')
        .option('--sanity-dataset <dataset>', '[optional] Sanity dataset')
        .parse(process.argv);

    const ssgType = commander['ssg'];
    if (!ssgType) {
        commander.help((helpText) => helpText + `\nError: '--ssg' argument must be specified\n\n`);
    }

    const sanityProjectId = process.env['SANITY_PROJECT_ID'] || commander['sanityProjectId'];
    if (!sanityProjectId) {
        commander.help((helpText) => helpText + `\nError: '--sanity-project-id' argument must be specified\n\n`);
    }

    const sanityAccessToken = process.env['SANITY_ACCESS_TOKEN'] || commander['sanityAccessToken'];
    if (!sanityAccessToken) {
        commander.help((helpText) => helpText + `\nError: '--sanity-access-token' argument must be specified\n\n`);
    }

    let dataset = process.env['SANITY_DATASET'] || commander['dataset'] || 'production';
    if (process.env['BRANCH'] && process.env['BRANCH_TO_DATASET']) {
        try {
            dataset = _.get(JSON.parse(process.env['BRANCH_TO_DATASET']), process.env['BRANCH'], dataset);
        } catch (err) {
            console.error('error parsing BRANCH_TO_DATASET', err);
        }
    }

    pull(sanityProjectId, ssgType, sanityAccessToken, { dataset })
        .then((response) => {
            return writeFiles(response);
        })
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
