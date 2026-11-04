# Country & shipping-method manager

`/country` combines the website list, internal carrier availability, explicit country mappings, and Japan Post limits CSV versions. It requires the normal app login. Data tools/exports remain deferred.

## Setup and editing

1. Import or edit **Website country list**. It is the exact set of destinations shown in the availability matrix. CSV header: `country,country_code`.
2. Import or edit **Internal country list**. It can contain additional destinations. CSV header: `country,country_code,country_j,DHL,AIT,ECMS`. Carrier values are `1` (available), `0` (unavailable), or blank (unknown); the Japanese name is optional. The old five-column import must be extended with an ECMS column; blank is valid.
3. Import the source CSV in `/japan-post`, then add **Japan Post country mappings**, individually or with `country_code,jp_code`. Internal codes are exact strings, including leading zeros and case; they are never interpreted as ISO numeric codes. Multiple internal codes can reference one Japan Post two-letter code. Mapping targets must exist in the imported Japan Post data. Old CID/name links are not automatically converted.
4. Add an **exception** using an internal country code, method, force-enable/force-disable, and required reason. An exception takes priority even when the source is unknown. Remove it to restore source availability. Exceptions for destinations outside the website list remain visible and labelled.

All CSV uploads are UTF-8 (BOM allowed), at most 5 MB and 2,000 entries, with the exact displayed header. Quoted commas and multiline names are supported. Duplicate codes, invalid encoding, malformed rows and invalid availability reject the whole upload. Imports **replace** that source list, including removal of absent entries, after an explicit browser confirmation. Individual editing supports add/update/removal. Changing a code means adding the new code and removing the old one; mappings/exceptions must be reviewed separately. Removing a website/internal country does not cascade to mappings or exceptions.

The tracker upload page’s country autocomplete also reads the current internal snapshot, falling back to the legacy table before the first baseline.

The matrix displays Available, Unavailable and Unknown separately. Each country detail shows the source result, effective result, source flag evidence, exception reason, the selected Japan Post version and delivery-area restrictions. Registered air small packets require both air small-packet and registered-air flags; registered SAL requires both SAL small-packet and `SAL書留フラグ`. Other Japan Post methods use their corresponding explicit handling flag. The UI lists the exact field mapping. Only `0`/`1` are interpreted. Positive weight limits and category codes never imply availability. ePacket Light has no explicit binary flag here and is not inferred from its category.

## Versions and historical views

Two new tables, `CountryManagerStates` and `CountryManagerVersions`, are created by the existing startup `sequelize.sync()`. Back up the app database before deploying schema changes as usual. Existing tables are not altered or deleted.

On first access, a transaction captures the current legacy website list and the latest legacy internal row per code as the initial baseline. Legacy ECMS is Unknown. Mappings and exceptions begin empty. The original `OfficialCountryLists`, `InternalCountryLists`, `JapanPostCountryLists`, and `CountryCodeEntryIdLinks` remain untouched for archival/reference purposes. Earlier website state was overwritten by the legacy manager and cannot be recovered; this release does not reconstruct pre-baseline internal history from legacy rows. Earlier internal versions remain in their legacy table.

Each changed website/internal/mapping/exception edit adds an immutable full-source snapshot, recorded time, actor and operation note. Removals and renames are included. Identical saves/imports add no version. A singleton row lock serializes writes across processes; a revision from the form prevents stale concurrent updates. The version and revision counter commit together. New manager timestamps increase strictly so successive edits have unambiguous historical links.

Japan Post data is read directly from `JapanPostCsvCaches`, with no copying, scraping or network request. Historical availability uses the latest manager snapshots and Japan Post versions at or before the selected timestamp, including the mapping and exception valid then. Date filters mean **end of day in Japan time**; timeline links use the exact recorded instant. These are observation times, not retroactive carrier effective dates. Historical views are read-only. Before the manager baseline, its country lists are unknown/empty rather than reconstructed using current data.

`/country/history` shows field-level changes, actor/file and links to historical availability, with 40 events per page. It can be filtered by exact internal country code. Country history includes Japan Post events while that mapping was active; the Japan Post country page provides the complete history, including versions observed before the mapping was added. Internal-only countries are retained in the source editor; only website countries appear in the main matrix.

The old `/country` HTML scraper, RSS announcement fetch, scraping update POST, and legacy export/message generation are removed. Old read-only country-list and history URLs redirect or display the new manager. The standalone shipping-method CSV checker remains available. Archival Japan Post database tables are retained.

## Verification

```sh
npm test -- --runTestsByPath tests/countryManager.test.js tests/countryManagerBrowser.test.js tests/countryManagerTracker.test.js
```

Database/HTTP tests explicitly require a **disposable** MySQL instance with database `gcs_country_test`, user `root`, and empty password. They recreate only their test models and never load `.env` or the application database module:

```sh
COUNTRY_MANAGER_TEST_MYSQL_PORT=33310 npm test -- --runTestsByPath tests/countryManagerDatabase.test.js
```

Coverage includes legacy baseline, internal extra countries, strict imports, all carrier fields, source removals, mapping changes, unknown states, exception precedence/removal, historical resolution, unchanged imports, transaction rollback, concurrent stale updates, authentication/CSRF, escaped rendering, historical editing restrictions, and retired scraper routes. Review dark/light themes and a narrow viewport using representative data.
