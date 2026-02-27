# Chrome Extension Example (MV3)

This sample shows how to use `ajax-hooker` in a content-script context for request governance.

## Files

- `manifest.json`: extension config.
- `content.js`: injects hooks on page-side requests.
- `vendor/ajax-hooker.iife.js`: copy from `dist/iife/index.js`.

## Setup

1. Build the library:

```bash
pnpm run build
```

2. Copy build output:

```bash
cp dist/iife/index.js examples/chrome-extension/vendor/ajax-hooker.iife.js
```

3. Open `chrome://extensions`, enable Developer mode, then load unpacked folder:

```text
examples/chrome-extension
```

## What it does

- Injects interceptor for both XHR and Fetch.
- Adds a custom request header.
- Logs request/response information in page console.
