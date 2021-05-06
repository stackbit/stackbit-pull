const _ = require('lodash');
const { SiteClient } = require('datocms-client');

const { utils } = require('@stackbit/stackbit-pull-core');

/**
 *
 * @param ssgType {string}
 * @param readwriteToken {string}
 * @param options {{environment: string, resolveLinks: boolean, allObjects: boolean, dataFormat: string, metadata: boolean}}
 * @returns {PromiseLike<{readonly entries?: *, readonly assets?: *}>}
 */
function pull(ssgType, readwriteToken, options) {
    console.log(`fetching entries from DatoCMS, readwriteToken: '${readwriteToken.slice(0, 2)}..${readwriteToken.slice(-2)}'`);

    const client = new SiteClient(readwriteToken);
    return fetchData(client)
        .then((cmsData) => {
            console.log('got entries from DatoCMS');
            return filterAndTransformProperties(cmsData, options);
        })
        .then((entries) => {
            console.log('generating response data');
            return utils.cms.createFiles(entries, ssgType, options);
        });
}

function fetchData(client) {
    return Promise.all([
        client.site.find(),
        client.items.all({}, { allPages: true }),
        client.uploads.all({}, { allPages: true }),
        client.itemTypes.all().then((itemTypes) => {
            return Promise.all(itemTypes.map((itemType) => client.fields.all(itemType.id))).then((fieldsArr) => {
                return extendItemTypesWithFields(itemTypes, fieldsArr);
            });
        })
    ]).then(([site, entries, uploads, itemTypes]) => {
        return {
            site: site,
            entries: entries,
            itemTypes: itemTypes,
            uploads: uploads
        };
    });
}

function extendItemTypesWithFields(itemTypes, fieldsArr) {
    itemTypes.forEach((itemType, i) => {
        itemType.fields = fieldsArr[i].map((field) => ({
            name: field.apiKey,
            type: field.fieldType
        }));
    });
    return itemTypes;
}

function filterAndTransformProperties(cmsData, options) {
    const entriesById = _.keyBy(cmsData.entries, 'id');
    const itemTypesById = _.keyBy(cmsData.itemTypes, 'id');
    const entries = options.allObjects ? cmsData.entries : utils.cms.filterRootEntries(cmsData.entries, _.property('stackbitModelType'));
    return transformEntries(entries, entriesById, itemTypesById, cmsData.uploads, cmsData.site, options);
}

function transformEntries(entries, entriesById, itemTypesById, uploads, site, options) {
    const includeMetadata = utils.cms.shouldIncludeMetadata(options);
    return _.map(entries, (entry) => {
        return utils.code.deepMap(entry, ({ value: obj, keyPath: fieldPath, objectStack }) => {
            if (!_.isPlainObject(obj)) {
                return obj;
            }

            const snakeCaseObj = propsToSnakeCase(obj);
            if (!obj.itemType) {
                return obj;
            }

            const isRootEntry = _.isEmpty(fieldPath);
            const itemType = _.get(itemTypesById, obj.itemType);
            const fieldNames = snakeCaseObj.stackbit_field_names ? JSON.parse(snakeCaseObj.stackbit_field_names) : null;
            const srcFieldNames = fieldNames ? _.invert(fieldNames) : null;
            const sbModelType = _.get(snakeCaseObj, 'stackbit_model_type', 'object');

            let result = _.reduce(
                itemType.fields,
                (result, field) => {
                    if (field.name === 'stackbit_field_names') {
                        return result;
                    }

                    // even though stackbitModelType is included in stackbit_metadata,
                    // stackbit-pull might be called without includeMetadata,
                    // therefore we need to leave stackbit_model_type on the root entry
                    // such that createFiles will correctly generate file paths
                    if (!isRootEntry && field.name === 'stackbit_model_type') {
                        return result;
                    }

                    const fieldName = _.get(fieldNames, field.name, field.name);
                    const fieldValue = _.get(snakeCaseObj, field.name, null);
                    if (_.isNil(fieldValue)) {
                        return result;
                    }

                    if (field.name === 'stackbit_reference_type') {
                        result.type = fieldValue;
                    } else if (field.type === 'color') {
                        result[fieldName] = rgbToHex(fieldValue);
                    } else if (field.type === 'json') {
                        result[fieldName] = JSON.parse(fieldValue);
                    } else if (field.type === 'file') {
                        const upload = _.find(uploads, { id: _.get(fieldValue, 'uploadId') });
                        result[fieldName] = _.get(upload, 'url');
                    } else if (field.type === 'link') {
                        if (options.resolveLinks) {
                            if (_.some(objectStack, (object) => object.id === fieldValue)) {
                                result[fieldName] = null;
                            } else {
                                result[fieldName] = _.get(entriesById, fieldValue);
                            }
                        } else {
                            result[fieldName] = { stackbit_ref_id: fieldValue };
                        }
                    } else if (field.type === 'links') {
                        result[fieldName] = _.map(fieldValue, (entryId) => {
                            if (options.resolveLinks) {
                                if (_.some(objectStack, (object) => object.id === entryId)) {
                                    return null;
                                } else {
                                    return _.get(entriesById, entryId);
                                }
                            } else {
                                return { stackbit_ref_id: entryId };
                            }
                        });
                    } else if (['string', 'text'].includes(field.type)) {
                        if (fieldValue !== '') {
                            result[fieldName] = fieldValue;
                        }
                    } else {
                        result[fieldName] = fieldValue;
                    }
                    return result;
                },
                {}
            );

            if (includeMetadata) {
                result = _.assign(
                    {
                        stackbit_metadata: _.assign(
                            {
                                srcObjectId: obj.id,
                                srcObjectUrl: `https://${site.internalDomain}/editor/item_types/${obj.itemType}/items/${obj.id}/edit`,
                                srcModelName: itemType.apiKey,
                                srcFieldNames: srcFieldNames
                            },
                            // Add additional fields to the root model
                            isRootEntry
                                ? {
                                      srcType: 'datocms',
                                      srcProjectId: site.id,
                                      srcProjectUrl: `https://${site.internalDomain}/editor`,
                                      sbModelType: sbModelType,
                                      sbModelName: itemType.apiKey.replace(/_model$/, '') // in DatoCMS, the root model name is always the same as Stackbit's model name suffixed with '_model'
                                  }
                                : null
                        )
                    },
                    result
                );
            }

            return _.omitBy(result, _.isNil);
        });
    });
}

function propsToSnakeCase(obj) {
    // DatoCMS API client returns field names in camelCase, even though in model
    // and original data they are defined in snake_case.
    // Therefore, convert field names back to the snake_case.
    // In addition, DatoCMS doesn't allow underscore before numbers in its field
    // names. Therefore, when converting using lodash's snakeCase, remove the
    // underscore before numbers:
    // lodash:
    //   _.snakeCase("hello2World") => "hello_2_world" => "hello2_world"
    return _.mapKeys(obj, (value, key) => {
        return _.snakeCase(key).replace(/_(\d)/g, '$1');
    });
}

/**
 * @param {number} component
 * @returns {string}
 */
function componentToHex(component) {
    const hex = component.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
}

function rgbToHex({ red, green, blue, alpha }) {
    return '#' + componentToHex(red) + componentToHex(green) + componentToHex(blue);
}

module.exports = {
    pull
};
