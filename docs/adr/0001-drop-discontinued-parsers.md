# Drop discontinued parsers from the tracked set

`geostyler-geocss-parser`, `geostyler-symcore-parser` and `geostyler-masterportal-parser` returned 404 from the npm registry on every fetch run in mid-2026. They were removed from `REPOS` in `src/constants/repos.ts` as discontinued. Re-add one only after confirming it is published under that name on npm, otherwise `fetch-metadata` fails the build for every deploy.
