<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Wildlife Field Guide

This contains everything you need to run the app locally and deploy it to GitHub Pages or Cloudflare Pages.

View your app in AI Studio: https://ai.studio/apps/220b4af3-d25d-494c-9de3-8e771696e4da

## Run Locally

**Prerequisites:** Node.js 24


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in `.env.local` to your Gemini API key.
3. Run the app:
   `npm run dev`

## Deploy

The Vite build uses relative asset paths, so the same `dist` folder works on both GitHub Pages subpaths and Cloudflare Pages root domains.

### GitHub Pages

1. Add a repository secret named `GEMINI_API_KEY` in GitHub Actions secrets.
2. Push to `main` or `master`.
3. The workflow in `.github/workflows/deploy.yml` builds and publishes `dist`.

### Cloudflare Pages

Use these settings when creating the Pages project:

- Framework preset: Vite
- Build command: `npm run build`
- Build output directory: `dist`
- Node.js version: `24`
- Environment variable: `GEMINI_API_KEY`

`wrangler.toml` is included so Cloudflare can identify the Pages output directory when using Wrangler.
