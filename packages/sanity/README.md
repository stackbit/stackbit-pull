# sanity-pull

Stackbit Sanity pull, is a build tool that fetches stackbit site data from sanity and prepares it for
SSG build.

Usage:
```
Usage: sanity-pull [options]

Options:
  --ssg <ssg>                                       [required] Which SSG are you using [jekyll, hugo, gatbsby]
  --sanity-project-id <sanityProjectId>             [required] Sanity Project ID, can be also specified through SANITY_PROJECT_ID environment variable
  --sanity-access-token <sanityAccessToken>         [required] Sanity access token, can be also specified through SANITY_ACCESS_TOKEN environment variable
  --sanity-dataset <dataset>                        [optional] Sanity dataset, can be also specified through SANITY_DATASET environment variable
  -h, --help                                        output usage information
```

- `ssg`: Defines which file format should be used when creating pages and data for your site. Required
- `sanityProjectId`: Sanity Project ID. Required. Can be also specified via SANITY_PROJECT_ID environment variable.
- `sanityAccessToken`: Sanity access token, can be obtained from the API Settings page of your sanity manage panel https://manage.sanity.io/projects/{project_id}/settings/api. Can be also specified via SANITY_ACCESS_TOKEN environment variable.
- `dataset`: Sanity dataset, optional. Uses `production` by default. Can be also specified via SANITY_DATASET environment variable.

## Examples

Using `npx`:
```
npx @stackbit/sanity-pull --ssg gatsby --sanity-project-id $SANITY_PROJECT_ID --sanity-access-token $SANITY_ACCESS_TOKEN
```
