# ChessMix

A Next.js-based chess application with Stockfish integration.

## GitHub Pages Deployment

This app is deployed on GitHub Pages and uses a service worker to add the required security headers for SharedArrayBuffer support. This allows the Stockfish chess engine to work with full functionality even on GitHub Pages.

### How It Works

The app uses a special service worker (`coi-serviceworker.js`) that adds the following security headers to every response:

- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`

These headers enable SharedArrayBuffer support, which is required for the WASM-based Stockfish engine.

The service worker works as follows:

1. When the page loads for the first time, it registers the service worker
2. The service worker adds the required security headers to all responses
3. The page reloads automatically
4. After the reload, SharedArrayBuffer is available and the WASM Stockfish engine can run

### Browser Support

This approach works on all major browsers that support both service workers and WebAssembly threads:

- Chrome/Edge
- Firefox
- Safari (version 15.2+)

## Local Development

```bash
npm install
npm run dev
```

This will start the app at http://localhost:9002 where all features will work correctly.

## Building for Production

```bash
npm run build
```

## Deployment

Push to the master branch to trigger the GitHub Actions workflow that will deploy to GitHub Pages.

ChessMix © 2025 by Gabriel Dournois is licensed under CC BY-NC-ND 4.0
