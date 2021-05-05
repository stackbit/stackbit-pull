# stackbit-pull

Stackbit pull, is a build tool that fetches data from CMS using Stackbit's API and prepares it for
SSG build. 

Usage:
```
Usage: stackbit-pull [options]

Options:
  --stackbit-pull-api-url <stackbitPullApiUrl>  [required] stackbit pull API URL
  --stackbit-api-key <stackbitApiKey>           [required] stackbit API key, can be also specified through STACKBIT_API_KEY environment variable
  -h, --help                                    output usage information
```

- `stackbitPullApiUrl`: Stackbit pull URL, takes following form: https://api.stackbit.com/pull/<stackbitProjectId>
- `stackbitApiKey`: Stackbit API key, can be acquired in project's API Keys section in https://app.stackbit.com/dashboard. Can be also specified via STACKBIT_API_KEY environment variable.

## Examples

Using `npx`:
```
npx @stackbit/stackbit-pull --stackbit-pull-api-url=https://api.stackbit.com/pull/<stackbitProjectId> --stackbit-api-key=...
```

Using `STACKBIT_API_KEY`:
```
export STACKBIT_API_KEY=...
./stackbit-pull.js --stackbit-pull-api-url=https://api.stackbit.com/pull/<stackbitProjectId>
```


**Using local json file:**

If you have a local json file with the following structure already downloaded,
```json
[
  {
    "filePath": "src/pages/posts/post-1.md",
    "urlPath": "posts/post-1",
    "data": "---\nstackbit_url_path: >-..."
  },
  ...
]
```
then you can skip the network step by using the following command
(no need to provide `STACKBIT_API_KEY` in this scenario):
```shell
npx @stackbit/stackbit-pull stackbit-pull-local-json --json-file=/path/to/your/json/file.json
```