const path = require('path');
const _ = require('lodash');
const yaml = require('js-yaml');
const toml = require('@iarna/toml');

const dataDirMapBySSGType = {
    jekyll: '_data',
    hugo: 'data',
    gatsby: 'src/data'
};

const pagesDirMapBySSGType = {
    jekyll: '',
    hugo: 'content',
    gatsby: 'src/pages'
};

const layoutKeyMapBySSGType = {
    jekyll: 'layout',
    hugo: 'layout',
    gatsby: 'template'
};

function getLayoutKey(ssgType) {
    return _.get(layoutKeyMapBySSGType, ssgType) || 'layout';
}

function getDataFilePath(dataFile, ssgType) {
    let filePath = _.get(dataFile, 'stackbit_file_path', null);
    let dataDir;
    if (_.has(dataFile, 'stackbit_dir')) {
        dataDir = _.get(dataFile, 'stackbit_dir', null);
    } else {
        dataDir = _.get(dataDirMapBySSGType, ssgType, null);
    }
    // for backward compatibility check if dataDir isn't already included
    if (filePath && dataDir && !_.startsWith(filePath, dataDir)) {
        filePath = path.join(dataDir, filePath);
    }
    return filePath;
}

/**
 * Normalizes "stackbit_url_path" received from CMS
 * Users might edit this field, therefore the normalization should be very defensive
 *
 * - Leading slash "/" is stripped
 * - Trailing "index" and "_index" are stripped (only if preceded by "/" or located in the beginning of the string)
 * - Trailing slash "/" is stripped
 *
 * @example
 * normalizeSlug("my-page/index") => "my-page"
 * normalizeSlug("my-page/_index") => "my-page"
 * normalizeSlug("my-page/my-index") => "my-page/my-index" (no change, because "index" is not preceded by "/")
 * normalizeSlug("index") => ""
 * normalizeSlug("_index") => ""
 * normalizeSlug("my-index") => "my-index"
 *
 * @param url
 * @return {string}
 */
