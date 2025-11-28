# Deploying to Vercel

This file shows the minimal steps to deploy this Vite + React app to Vercel.

## Using the Vercel Dashboard

1. Go to https://vercel.com and import the repository.
2. When prompted, set the Build Command to `npm run build` and the Output Directory to `dist` (Vercel usually detects Vite automatically).
3. In Project Settings → Environment Variables add `GEMINI_API_KEY` with your API key for Production and Preview as required.
4. Deploy.

## Using the Vercel CLI

1. Install the CLI globally if you haven't already:

   npm i -g vercel

2. From the project root run:

   vercel

   Follow the interactive prompts. Use `npm run build` as the build command and `dist` as the output directory when asked.

3. Add the environment variable with the CLI if you prefer:

   vercel env add GEMINI_API_KEY production

## Notes

- This repo includes `vercel.json` which sets up a static-build and routes all paths to `index.html` to support an SPA.
- The app reads `process.env.GEMINI_API_KEY` via Vite's define; make sure the env var is configured in Vercel.
- If you prefer documentation inside the repo root, copy this content into `README.md` under a "Deploy to Vercel" section.
