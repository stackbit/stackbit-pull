#!/usr/bin/env node

const fse = require('fs-extra');
const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');
const yaml = require('js-yaml');
const toml = require('@iarna/toml');
const commander = require('commander');

// const argv = minimist(process.argv.slice(2));
commander
    .option('--stackbit-pull-api-url <stackbitPullApiUrl>', '[required] stackbit pull API URL')
    .option('--stackbit-api-key <stackbitApiKey>', '[required] stackbit API key, can be also specified through STACKBIT_API_KEY environment variable')
    .parse(process.argv);

const stackbitPullApiUrl = commander['stackbitPullApiUrl'];
const apiKey = process.env['STACKBIT_API_KEY'] || commander['stackbitApiKey'];

if (!stackbitPullApiUrl) {
    commander.help(helpText => helpText + `\nError: '--stackbit-pull-api-url' argument must be specified\n\n`);
}

if (!apiKey) {
    commander.help(helpText => helpText + `\nError: either '--stackbit-api-key' argument or 'STACKBIT_API_KEY' must be specified\n\n`);
}

const urlObject = url.parse(stackbitPullApiUrl);
const data = JSON.stringify({apiKey: apiKey});

console.log(`fetching data for project from ${urlObject.href}`);

const options = {
    host: urlObject.host,
    path: urlObject.path,
    protocol: urlObject.protocol,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => {
        data += chunk;
    });

    res.on('end', () => {
        if (res.statusCode === 404) {
            throw new Error('Project not found');
        }

        let response;

        try {
            response = JSON.parse(data);
        } catch (err) {
            throw new Error(`Failed to serialize response json`);
        }

        if (res.statusCode >= 400) {
            throw new Error(`Failed to build project, statusCode: ${res.statusCode}, response: ${JSON.stringify(response)}`);
        }

        for (let i = 0; i < response.length; i++) {
            const fullPath = path.join(__dirname, response[i].filePath);
            fse.ensureDirSync(path.dirname(fullPath));
            if (fs.existsSync(fullPath) && ['yml', 'yaml', 'toml', 'json'].includes(path.extname(fullPath).substring(1))){
                response[i].data = mergeFile(fullPath, response[i].data);
            }
            console.log('creating file', fullPath);
            fs.writeFileSync(fullPath, response[i].data);
        }
    });
});

req.on('error', (e) => {
    throw new Error(`Error fetching project build: ${e.message}`);
});

req.write(data);
req.end();


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
