# Acquisity DFY Website Funnel Template

This is a Vite + React done-for-you website funnel template used by the
Acquisity website agent. Generated sections handle presentation, while lead
capture, analytics, offer display, and checkout remain managed blocks in
`app-builder.blocks.json`.

## Development

Install dependencies:

```bash
bun install
```

Run the development server:

```bash
bun run dev
```

Open `http://localhost:5173` in your browser. To bind a specific host and port, such as inside Vercel Sandbox:

```bash
bun run dev -- --host 0.0.0.0 --port 3000 --strictPort
```

## Validation

Run the policy check:

```bash
bun run policy:check
```

Run typecheck and lint:

```bash
bun run typecheck
bun run lint
```

Build the static site:

```bash
bun run build
```

Run the production smoke test:

```bash
bun run smoke
```

## Preview

After building, run Vite preview:

```bash
bun run preview
```

To expose a specific host and port:

```bash
bun run preview -- --host 0.0.0.0 --port 3000 --strictPort
```

## Deploy to Cloudflare

This project is configured to deploy to **Cloudflare Workers with Static Assets**.

### Prerequisites

1. Install Wrangler globally (or use via `bunx`):

   ```bash
   bun add -g wrangler
   ```

2. Authenticate with your Cloudflare account:

   ```bash
   wrangler login
   ```

### Deploy to Production

Build the project and deploy:

```bash
bun run build
bun run deploy
```

### Deploy a Preview Version

To upload a preview version without affecting production traffic:

```bash
bun run build
bun run deploy:preview
```

### How it works

- `bun run build` generates static assets in `dist/` and prerenders all routes.
- `worker/index.ts` handles incoming requests: it serves static files from the `ASSETS` binding and falls back to `index.html` for SPA routing.
- `wrangler.toml` configures the Worker to use the `dist/` directory as its static asset bucket.
