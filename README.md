# GCS Tool
Data handling tool

## Install options
- Install with included nodejs+express webserver
- Upload the tool to an existing webserver (only need content from public folder)

## External files
Besides the HTML/CSS/JavaScript files, the tool additionally loads the following 2 JSON data files.
- `Master.json` is loaded from the webserver
- `json_personal` is loaded from the browsers local storage

*Note: `Master.json` needs to be manually uploaded to the server, while `json_personal` is updated automatically when using the tool.*

## Handled data
- Templates

A simple piece of text that can easily be copy&pasted

- Manuals

HTML formated text

- Company Contact

Basically the same as templates, but a separate category

## How to add data?
Data can be added from the Edit page.

When changing settings or adding personal data, the data is saved automatically in the browser.

*Note: Should you clear your browser memory or switch to a different browser, the data will be lost. It is however possible to access the data from the save page to save a backup copy of the data if needed.*

When adding master data, it is necessary to manually save the data through the save page, and manually upload the data to the server.
