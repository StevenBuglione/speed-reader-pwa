# Speed Reader PWA

A private, offline-ready ebook reader with integrated speed-practice tools. The app runs entirely in the browser, stores books locally with IndexedDB, and can be installed from GitHub Pages as a PWA.

## Features

- EPUB, TXT, and text-based PDF import
- Built-in sample reading so first-time users can try the app immediately
- Full reader view with themes, chapter navigation, search, and saved position
- RSVP speed-practice mode with WPM presets from 250 to 900
- Challenge ramp inspired by the YouTube speed-reading challenge
- Comprehension self-checks and local practice history
- Offline app shell and installable PWA behavior

## Privacy

Uploaded books stay in the user's browser. There is no backend, account system, analytics, or cloud sync in this version.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The production build is configured for GitHub Pages at `/speed-reader-pwa/`.
