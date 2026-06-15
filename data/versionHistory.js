const item = (text, children = []) => ({ text, children });

module.exports = [
  {
    version: '2.9.11',
    releaseDate: '2026-06-15',
    updateDate: '2026-06-15',
    items: [
      item('HS', [
        item('Ireland/Greece CSV editor - Expanded the Ireland CSV workflow to process Greece (GR) rows alongside Ireland (IE) rows'),
        item('Ireland/Greece CSV editor - Start the streamlined workflow automatically after upload: remove Toy prefixes, run HS-to-TARIC automation, open review when needed, save the work summary, and export the CSV'),
        item('Ireland/Greece work summary - Store and export country codes so IE and GR orders can be tracked separately'),
      ]),
      item('DHL Compensation', [
        item('Use safe generated PDF filenames based on order and tracking details, and prevent uploaded PDFs from overwriting existing files'),
        item('Keep PDF download names safe while showing the stored PDF name in the open-entry list'),
      ]),
    ],
  },
  {
    version: '2.9.10',
    releaseDate: '2026-05-22',
    updateDate: '2026-05-22',
    items: [
      item('HS', [
        item('Ireland CSV editor - Added suggested TARIC quick selection from previous mappings, ranked by exact item + HS matches and partial matches'),
        item('Ireland CSV editor - Added TARIC explanation database and management page for codes missing explanations'),
        item('Ireland CSV editor - Added barcode search links in manual review for AmiAmi COM, AmiAmi JP, and Google'),
        item('Ireland CSV editor - Save work summaries to the database instead of copying CSV text to the clipboard'),
        item('Ireland CSV editor - Added tracking number import and monthly order/tracking export pages for saved work summaries'),
      ]),
      item('About', [
        item('Moved version history to a database-backed update log and seeded existing entries'),
      ]),
      item('Tracker', [
        item('Return shipping cost analytics - Added country sections with p95 amount bar charts and detail tables sorted by total entry count'),
      ]),
    ],
  },
  {
    version: '2.9.9',
    releaseDate: '2026-04-23',
    updateDate: '2026-04-23',
    items: [
      item('DHL Compensation', [
        item('Added optional PDF upload and download support for open compensation entries'),
        item('Automatically delete stored PDF files when entries are marked as completed'),
        item('Added a dedicated delete tab for removing incorrectly added entries and their related PDF files'),
      ]),
      item('Tracker', [
        item('Shipping monitor compare - Added a read-only shortcut index and comparison page for opening saved monitor group comparisons from the navbar'),
        item('Shipping monitor compare - Reused shared tracker monitor data without writing cache updates or changing saved group metadata'),
        item('Shipping monitor compare - Added dark mode friendly page styling and updated comparison charts for better readability'),
      ]),
    ],
  },
  {
    version: '2.9.8',
    releaseDate: '2026-04-06',
    updateDate: '2026-04-06',
    items: [
      item('HS', [
        item('Ireland CSV editor - Added TARIC mapping support, manual TARIC review, work summary copy, and item name cleanup tools'),
      ]),
      item('DHL Compensation', [
        item('Added admin tool for tracking DHL compensation entries, estimated transaction dates, and completed transactions'),
      ]),
      item('Lennart', [
        item('Host samples - Added a page for reviewing stored host monitor samples, with hostname filtering and process details'),
      ]),
      item('Server app', [
        item('Added standalone host monitor collection and cleanup scripts for cron jobs, with database storage and 30-day retention support'),
      ]),
      item('Documents', [
        item('Invoice generator - Normalize full-width Japanese spaces to regular spaces in input fields to prevent invoice endpoint crashes'),
      ]),
    ],
  },
  {
    version: '2.9.7',
    releaseDate: '2026-03-03',
    updateDate: '2026-03-03',
    items: [
      item('ChatGPT', [
        item('Shorten item names tool - Remove commas and enforce max length'),
      ]),
      item('HS', [
        item('Ireland CSV editor - Added client-side editor for IE rows with CSV export'),
      ]),
      item('Documents', [
        item('Return request - Updated to new PDF format'),
      ]),
    ],
  },
  {
    version: '2.9.6',
    releaseDate: '2026-02-11',
    updateDate: '2026-02-11',
    items: [
      item('Navbar', [
        item('Hidden label/invoice request controls, as process changed'),
      ]),
      item('Policy Manual Template', [
        item('Added new tool for managing Manual Template, that also manage Policies, with version control'),
      ]),
      item('ChatGPT', [
        item('Shorten item names tool - Add last processed date and additional instructions'),
      ]),
      item('Image PDF tool', [
        item('Added a tool for generating PDF files, with product details and images'),
        item('Linked up to my product summary API'),
      ]),
      item('Lennart', [
        item('Added a tool for converting ZPL to Image'),
      ]),
      item('Tracker', [
        item('Fixed bug from changing database format'),
      ]),
    ],
  },
  {
    version: '2.9.5',
    releaseDate: '2025-03-24',
    updateDate: '2025-03-24',
    items: [
      item('Reminder', [
        item('Allow to set weekdays for reminders'),
      ]),
      item('Shipping method CSV checker', [
        item('A tool for checking the content of CSV files to set available shipping methods for our website, in an easy to read format'),
      ]),
      item('Multi-language', [
        item('Switching from custom solution to use "i18n" instead (content transation planned in small steps going forward)'),
      ]),
      item('Content', [
        item('Switched to use Marked library, when parsing AI responses to HTML'),
      ]),
      item('Server app', [
        item('Updated various dependencies to newer or latest versions'),
      ]),
      item('Case tracker', [
        item('Added first version of a case tracker, for tracking customer cases, including collecting details about items and processing related refunds'),
      ]),
      item('Layout', [
        item('Added additional copy functions for generating massages to share the information, including adding a database for staff member names'),
      ]),
      item('Form', [
        item('Rebrand as feedback function, and enforce type label as required input'),
      ]),
    ],
  },
  {
    version: '2.9.4',
    releaseDate: '2024-05-31',
    updateDate: '2024-05-31',
    items: [
      item('Session', [
        item('Add session store'),
      ]),
      item('ChatGPT', [
        item("Update to use latest 'gpt-4o' model"),
      ]),
    ],
  },
  {
    version: '2.9.3',
    releaseDate: '2024-04-26',
    updateDate: '2024-04-26',
    items: [
      item('ChatGPT', [
        item('Shorten item names tool - Add progress bar'),
      ]),
    ],
  },
  {
    version: '2.9.2',
    releaseDate: '2024-04-17',
    updateDate: '2024-04-17',
    items: [
      item('ChatGPT', [
        item('Shorten item names tool'),
      ]),
      item('Scheduler', [
        item('When staff has over 1 week off, display "-- No work scheduled for next week, or longer --" instead of schedule'),
      ]),
    ],
  },
  {
    version: '2.9.1',
    releaseDate: '2023-11-14',
    updateDate: '2023-11-14',
    items: [
      item('Tracker', [
        item('Bug fixes: Added link to access page'),
      ]),
      item('Documents', [
        item('Bug fixes: Added link to access page and fixed link in form'),
      ]),
      item('Content', [
        item('Increase max length (TEXT[65,535 char] -> LONGTEXT[4,294,967,295 char])'),
      ]),
    ],
  },
  {
    version: '2.9.0',
    releaseDate: '2023-09-22',
    updateDate: '2023-09-22',
    items: [
      item('Country', [
        item('New function as shipping method manager, and assist update process'),
      ]),
      item('Form', [
        item('Work with custom labels, and label based content'),
      ]),
      item('Meeting', [
        item('Store data in database instead of google spredsheet'),
      ]),
      item('Tracker', [
        item('Add tracking functionality'),
      ]),
      item('Documents', [
        item('New document templates: Invoice'),
      ]),
      item('Server - socket.io', [
        item('Handle meeting updates'),
      ]),
    ],
  },
  {
    version: '2.8.0',
    releaseDate: '2023-05-19',
    updateDate: '2023-05-19',
    items: [
      item('Lennart', [
        item('Fix so that my test function for AIT updates can update the manual by the click of a button'),
        item('Added ChatGPT function (view chats, send follow up messages, view monthly cost)'),
      ]),
      item('Add/Update temapltes and manuals', [
        item('Added AI (ChatGPT) assistant, write some instructions and press the "AI" button and ChatGPT will return a text following the instructions (can be used for generating new text or modify existing text)'),
      ]),
      item('Server app', [
        item('Replaced bcrypt with bcryptjs'),
        item('Added appropriate routes for ChatGPT and store data in a database'),
      ]),
    ],
  },
  {
    version: '2.7.4',
    releaseDate: '2023-03-24',
    updateDate: '2023-03-24',
    items: [
      item('Top/Content', [
        item('Highlight "[...]" content in content titles'),
      ]),
    ],
  },
  {
    version: '2.7.3',
    releaseDate: '2023-03-15',
    updateDate: '2023-03-15',
    items: [
      item('Form', [
        item('Added a form route for collecting data on certain specific cases (input form and download data in CSV format)'),
      ]),
    ],
  },
  {
    version: '2.7.2',
    releaseDate: '2023-01-16',
    updateDate: '2023-01-16',
    items: [
      item('Layout', [
        item('Added holiday work notice (shows up if there is 1+ holidays next week, and show a list of staff working those days)'),
        item('Hide Zendesk talk notice'),
      ]),
    ],
  },
  {
    version: '2.7.1',
    releaseDate: '2022-12-02',
    updateDate: '2022-12-02',
    items: [
      item('Shipping costs', [
        item('Cost manager: bugfix for display of DHL and Surface Mail Premium'),
      ]),
      item('Javascript "lg_update.js"', [
        item('Color updated HTML elements *useful for manuals (within 24 hours: yellow border, within 1 week: green background, within 1 month: yellow background, within 3 months: blue background)', [
          item('*Applies for all html with data-update="2022-11-28" attribute set (given date should be update date)'),
        ]),
      ]),
      item('Lennart test endpoint', [
        item('A new endpoint for misc. tools used by Lennart and testing new stuff'),
        item('Tool: convert AIT spredsheet to manual'),
      ]),
    ],
  },
  {
    version: '2.7.0',
    releaseDate: '2022-11-02',
    updateDate: '2022-11-02',
    items: [
      item('HS code', [
        item('Editor version 2 (view and edit list of all unique entries at top, or each order at bottom, also new popup interface for selecting HS codes)'),
        item('Manual editor (copy-paste invoice item names and get HS code output)'),
        item('Checker (For checking output files, verifying HS codes)'),
        item('Database (For editing saved entries)'),
      ]),
      item('Shipping costs', [
        item('Cost tables: A view layout for checking shipping rate charts from different points in time, and downloading csv files with those shipping costs'),
        item('Cost manager: A tool for managing shipping rate tables and generating HTML formated tables for sharing (Automatically acquire latest fees for Japan Post shipping methods)'),
      ]),
      item('Layout', [
        item('Adjust "Test" to English/Japanese, so text lines up better'),
      ]),
      item('Server app', [
        item('Necessary additions for new HS code functionality'),
        item('Necessary additions for Shipping costs functionality'),
      ]),
    ],
  },
  {
    version: '2.6.2',
    releaseDate: '--',
    updateDate: '2022-11-02',
    items: [
      item('Shipping', [
        item('Hide average and last shipped columns (because is not updated)'),
      ]),
      item('Server app', [
        item('Package cleanup and update (removing unused packages and updating old packages)'),
        item('Cleanup and update package.json'),
      ]),
    ],
  },
  {
    version: '2.6.1',
    releaseDate: '2022-05-11',
    updateDate: '2022-05-11',
    items: [
      item('Tracker', [
        item('Show fullscreen popup on top (bug fix, hide "Add" button)'),
      ]),
    ],
  },
  {
    version: '2.6.0',
    releaseDate: '2022-05-10',
    updateDate: '2022-05-10',
    items: [
      item('Scheduler update', [
        item('All staff one year schedule available to everyone'),
        item('JSON file for scheduler settings (days off/holiday count)'),
      ]),
      item('Tracker', [
        item('A tool for keeping track on certain shipments (the list of tracking numbers is saved in the browser for each user)'),
      ]),
      item('Feedback', [
        item('Temporarilly hide feedback function'),
      ]),
    ],
  },
  {
    version: '2.5.0',
    releaseDate: '2021-10-24',
    updateDate: '2021-10-24',
    items: [
      item('HS code tool', [
        item('Tool for editing CSV files, add HS codes to the file'),
      ]),
    ],
  },
  {
    version: '2.4.1',
    releaseDate: '2020-11-26',
    updateDate: '2020-11-26',
    items: [
      item('Japan Post news', [
        item('Show news from Japan Post (updated twice a day)'),
      ]),
      item('Binpacker *Experimental', [
        item('A tool for packing items in boxes and visualize the result'),
      ]),
    ],
  },
  {
    version: '2.4.0',
    releaseDate: '2020-10-12',
    updateDate: '2020-10-12',
    items: [
      item('Scheduler update', [
        item('Remove team schedule and added 2 weeks schedule'),
        item('All translation done'),
      ]),
      item('Feedback function added', [
        item('Every one can add feedback to feedback database (intended for renewal feedback)'),
        item('English only'),
      ]),
      item('Timekeeper (prototype)', [
        item('Auto logging function for start/end using the tool every day per user'),
        item('English only'),
      ]),
    ],
  },
  {
    version: '2.3.0',
    releaseDate: '2020-06-17',
    updateDate: '2020-06-17',
    items: [
      item('Shipping average times function', [
        item('per country and shipping method'),
        item('Shows which shipping methods that are available and if there are any delays'),
        item('Average shipping time graph'),
      ]),
      item('Document creating function', [
        item('DHL return request'),
        item('DHL import tax'),
      ]),
    ],
  },
  {
    version: '2.2.0',
    releaseDate: '2020-04-15',
    updateDate: '2020-04-15',
    items: [
      item('Changed to user login system', [
        item('Non-logged in users can only access login page'),
      ]),
    ],
  },
  {
    version: '2.1',
    releaseDate: null,
    updateDate: null,
    items: [
      item('Sound effects for reminders'),
      item('Licence details on about page'),
      item('Scheduler added Holiday (national holidays) and Vacation (additional days off)'),
      item('Added yearly schedule'),
      item('Schedule main layout shows 1 week schedule for all staff members'),
      item('Possible to do a search on Content page on open page, through GET parameters'),
    ],
  },
  {
    version: '2.0',
    releaseDate: null,
    updateDate: null,
    items: [
      item('Some parts of the tool moved to server side (Using Node.js, Express, Sequalize(MySQL))'),
      item('Dynamic HTML page with dynamic content loaded from database on server (Personal data also saved on server)'),
      item('Handling Templates, Manuals, Company Contact Templates data'),
      item('Add/Edit function within the tool, with data saved automatically on server'),
      item('Includes Dark color mode and Scheduler function', [
        item('Scheduler function supports: Work full day, 2hrs off in morning/evening, half day off in morning/evening, full day off'),
      ]),
      item('Used by international customer support mail team'),
    ],
  },
  {
    version: '1.5',
    releaseDate: null,
    updateDate: null,
    items: [
      item('Static HTML page with dynamic content loaded from server (Master data) and browser memory (Personal data)'),
      item('Handling Templates, Manuals, Company Contact Templates data'),
      item('Add/Edit function within the tool, where Personal data is saved automatically, but Master data need to be saved manually and the file needs to be manually updated on the server'),
      item('Search function for finding templates/manuals/assistance calculators/company contact templates'),
      item('Dark color mode added'),
      item('Scheduler function added (data handled the same way as Master data)'),
      item('Used by international customer support mail team'),
    ],
  },
  {
    version: '1.0',
    releaseDate: null,
    updateDate: null,
    items: [
      item('Static HTML page with dynamic content loaded by copy-pasting data from a local text file'),
      item('Handling Templates, Manuals, Assistance Calculator, Company Contact Templates data'),
      item('Add/Edit function within the tool, but need to manually save data to local text file'),
      item('Search function for finding templates/manuals/assistance calculators/company contact templates'),
      item('Used by international customer support mail team'),
    ],
  },
  {
    version: '0.5',
    releaseDate: null,
    updateDate: null,
    items: [
      item('Static HTML page with dynamic content loaded by copy-pasting data from a local text file'),
      item('Function for adding templates within tool, but need to manually save data to local text file'),
      item('Search function for finding templates'),
      item('Only used by Lennart'),
    ],
  },
  {
    version: '0.1',
    releaseDate: null,
    updateDate: null,
    items: [
      item('Static HTML page with some links and sections for easier navigation to the various templates'),
      item('Only used by Lennart'),
    ],
  },
];
