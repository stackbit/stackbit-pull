#!/usr/bin/env node

const fse = require('fs-extra');
const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');
const yaml = require('js-yaml');
const toml = require('@iarna/toml');
const commander = require('commander');

function pull(options) {
    return new Promise((resolve, reject) => {
        const { stackbitPullApiUrl, ...bodyOptions } = options;
        const urlObject = url.parse(stackbitPullApiUrl);
        const body = JSON.stringify(bodyOptions);

        const requestOptions = {
            hostname: urlObject.hostname,
            path: urlObject.path,
            protocol: urlObject.protocol,
            port: urlObject.port || 443,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': body.length
            }
        };

        const req = https.request(requestOptions, (res) => {
            let data = '';
            res.on('data', chunk => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 404) {
                    return reject(new Error('Project not found'));
                }

                let response;

                try {
                    response = JSON.parse(data);
                } catch (err) {
                    return reject(new Error(`Failed to serialize response json`));
                }

                if (res.statusCode >= 400) {
                    return reject(new Error(`Failed to build project, statusCode: ${res.statusCode}, response: ${JSON.stringify(response)}`));
                }

                resolve(response);
            });
        });

        req.on('error', (e) => {
            reject(new Error(`Error fetching project build: ${e.message}`));
        });

        req.write(body);
        req.end();
    });
}

function mergeFile(fullPath, remoteData) {
    let localObj;

    try {
        localObj = parseFileSync(fullPath);
    } catch (err) {
        throw new Error(`Could not parse file at ${fullPath}\n${err}`);
    }

    if (localObj) {
        try {
            const remoteObj = parseDataByFilePath(remoteData, fullPath);
            const mergedData = Object.assign(localObj, remoteObj);
            return stringifyDataByFilePath(mergedData, fullPath);
        } catch (err) {
            throw new Error(`Could not merge remote data with local file at ${fullPath}\n${err}`);
        }
    }

    return remoteData;
}

function parseFileSync(filePath) {
    let data = fs.readFileSync(filePath, 'utf8');
    return parseDataByFilePath(data, filePath);
}

function parseDataByFilePath(data, filePath) {
    const extension = path.extname(filePath).substring(1);
    let result;
    switch (extension) {
        case 'yml':
        case 'yaml':
            result = yaml.safeLoad(data, {schema: yaml.JSON_SCHEMA});
            break;
        case 'json':
            result = JSON.parse(data);
            break;
        case 'toml':
            result = toml.parse(data);
            break;
        default:
            throw new Error(`could not parse '${filePath}', extension '${extension}' is not supported`);
    }
    return result;
}

function stringifyDataByFilePath(data, filePath) {
    const extension = path.extname(filePath).substring(1);
    let result;
    switch (extension) {
        case 'yml':
        case 'yaml':
            result = yaml.safeDump(data, {noRefs: true});
            break;
        case 'json':
            result = JSON.stringify(data, null, 4);
            break;
        case 'toml':
            result = toml.stringify(data);
            break;
        default:
            throw new Error(`could not serialize '${filePath}', extension '${extension}' is not supported`);
    }
    return result;
}

if (require.main === module) {
    commander
        .option('--stackbit-pull-api-url <stackbitPullApiUrl>', '[required] stackbit pull API URL')
        .option('--stackbit-api-key <stackbitApiKey>', '[required] stackbit API key, can be also specified through STACKBIT_API_KEY environment variable')
        .option('--environment <environment>', '[optional] environment to pull data for')
        .parse(process.argv);

    const stackbitPullApiUrl = commander['stackbitPullApiUrl'];
    const apiKey = process.env['STACKBIT_API_KEY'] || commander['stackbitApiKey'];

    // Environment to pull data for, defaults to Netlify's BRANCH 
    const environment = commander['environment'] || process.env['BRANCH'];

    if (!stackbitPullApiUrl) {
        commander.help(helpText => helpText + `\nError: '--stackbit-pull-api-url' argument must be specified\n\n`);
    }

    if (!apiKey) {
        commander.help(helpText => helpText + `\nError: either '--stackbit-api-key' argument or 'STACKBIT_API_KEY' must be specified\n\n`);
    }

    console.log(`fetching data for project from ${stackbitPullApiUrl}`);

    return pull({stackbitPullApiUrl, apiKey, environment}).then(response => {
        for (let i = 0; i < response.length; i++) {
            const fullPath = path.join(process.cwd(), response[i].filePath);
            fse.ensureDirSync(path.dirname(fullPath));
            if (fs.existsSync(fullPath) && ['yml', 'yaml', 'toml', 'json'].includes(path.extname(fullPath).substring(1))){
                response[i].data = mergeFile(fullPath, response[i].data);
            }
            console.log('creating file', fullPath);
            fs.writeFileSync(fullPath, response[i].data);
        }
    }).catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = {
    pull
};
