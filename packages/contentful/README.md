# contentful-pull

Stackbit Contentful pull, is a build tool that fetches stackbit site data from contentful and prepares it for
SSG build.

Usage:
```
Usage: contentful-pull [options]

Options:
  --ssg <ssg>                                       [required] Which SSG are you using [jekyll, hugo, gatbsby]
  --contentful-space-id <contentfulSpaceId>         [required] Contentful Space ID, can be also specified through CONTENTFUL_SPACE_ID environment variable
  --contentful-access-token <contentfulAccessToken> [required] Contentful access token, can be also specified through CONTENTFUL_ACCESS_TOKEN environment variable
  --contentful-environment <contentfulEnvironment>  [optional] Contentful environment, can be also specified through CONTENTFUL_ENVIRONMENT environment variable
  -h, --help                                        output usage information
```

- `ssg`: Defines which file format should be used when creating pages and data for your site. Required 
- `contentfulSpaceId`: Contentful space id. Required. Can be also specified via CONTENTFUL_SPACE_ID environment variable.
- `contentfulAccessToken`: Contentful delivery token, can be obtained from the API Keys page of your contentful space https://app.contentful.com/spaces/{space_id}/api/keys. Can be also specified via CONTENTFUL_ACCESS_TOKEN environment variable.
- `contentfulEnvironment`: Contentful environment, optional. Uses `master` by default. Can be also specified via CONTENTFUL_ENVIRONMENT environment variable.

## Examples

Using `npx`:
```
npx @stackbit/contentful-pull --ssg gatsby --contentful-space-id $CONTENTFUL_SPACE_ID --contentful-access-token $CONTENTFUL_ACCESS_TOKEN
```
