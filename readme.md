# Food Additives Catalogue

A static catalogue that showcases a curated list of food additives. The site is built with Next.js, TypeScript, and MUI and presents each additive as a card in a clean, monochrome grid. Selecting a card reveals a detail page with synonyms, functions, descriptions, and links to further reading.

## Tech stack

- [Next.js 15](https://nextjs.org/) with the App Router and server actions for incremental data loading
- [TypeScript](https://www.typescriptlang.org/)
- [MUI](https://mui.com/material-ui/) with Roboto typography and custom grayscale theme
- Static data files in `data/` (`additives.json` index plus per-additive folders)

## Getting started

```bash
npm install
npm run dev
```

The development server is available at [http://localhost:3000](http://localhost:3000). The site is fully static, so no runtime APIs are required.

### Core scripts

| Command        | Description                                      |
| -------------- | ------------------------------------------------ |
| `npm run dev`  | Starts the local development server              |
| `npm run lint` | Runs the Next.js lint rules (ESLint)             |
| `npm run build`| Builds the production bundle (server actions enabled) |
| `npm run generate-card-preview` | Generates circular 512×512 social preview images for additive cards |

## Project structure

```text
├── app/                        # App Router entrypoints, layouts, and pages
│   ├── [slug]/                 # Static additive detail pages
│   ├── globals.css             # Global styles and layout scaffolding
│   ├── layout.tsx              # Shared layout with header and footer
│   └── page.tsx                # Grid of additives with function pills
├── components/                 # Client-side providers and shared helpers
├── data/
│   ├── additive/<slug>/props.json   # Complete additive metadata and metrics
│   ├── additive/<slug>/searchHistory.json # Ahrefs keyword volume history
│   └── additives.json          # Index of additives with title and E-number
├── lib/                        # Utility helpers (theme, data loading, slugs)
├── public/                     # Public assets (placeholder)
├── vercel.json                 # Vercel static export configuration
└── readme.md                   # Project documentation (this file)
```

## Infinite scroll and payload size

The additive grids now use an infinite-scroll experience powered by server actions. Only the first 50 card summaries are rendered during SSR; subsequent batches are streamed in 50-item chunks as the user scrolls.

| Payload | Size (JSON) | Notes |
| ------- | ----------- | ----- |
| First 50 additives | ~15 KB | Sent with the initial response |
| Full catalogue (566 additives) | ~159 KB | Previously shipped on first load |

This trims the initial data payload by roughly **90%** while keeping the UI responsive as more additives load. In development there is a lightweight cache with a short TTL to avoid repeatedly rebuilding the dataset on every scroll.

## Deployment

The project is configured for Vercel. Use `npm run build` followed by `npm run start` to preview the production build locally; server actions require a Node runtime rather than a static export.

## Card preview generator

Use `npm run generate-card-preview` to render 512×512 card thumbnails that can be reused in meta tags.

- **Rendering** — The script starts a temporary Next.js server, loads the `/preview/card/[slug]` route in a headless Chromium session, and masks each capture to a circular PNG. Images are written to `public/card-previews/<slug>.png`.
- **Modes** — Bulk runs skip existing files unless `--override` is provided. Targeted runs via `--additive` always refresh the requested slugs (e.g. `npm run generate-card-preview -- --additive e414-acacia-gum`).
- **Performance** — The CLI mirrors the data pipeline flags (`--additive`, `--override`, `--debug`) and exits with a non-zero code if any capture fails.
- **Social requirements** — Twitter/X supports 2:1 images from 300×157 up to 4096×4096, and Facebook recommends at least 1200×630 pixels while accepting 600×315 and square crops. The 512×512 output stays within both guidelines and keeps consistent branding across platforms.【4e17d1†L1-L5】【0a70dd†L1-L2】

When testing locally, generate a small sample (two or three cards), review the PNGs, and delete them before committing.
