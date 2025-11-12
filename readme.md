# Food Additive Catalogue

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

## Web Analytics

Ahrefs Web Analytics is installed globally via the App Router layout. The snippet below is embedded in `src/app/layout.tsx` so it loads on every page:

```html
<script
  src="https://analytics.ahrefs.com/analytics.js"
  data-key="Fj7+bX0Bk8e745CrMY+rpQ"
  async
></script>
```

If the data key changes, update the `data-key` attribute in the layout script tag and redeploy the site to apply the new configuration.
