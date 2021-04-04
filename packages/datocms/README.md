# datocms-pull

Stackbit DatoCMS pull, is a build tool that fetches stackbit site data from DatoCMS and prepares it for
SSG build.

Usage:
```
Usage: datocms-pull [options]

Options:
  --ssg <ssg>                                       [required] Which SSG are you using [jekyll, hugo, gatbsby]
  --datocms-access-token <datocmsAccessToken>       [required] DatoCMS access token, can be also specified through DATOCMS_ACCESS_TOKEN environment variable
  -h, --help                                        output usage information
```

- `ssg`: Defines which file format should be used when creating pages and data for your site. Required
- `datocmsAccessToken`: DatoCMS access token, can be obtained from the API tokens admin page of your DatoCMS project https://{project_id}.admin.datocms.com/admin/access_tokens. Can be also specified via DATOCMS_ACCESS_TOKEN environment variable.

## Examples

Using `npx`:
```
npx @stackbit/datocms-pull --ssg gatsby --datocms-access-token $DATOCMS_ACCESS_TOKEN
```
