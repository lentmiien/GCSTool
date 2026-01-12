# GCS Tool
Data handling tool

## Install options
- Install with included nodejs+express webserver
-- MySQL database required

## External files
Besides the PUG(HTML)/CSS/JavaScript files, the tool additionally loads personal settings from the browsers local storage, as well as data from MySQL database.
- `json_personal` is loaded from the browsers local storage
- `tool data` is loaded from MySQL database

## Database structure
- `content`: The actual content data, linked to entries
- `entry`: The entries of data used by the tool, the content data is stored in separate table
- `holiday`: Stores holidays for scheduler
- `schedule`: Stores schedule for staff members, linked to staff
- `staff`: Staff members for scheduler, schedule data is stored in separate table
- `user`: Users of the tool, only users registered in this table can access the data in the tool

## Database seed script
- Copy `env_sample` to `.env` and fill in the required DB variables.
- Optional: override defaults for the initial admin with `SEED_ADMIN_USER`, `SEED_ADMIN_PASS`, `SEED_ADMIN_NAME`, and `SEED_ADMIN_TEAM` (defaults: admin / changeme / same as user id / gcs).
- Run `npm run seed` to sync the databases and create the first user, matching username display entry, and scheduler staff record if they do not exist.

## Handled data
- Templates

A simple piece of text that can easily be copy&pasted

- Manuals

HTML formated text

- Company Contact

Basically the same as templates, but a separate category

- Schedule

An easy to view schedule of who is working

## How to add data?
Data can be added from within the tool. For adding master data (data available for all users) and schedule data, you need to be an admin user.

When changing settings, the data is saved automatically in the browser. For all other data, the data is saved automatically to the database.

*Note: Should you clear your browser memory or switch to a different browser, then your personal settings will be lost. If you register your previous username when re-opening the page, you will be able to access all your saved data in the database.*
