# Japan Post country data

Open **Shipping → Japan Post limits** (`/japan-post`) and upload the original UTF-8 country CSV exported from Japan Post. The supplied November 2, 2026 sample contains 255 unique country codes and 61 columns. Uploads support UTF-8 with or without a BOM, quoted commas/newlines, and CRLF or LF records, up to 5 MB and 1,000 countries.

## Import and history

The new `japanPostCsvCaches` table is registered in `sequelize.js` and created by the existing startup sync. Each version contains `countryCode` (from `国コード`), `data` (every CSV column with its original name and string value), `sourceName`, `detectedAt`, and `lastCheckedAt`, plus Sequelize timestamps. Blank strings and source units are preserved. Extra columns are saved too; the 61 known source columns are required to prevent partial exports from replacing complete records.

- A new country code creates its initial version.
- A change to **any** column creates a new version, even when the changed column is not displayed in the database table. Column and country row ordering do not create changes.
- Unchanged data only updates the latest version's `lastCheckedAt`. `sourceName` identifies the file that created that version.
- Countries absent from an upload remain unchanged. Imports do not infer deletions or unavailability from missing rows.
- Dates record when the app received the data, not Japan Post's publication time. A newly uploaded file is always compared, including repeated uploads on the same day. Upload the most recent export; the CSV has no source timestamp to detect an older file.

The full upload is validated before saving. Empty/duplicate/missing headers, duplicate country codes, invalid codes, invalid encoding, and malformed records reject the entire upload. A MySQL advisory lock serializes concurrent imports across app processes. One transaction saves all new versions and last-checked changes; a failed import leaves existing data untouched. A busy import returns a retryable HTTP 429 response.

The old `japanPostCaches` and `japanPostSchedules` tables are left untouched and are not read by this tool. The HTML parser, CID endpoints, and scheduled HTML worker have been retired. There is no automatic API fetch in this release. A future downloader can supply CSV bytes to `createService(...).importCsv(buffer, sourceName)` using the same validation, transaction, and history logic.

## Database viewer

`/japan-post/database` uses the latest CSV version per country code. The layout remains **SAL → Parcel · air → Parcel · surface → EMS**, with **Weight → Length → Length + girth** within each group. Weights display in kg; numeric centimeter lengths are divided by 100 and displayed in meters. Source JSON is never changed by display conversion.

Availability comes from `SAL小包取扱フラグ`, `国際小包（航空便）取扱フラグ`, `国際小包（船便）取扱フラグ`, and `EMS取扱フラグ`: `1` displays limits, `0` displays **Unavailable**, and empty/unknown flags display **Not specified**. Positive limits do not override an unavailable flag. Raw limits remain available on the country details page even for unavailable methods.

Country/code search also matches Japanese names and English short names. Filters include observed update dates (Japan time), presence of history, and whether a country was checked today. The immediately preceding version supplies bold changed values and previous-value tooltips. Gold highlights use the latest version's `detectedAt` within seven days (168 hours): a first version highlights the row; subsequent versions highlight only changed displayed cells. Changes outside the displayed fields still create history but do not highlight unrelated cells. Method colors work in dark and light themes.

## Country details

Click a country code to open `/japan-post/countries/:code`. The page shows service availability, observed dates, and all source fields grouped into destination, EMS, parcels, small packets/ePacket, printed matter, and letters/other services. Labels include the original CSV column names. Lengths here remain in centimeters and weights in kilograms. Handling flags show their interpretation and raw code; other category/status codes are preserved without guessing their meaning.

The update timeline lists changed fields with previous and current values. Every version has an expandable complete snapshot. Additional source columns are included automatically. Source JSON is available for the current version; the history API returns every saved version.

## Endpoints and verification

All routes require the app login. Uploads additionally require the session token from the page's `data-csrf` attribute in `X-CSRF-Token`.

- `POST /japan-post/api/import` — multipart file field `csvFile`; returns `total`, `added`, `updated`, `unchanged`, and `checkedAt`.
- `GET /japan-post/api/countries/:code` — raw saved `history`, newest first.
- `GET /japan-post/countries/:code` — full country details and history.

Targeted tests:

```sh
npm test -- --runTestsByPath tests/japanPost.test.js tests/japanPostBrowser.test.js
```

The database/HTTP suite opts in with `JAPAN_POST_TEST_MYSQL_PORT`. Use only a disposable MySQL server containing `gcs_japanpost_test` with user `root` and an empty password. The suite recreates its CSV cache table and never loads `.env` or the app database module:

```sh
JAPAN_POST_TEST_MYSQL_PORT=33309 npm test -- --runTestsByPath tests/japanPostDatabase.test.js
```

The fixture is the supplied 61-column export. Coverage includes all 255 countries, raw-value preservation, units/flags, repeated and changed imports, atomic rollback, concurrent imports, filters, rendered history, upload auth/CSRF, and retired endpoints. Review the upload, database and details pages in dark/light themes and on narrow screens.
