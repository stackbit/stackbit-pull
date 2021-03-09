const https = require('https');
const url = require('url');
const commander = require('commander');

const { writeFiles } = require('@stackbit/stackbit-pull-core');

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
            res.on('data', (chunk) => {
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
                    return reject(
                        new Error(`Failed to build project, statusCode: ${res.statusCode}, response: ${JSON.stringify(response)}`)
                    );
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

module.exports = {
    pull
};

if (require.main === module) {
    commander
        .option('--stackbit-pull-api-url <stackbitPullApiUrl>', '[required] stackbit pull API URL')
        .option(
            '--stackbit-api-key <stackbitApiKey>',
            '[required] stackbit API key, can be also specified through STACKBIT_API_KEY environment variable'
        )
        .option('--environment <environment>', '[optional] environment to pull data for')
        .parse(process.argv);

    const stackbitPullApiUrl = commander['stackbitPullApiUrl'];
    const apiKey = process.env['STACKBIT_API_KEY'] || commander['stackbitApiKey'];

    // Environment to pull data for, defaults to Netlify's BRANCH
    const environment = commander['environment'] || process.env['BRANCH'];

    if (!stackbitPullApiUrl) {
        commander.help((helpText) => helpText + `\nError: '--stackbit-pull-api-url' argument must be specified\n\n`);
    }

    if (!apiKey) {
        commander.help(
            (helpText) => helpText + `\nError: either '--stackbit-api-key' argument or 'STACKBIT_API_KEY' must be specified\n\n`
        );
    }

    console.log(`fetching data for project from ${stackbitPullApiUrl}`);

    pull({ stackbitPullApiUrl, apiKey, environment })
        .then((response) => {
            return writeFiles(response);
        })
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
