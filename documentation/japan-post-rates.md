# Japan Post rate chart imports

Open `/shipcost`, select **EMS**, choose the Japan Post CSV and select **Import full chart**. The supplied EMS export contains 42 upper weight limits and five current zones (210 rates). The importer selects the `新_第…地帯_料金` headers and excludes the four obsolete columns, including the two different old second-zone columns. It never uses fixed column offsets.

The chart viewer and CSV download are at `/shipcost/view`; full versions and comparisons are at `/shipcost/history?method=EMS`. The manager now reads saved rates without making Japan Post website requests. The existing website/manual review workflow remains available at `/shipcost/online`.

## Import contract

- One complete chart for one explicitly selected method, UTF-8 CSV, up to 1 MB. The export does not identify its shipping method, so the selection must match the file.
- First column: `重量`, an integer upper weight limit in grams. Remaining columns: `新_第N地帯_料金` (or `第N地帯_料金` when there are no new columns). Japanese numerals and Arabic digits are accepted. Parenthetical suffixes are retained as zone labels.
- Every selected weight/zone intersection must contain a positive integer JPY rate. Properly quoted thousands separators are accepted. Duplicate weights/zones, unknown headers, incomplete rows, missing/invalid rates and malformed CSV are rejected before any writes.
- Weight brackets and the number of zones are taken from the file. Small packets are capped at 2,000 g; EMS and parcels at 30,000 g. A different number of brackets is supported. Unknown schemas are rejected instead of guessed.
- Rates are used as supplied: no registration fees, surcharges or currency conversion are added. Registered small-packet imports must already include the registration charge.
- Rows and columns are compared by weight and zone identity, including column labels and every rate. Reordering rows/columns or changing CSV quoting does not create a new version. Ignored legacy columns do not participate in comparison.
- Removed rows/columns replace the active chart; they are not merged back from history. A syntactically complete but partial chart cannot be distinguished from an intentional smaller chart, so always upload the full export.
- The file contains zone identifiers, not country membership. New identifiers and descriptive suffixes are retained; it does not update country-to-zone assignments. Standard current EMS geography is China/South Korea/Taiwan; other Asia; Oceania/Canada/Mexico/Middle East/Europe; USA and territories; other Central/South America/Africa. See [Japan Post's EMS rate table](https://www.post.japanpost.jp/send/oversea/charge/list-ems/all.html). Its zone 3/4 rates already include the special surcharge.

## Persistence and compatibility

`shipcostCharts` is an additive Sequelize table created by the app's existing startup sync. Back up the application database before deployment, then restart the app. No existing tables need alteration or destructive migration.

Each changed upload stores a complete JSON chart and appends all its rate cells to the existing `shipcosts` table in the same transaction. Readers use the full chart snapshot to prevent old removed weights/zones resurfacing. Before the first changed upload, the effective legacy chart is retained as a baseline version. An identical upload does not create either a baseline or a new chart and does not modify rates or timestamps. Legacy rows are retained for historical date queries.

Uploads take effect on the current Japan calendar date. Manual updates may specify a date but cannot precede the latest saved chart. Multiple changes on the same day remain distinct versions; the date viewer selects the latest version on that date. History exposes every version, its source filename, source headers and row/column/cell comparison. Changing a method never changes other methods.

Imports and manual updates use the same per-method MySQL advisory lock, including the initial upload. Transactions roll back snapshots, baselines and rate cells together on failure. Authentication and a session CSRF token are required for writes. Database reads use a consistent transaction snapshot. Do not insert new rate updates directly into `shipcosts` after adopting chart versions: use the service so version-aware readers remain consistent.

## Verification

Run parser, selection and browser-DOM tests:

```sh
npm test -- --runTestsByPath tests/shipcost.test.js tests/shipcostBrowser.test.js
```

Database/HTTP tests explicitly require a disposable MySQL database named `gcs_shipcost_test`, at `127.0.0.1`, with root and an empty password. They drop/recreate **only that test database's models** and never read `.env` or load the application database module:

```sh
SHIPCOST_TEST_MYSQL_PORT=<disposable-port> npm test -- --runTestsByPath tests/shipcostDatabase.test.js
```

Coverage includes the supplied file, matching legacy rates, no-op reuploads, changed cells, removed/added axes, same-day versions, manual changes, rollback, concurrency, malformed data, CSRF/authentication, date selection and CSV export.
