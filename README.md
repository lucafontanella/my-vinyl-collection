# My Vinyl Collection

**My Vinyl Collection** is a Progressive Web App (PWA) designed to catalogue and manage a personal vinyl record collection.

The application is designed for use on desktop computers, smartphones and tablets, with an interface optimized for browsing and managing a personal music collection.

## Features

- **Personal catalogue:** add, view, edit and delete vinyl records.
- **Physical copy management:** each entry represents a single physical copy, identified by a unique ID. Multiple copies of the same album can be catalogued separately.
- **Cover artwork:** upload images from a device or use external image URLs.
- **Record details:** view detailed information and cover artwork for each record.
- **Search:** search by artist, album, year, genre, record label and additional information.
- **Sorting:** organize the catalogue by artist, album, year and date added.
- **CSV import and export:** import existing catalogues and export records in a format compatible with spreadsheet applications such as Microsoft Excel.
- **Cloud synchronization:** integration with Google Sheets to synchronize the catalogue across devices.
- **Cover storage:** Google Drive integration for storing cover images separately from the spreadsheet.
- **Deletion management:** deleted records are marked in the archive rather than immediately removed, preserving information during synchronization.
- **PWA installation:** install the application on compatible devices and access it through a dedicated app interface.

## Architecture

The application is built using standard web technologies and the following services:

- **Frontend:** HTML, CSS and JavaScript.
- **Local storage:** browser `localStorage`, used to keep a local copy of the catalogue.
- **Cloud storage:** Google Sheets, used as the central catalogue archive.
- **Image storage:** Google Drive, used to store album cover artwork.
- **Authentication:** Google Identity Services and OAuth 2.0.
- **Hosting:** GitHub Pages.
- **Application installation:** Progressive Web App (PWA), using a web app manifest and Service Worker.
- **Deployment:** GitHub Actions.

Synchronization with Google Sheets is manually initiated by the user through the **Sync Now** function.

Local and cloud records are compared using their modification timestamps. Cover images are managed separately through Google Drive.

## Data structure

The Google spreadsheet used by the application is named `My Vinyl Collection` and contains a worksheet called `Vinili`.

The worksheet uses the following columns:

| Field | Description |
|---|---|
| ID | Unique record identifier |
| Artist | Artist or band name |
| Year | Release year |
| Album | Album title |
| Genre | Music genre |
| Label | Record label |
| Info | Additional information |
| Cover | Image reference |
| Date Added | Record creation date |
| Date Modified | Last modification date |
| Deleted At | Deletion timestamp, if applicable |

Each physical copy has its own unique ID, including multiple copies of the same album.

## Getting started

The application is published on GitHub Pages:

[My Vinyl Collection](https://lucafontanella.github.io/my-vinyl-collection/)

To run the project locally:

1. Clone or download the repository.
2. Open the `app` directory.
3. Start a local static server, for example:

   `python -m http.server 8000`

4. Open `http://localhost:8000` in your browser.

To install the application on a compatible device, open the published HTTPS address and use the browser's installation or Add to Home Screen option.

## Repository structure

```text
my-vinyl-collection/
│
├── app/
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   ├── manifest.webmanifest
│   ├── sw.js
│   └── icons/
│
└── .github/
    └── workflows/
        └── deploy.yml
```

## Synchronization across devices

Each device maintains its own local copy of the catalogue. Google Sheets acts as the shared archive for devices connected to the same Google account.

To transfer changes between devices:

1. Sign in with Google on the source device.
2. Run synchronization to upload the latest changes to Google Sheets.
3. Sign in with the same Google account on the destination device.
4. Run synchronization to retrieve the updated catalogue.

Google Drive is used for cover artwork, while Google Sheets stores the catalogue data.

## Project status

The project is currently functional and under active development.

The main catalogue management features, cover handling, CSV import and export, Google synchronization and PWA installation have been implemented.

Further development will focus on improving the user experience, expanding search capabilities and making the application architecture more flexible.
