#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const fse = require('fs-extra');
const yaml = require('js-yaml');
const toml = require('@iarna/toml');

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
            result = yaml.safeLoad(data, { schema: yaml.JSON_SCHEMA });
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
            result = yaml.safeDump(data, { noRefs: true });
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

function writeFiles(encodedFiles) {
    for (let i = 0; i < encodedFiles.length; i++) {
        const fullPath = path.join(process.cwd(), encodedFiles[i].filePath);
        fse.ensureDirSync(path.dirname(fullPath));
        let fileContentChanged = true;
        if (fs.existsSync(fullPath)) {
            if (['yml', 'yaml', 'toml', 'json'].includes(path.extname(fullPath).substring(1))) {
                encodedFiles[i].data = mergeFile(fullPath, encodedFiles[i].data);
            }
            fileContentChanged = !_.isEqual(encodedFiles[i].data, fs.readFileSync(fullPath, 'utf8'));
        }
        if (fileContentChanged) {
            console.log('creating file', fullPath);
            fs.writeFileSync(fullPath, encodedFiles[i].data);
        } else {
            console.log('content unchanged, skipping write', fullPath);
        }
    }
}

module.exports = {
    writeFiles,
    utils: require('./utils')
};