function normalizeSlug(url) {
    if (!_.isString(url)) {
        url = '';
    }

    // Remove the leading "/"
    url = url.replace(/^\//, '');

    // Replace the ending "index" (or "_index" for Hugo sites) with ""
    // The replaced string must be preceded with "/" or to be located at the beginning of the string.
    // "foo/index" => "foo/"
    // "foo/bar-index" => "foo/bar-index" (no change, index is not preceded by "/")
    // "index" => "", "_index" => ""
    url = url.replace(/(^|\/)_?index$/, '$1');

    // Remove the trailing "/"
    url = url.replace(/\/$/, '');

    return url;
}

function getPageFilePath(page, ssgType) {
    let url = page.stackbit_url_path;

    // Remove the leading "/" to prevent bugs in url concatenation
    if (_.startsWith(url, '/')) {
        url = url.substring(1);
    }

    // If url is an empty string or ends with "/", append "index" to url
    if (url === '' || _.endsWith(url, '/')) {
        url += 'index';
    }

    // update url for specific SSGs
    if (ssgType === 'jekyll') {
        // If url starts with "posts/" or "_posts/", replace with "_posts/" and append timestamp to file name
        if (/^_?posts\//.test(url)) {
            let urlParts = url.split('/');
            let postFilePath = urlParts[1];
            if (!/^\d{4}-\d{2}-\d{2}/.test(postFilePath)) {
                let dateISOStr = new Date(page.date).toISOString().substr(0, 10);
                postFilePath = dateISOStr + '-' + postFilePath;
            }
            postFilePath = postFilePath.replace(/_+/g, '-');
            url = '_posts/' + postFilePath;
        }
    } else if (ssgType === 'hugo') {
        // If url is "index" or ends with "/index", replace "index" with "_index"
        if (url === 'index' || _.endsWith(url, '/index')) {
            url = url.replace(/index$/, '_index');
        }
    }

    let pagesDir = '';
    if (_.has(page, 'stackbit_dir')) {
        pagesDir = _.get(page, 'stackbit_dir');
    } else if (_.has(pagesDirMapBySSGType, ssgType)) {
        pagesDir = _.get(pagesDirMapBySSGType, ssgType);
    }

    // append page folder to url
    url = path.join(pagesDir, url);

    const ext = page.stackbit_file_ext || '.md';

    // Finally, append ext to the url
    return url + ext;
}

function markdownStringify(data) {
    const frontmatterData = _.omit(data, ['content']);
    const frontmatter = yaml.safeDump(frontmatterData, { noRefs: true });
    const content = _.get(data, 'content', '');
    // yaml.safeDump adds new line at the end of its output
    return `---\n${frontmatter}---\n${content}`;
}

function convertDataByFilePath(data, filePath) {
    const extension = path.extname(filePath).substring(1);
    let result;
    switch (extension) {
        case 'yml':
        case 'yaml':
            result = yaml.safeDump(data, { noRefs: true });
            break;
        case 'toml':
            result = toml.stringify(data);
            break;
        case 'json':
            result = JSON.stringify(data);
            break;
        case 'md':
            result = markdownStringify(data);
            break;
        case 'html':
            result = _.get(data, 'content', '');
            break;
        default:
            throw new Error(`Build error, data file '${filePath}' could not be created, extension '${extension}' is not supported`);
    }
    return result;
}

function filterRootEntries(entries, modelTypePredicate) {
    const rootModelTypes = ['page', 'data', 'config'];
    return _.filter(entries, (entry) => _.includes(rootModelTypes, modelTypePredicate(entry)));
}

function createFiles(entries, ssgType, options) {
    // If, for some reason, one of the entries won't have 'stackbit_model_type'
    // the createFile() for that entry will return null, and the compact() will
    // remove it from the array.
    return _.chain(entries)
        .map((entry) => createFile(entry, ssgType, options))
        .compact()
        .value();
}

function createPageFiles(pages, ssgType, options) {
    return _.map(pages, (page) => createPageFile(page, ssgType, options));
}

function createDataFiles(dataFiles, ssgType, options) {
    return _.chain(dataFiles)
        .map((dataFile) => createDataFile(dataFile, ssgType, options))
        .compact()
        .value();
}

function createFile(entry, ssgType, options) {
    const stackbitModelType = _.get(entry, 'stackbit_model_type');
    if (stackbitModelType === 'page') {
        return createPageFile(entry, ssgType, options);
    } else if (stackbitModelType === 'data') {
        return createDataFile(entry, ssgType, options);
    } else if (stackbitModelType === 'config') {
        return createConfigFile(entry, options);
    } else if (options.allObjects && _.get(options, 'dataFormat') === 'object') {
        entry = _.omit(entry, ['stackbit_model_type']);
        return { filePath: null, data: entry };
    } else {
        return null;
    }
}

function createPageFile(page, ssgType, options) {
    const objectFormat = _.get(options, 'dataFormat') === 'object';
    const filePath = getPageFilePath(page, ssgType);
    // TODO: stackbit_url_path needed to resolve page references
    let data = _.omit(page, ['stackbit_model_type', 'stackbit_dir', 'stackbit_file_ext']);
    if (!objectFormat) {
        data = convertDataByFilePath(data, filePath);
    }
    return {
        filePath: filePath,
        urlPath: normalizeSlug(_.get(page, 'stackbit_url_path', '')),
        data: data
    };
}

function createDataFile(dataFile, ssgType, options) {
    const objectFormat = _.get(options, 'dataFormat') === 'object';
    const filePath = getDataFilePath(dataFile, ssgType);
    let data = _.omit(dataFile, ['stackbit_model_type', 'stackbit_file_path', 'stackbit_dir']);
    // objects of 'data' type might not have filePath if the model has 'folder' property
    if (!objectFormat) {
        if (filePath) {
            data = convertDataByFilePath(data, filePath);
        } else {
            return null;
        }
    }
    return {
        filePath: filePath,
        data: data
    };
}

function createConfigFile(configData, options) {
    const objectFormat = _.get(options, 'dataFormat') === 'object';
    const filePath = configData.stackbit_file_path;
    let data = _.omit(configData, ['stackbit_model_type', 'stackbit_file_path']);
    if (!objectFormat) {
        data = convertDataByFilePath(data, filePath);
    }
    return {
        filePath: filePath,
        data: data
    };
}

function shouldIncludeMetadata(options) {
    const isObjectFormat = _.get(options, 'dataFormat') === 'object';
    const metadata = _.get(options, 'metadata', false);
    return isObjectFormat && metadata;
}

module.exports = {
    normalizeSlug,
    filterRootEntries,
    createFiles,
    createPageFiles,
    createDataFiles,
    createFile,
    createPageFile,
    createDataFile,
    createConfigFile,
    getLayoutKey,
    shouldIncludeMetadata
};
