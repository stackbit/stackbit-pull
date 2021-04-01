const sanityClient = require('@sanity/client');
const _ = require('lodash');

const { utils } = require('@stackbit/stackbit-pull-core');

/**
 *
 * @param projectId
 * @param ssgType
 * @param token
 * @param options {{dataset: string, preview: boolean, resolveLinks: boolean, allObjects: boolean, dataFormat: string, metadata: boolean, studioUrl: string}}
 * @returns {PromiseLike<T>}
 */
function pull(projectId, ssgType, token, options) {
    console.log(`fetching entries from Sanity, projectId: '${projectId}', token: '${token.slice(0, 2)}..${token.slice(-2)}', dataset: ${options.dataset}`);
    const client = sanityClient({
        projectId,
        dataset: _.get(options, 'dataset', 'production'),
        token
    });

    options = _.assign(
        {
            includeMetadata: utils.cms.shouldIncludeMetadata(options),
            projectId: projectId
        },
        options
    );

    const preview = _.get(options, 'preview', false);
    let query = '!(_id in path("_.**"))';
    if (!preview) {
        query += ' && !(_id in path("drafts.**"))';
    }

    return client
        .fetch(`*[${query}]`)
        .then((entries) => {
            console.log('got entries from Sanity');
            if (preview) {
                return overlayDrafts(entries);
            } else {
                return entries;
            }
        })
        .then((entries) => {
            return filterAndTransformProperties(entries, options);
        })
        .then((entries) => {
            console.log('generating response data');
            return utils.cms.createFiles(entries, ssgType, options);
        });
}

function filterAndTransformProperties(allEntries, options) {
    const groups = _.groupBy(allEntries, (entry) => {
        const entryType = _.get(entry, '_type');
        return ['sanity.imageAsset', 'sanity.fileAsset'].includes(entryType) ? 'assets' : 'entries';
    });
    let entries = _.get(groups, 'entries', []);
    const assets = _.get(groups, 'assets', []);
    const entriesById = _.keyBy(entries, (entry) => getCanonicalObjectId(entry._id));
    const assetsById = _.keyBy(assets, '_id');
    if (!options.allObjects) {
        entries = utils.cms.filterRootEntries(entries, _.property('stackbit_model_type'));
    }
    return transformEntries(entries, entriesById, assetsById, options);
}

function transformEntries(entries, entriesById, assetsById, options) {
    return _.map(entries, (entry) => {
        return utils.code.deepMap(entry, ({ value, keyPath: fieldPath }) => {
            if (_.last(fieldPath) === 'stackbit_metadata') {
                return value;
            }

            let type = _.get(value, '_type');

            if (type === 'slug' && _.has(value, 'current')) {
                return _.get(value, 'current');
            }

            if (type === 'image' || type === 'file') {
                const assetId = _.get(value, 'asset._ref');
                if (!assetId) {
                    return null;
                }
                if (!_.has(assetsById, assetId)) {
                    return null;
                }
                const image = _.get(assetsById, assetId);
                return _.get(image, 'url');
            }

            if (type === 'color') {
                return _.get(value, 'hex');
            }

            if (type === 'reference') {
                const refId = _.get(value, '_ref');
                if (!refId) {
                    return null;
                }
                if (!_.has(entriesById, refId)) {
                    return null;
                }
                if (options.resolveLinks) {
                    value = _.get(entriesById, refId);
                } else {
                    return { stackbit_ref_id: refId };
                }
            }

            return transformObject(value, fieldPath, options);
        });
    });
}

function transformObject(obj, fieldPath, options) {
    if (!_.isPlainObject(obj)) {
        return obj;
    }

    let fieldNames = _.get(obj, 'stackbit_field_names');
    let srcFieldNames = null;
    const isRootEntry = _.isEmpty(fieldPath);
    const omitKeys = ['stackbit_field_names'];
    let mappedFields = _.omitBy(obj, (value, key) => omitKeys.includes(key) || key[0] === '_');
    // even though stackbitModelType is included in stackbit_metadata, stackbit-pull might be called without includeMetadata,
    // therefore we need to leave stackbit_model_type on the root entry such that createFiles will correctly generate file paths
    if (!isRootEntry) {
        mappedFields = _.omit(mappedFields, ['stackbit_model_type']);
    }
    if (fieldNames) {
        fieldNames = JSON.parse(fieldNames);
        srcFieldNames = _.invert(fieldNames);
        mappedFields = _.mapKeys(mappedFields, (value, fieldName) => _.get(fieldNames, fieldName, fieldName));
    }
    if (options.includeMetadata) {
        const canonicalObjectId = _.has(obj, '_id') ? getCanonicalObjectId(_.get(obj, '_id')) : null;
        const itemType = _.get(obj, '_type');
        const sbModelType = _.get(obj, 'stackbit_model_type', 'object');
        mappedFields = _.assign(
            {
                stackbit_metadata: _.assign(
                    canonicalObjectId && itemType
                        ? {
                              srcObjectId: canonicalObjectId,
                              srcObjectUrl: options.studioUrl ? options.studioUrl + '/desk/' + itemType + ';' + canonicalObjectId : null
                          }
                        : null,
                    itemType
                        ? {
                              srcModelName: itemType
                          }
                        : null,
                    {
                        srcFieldNames: srcFieldNames
                    },
                    // Add additional fields to the root model
                    isRootEntry
                        ? {
                              srcType: 'sanity',
                              srcProjectId: options.projectId,
                              srcProjectUrl: options.studioUrl || null,
                              srcEnvironment: options.dataset,
                              sbModelType: sbModelType,
                              sbModelName: itemType // in Sanity, the root model name is always the same as Stackbit's model name
                          }
                        : null
                )
            },
            mappedFields
        );
    }
    return mappedFields;
}

function overlayDrafts(documents) {
    const docGroups = _.groupBy(documents, (doc) => (isDraftId(doc._id) ? 'drafts' : 'published'));
    const documentsByPureId = _.keyBy(docGroups.published, '_id');
    _.forEach(docGroups.drafts, (doc) => {
        documentsByPureId[getCanonicalObjectId(doc._id)] = doc;
    });
    return _.values(documentsByPureId);
}

const DRAFT_ID_PREFIX = 'drafts.';
const DRAFT_ID_REGEXP = /^drafts\./;

function isDraftId(objectId) {
    return objectId && objectId.startsWith(DRAFT_ID_PREFIX);
}

function getCanonicalObjectId(objectId) {
    return isDraftId(objectId) ? objectId.replace(DRAFT_ID_REGEXP, '') : objectId;
}

module.exports = {
    pull
};
