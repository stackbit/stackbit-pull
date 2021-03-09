const contentful = require('contentful');
const _ = require('lodash');

const { utils } = require('@stackbit/stackbit-pull-core');
const PAGE_SIZE = 100;

function pull(spaceId, ssgType, accessToken, options) {
    console.log(
        `fetching entries from Contentful, spaceId: '${spaceId}', accessToken: '${accessToken.slice(0, 2)}..${accessToken.slice(-2)}'`
    );
    const isPreview = _.get(options, 'preview', false);
    const client = contentful.createClient({
        accessToken: accessToken,
        space: spaceId,
        environment: _.get(options, 'environment', 'master'),
        host: isPreview ? 'preview.contentful.com' : 'cdn.contentful.com',
        resolveLinks: false
    });
    return getAllEntries(client)
        .then((entries) => {
            return getAllAssets(client).then((assets) => ({ entries, assets }));
        })
        .then(({ entries, assets }) => {
            console.log('got entries from Contentful');
            return filterAndTransformProperties(entries, assets, options);
        })
        .then((entries) => {
            console.log('generating response data');
            return utils.cms.createFiles(entries, ssgType, options);
        });
}

function getChunk(client, method, chunkIndex) {
    return client[method]({
        skip: chunkIndex * PAGE_SIZE,
        limit: PAGE_SIZE,
        include: 0
    }).then((result) => {
        if (result.total > result.skip + result.limit) {
            return getChunk(client, method, chunkIndex + 1).then((items) => {
                return _.concat(result.items, items);
            });
        }
        return result.items;
    });
}

function getAllEntries(client) {
    return getChunk(client, 'getEntries', 0);
}

function getAllAssets(client) {
    return getChunk(client, 'getAssets', 0);
}

function filterAndTransformProperties(entries, assets, options) {
    const entriesById = _.keyBy(entries, 'sys.id');
    const assetsById = _.keyBy(assets, 'sys.id');
    if (!options.allObjects) {
        entries = utils.cms.filterRootEntries(entries, _.property('fields.stackbit_model_type'));
    }
    return transformEntries(entries, entriesById, assetsById, options);
}

function transformEntries(entries, entriesById, assetsById, options) {
    const includeMetadata = utils.cms.shouldIncludeMetadata(options);

    return _.map(entries, (entry) => {
        const spaceId = _.get(entry, 'sys.space.sys.id');
        return utils.code.deepMap(entry, ({ value, keyPath: fieldPath }) => {
            // when entry is deeply mapped, step over the 'stackbit_metadata'
            // property that is created in the previous iteration
            if (_.last(fieldPath) === 'stackbit_metadata') {
                return value;
            }

            // if this is a Link field, resolve the linked object
            if (_.get(value, 'sys.type') === 'Link') {
                const linkType = _.get(value, 'sys.linkType');
                const entryId = _.get(value, 'sys.id');
                // the link can be link to an Entry or to an Asset
                if (linkType === 'Entry' && _.has(entriesById, entryId)) {
                    if (options.resolveLinks) {
                        value = _.get(entriesById, entryId);
                    } else {
                        return { stackbit_ref_id: entryId };
                    }
                } else if (linkType === 'Asset' && _.has(assetsById, entryId)) {
                    value = _.get(assetsById, entryId);
                } else {
                    value = null;
                }
            }

            // if this is an Asset, resolve to its url and return
            if (_.get(value, 'sys.type') === 'Asset') {
                const url = _.get(value, 'fields.file.url');
                if (!url) {
                    return null;
                }
                return url.replace(/^\/\//, 'https://');
            }

            if (_.get(value, 'sys.type') === 'Entry') {
                const isRootEntry = _.isEmpty(fieldPath);
                const fieldNames = _.get(value, 'fields.stackbit_field_names');
                const stackbitModelType = _.get(value, 'fields.stackbit_model_type', 'object');
                const fields = _.get(value, 'fields', {});

                let srcFieldNames = null;
                let mappedFields = _.omit(fields, ['stackbit_field_names']);
                // even though stackbitModelType is included in stackbit_metadata, stackbit-pull might be called without includeMetadata,
                // therefore we need to leave stackbit_model_type on the root entry such that createFiles will correctly generate file paths
                if (!isRootEntry) {
                    mappedFields = _.omit(mappedFields, ['stackbit_model_type']);
                }
                if (fieldNames) {
                    srcFieldNames = _.invert(fieldNames);
                    mappedFields = _.mapKeys(mappedFields, (value, fieldName) => _.get(fieldNames, fieldName, fieldName));
                }
                if (includeMetadata) {
                    const itemId = _.get(value, 'sys.id');
                    const contentTypeId = _.get(value, 'sys.contentType.sys.id');
                    mappedFields = _.assign(
                        {
                            stackbit_metadata: _.assign(
                                {
                                    srcEnvironment: options.environment,
                                    srcObjectId: itemId,
                                    srcObjectUrl: `https://app.contentful.com/spaces/${spaceId}/entries/${itemId}`,
                                    srcModelName: contentTypeId,
                                    srcFieldNames: srcFieldNames
                                },
                                // Add additional fields to the root model
                                isRootEntry
                                    ? {
                                          srcType: 'contentful',
                                          srcProjectId: spaceId,
                                          srcEnvironment: options.environment,
                                          srcProjectUrl: `https://app.contentful.com/spaces/${spaceId}/home`,
                                          sbModelType: stackbitModelType,
                                          sbModelName: contentTypeId // in Contentful, the root model name is always the same as Stackbit's model name
                                      }
                                    : null
                            )
                        },
                        mappedFields
                    );
                }

                return mappedFields;
            }

            return value;
        });
    });
}

module.exports = {
    pull
};
