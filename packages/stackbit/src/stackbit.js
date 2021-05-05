const https = require('https');
const url = require('url');

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
