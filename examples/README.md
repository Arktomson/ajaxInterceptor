# Examples

This folder contains practical examples for common promotion/demo scenarios.

## Run Locally

1. Build the library:

```bash
pnpm run build
```

2. Start any static file server from repository root (example):

```bash
npx serve .
```

3. Open examples in browser:

- `examples/vanilla-xhr-fetch/index.html`
- `examples/streaming-ndjson/index.html`
- `examples/chrome-extension/README.md` (extension setup guide)

## Included

- `vanilla-xhr-fetch`: minimal browser demo for unified XHR + Fetch hooks.
- `streaming-ndjson`: chunk-level streaming interception demo.
- `chrome-extension`: MV3 content script example for request governance.
