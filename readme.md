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

| Command                  | Description                                                             |
| ------------------------ | ----------------------------------------------------------------------- |
| `npm run dev`            | Starts the local development server                                     |
| `npm run lint`           | Runs the Next.js lint rules (ESLint)                                    |
| `npm run build`          | Builds the production bundle (server actions enabled)                   |
| `npm run generate-card-preview` | Renders additive cards in a headless browser and saves 512×512 previews |

### Card preview generation

Social sharing previews can be created with `npm run generate-card-preview`. The command launches a headless Chromium instance
via Playwright, renders the additive grid using the production Next.js build, and stores circular 512×512 PNG files under
`public/card-previews/<slug>.png`.

- **Bulk mode** — running the command without arguments walks the entire catalogue, skipping existing previews unless
  `--override` is supplied.
- **Targeted mode** — pass `--additive <slug>` (or a comma-separated list) to regenerate specific cards. Targeted runs always
  refresh the requested files.
- **Existing server** — supply `--base-url=https://example.com` to reuse a running deployment instead of starting a local
  `next start` instance. This is helpful when the build output already exists elsewhere.

All options mirror the other scripts in `src/scripts`, so `--limit`, `--parallel`, and `--debug` behave as expected. Facebook
accepts 1:1 square previews when they are at least 600 pixels wide, while Twitter’s Summary Card with Large Image supports
2:1 art but also allows up to 4096×4096 images, so a 512×512 asset is valid for both platforms.【6e0385†L18-L33】【ef5c5e†L8-L13】

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
