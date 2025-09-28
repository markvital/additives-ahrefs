# Food Additives Catalogue

A static catalogue that showcases a curated list of food additives. The site is built with Next.js, TypeScript, and MUI and presents each additive as a card in a clean, monochrome grid. Selecting a card reveals a detail page with synonyms, functions, descriptions, and links to further reading.

## Tech stack

- [Next.js 14](https://nextjs.org/) with the App Router and static export (`output: export`)
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
| `npm run build`| Produces a static export in the `out` directory  |

## Project structure

```text
├── app/                        # App Router entrypoints, layouts, and pages
│   ├── [slug]/                 # Static additive detail pages
│   ├── globals.css             # Global styles and layout scaffolding
│   ├── layout.tsx              # Shared layout with header and footer
│   └── page.tsx                # Grid of additives with function pills
├── components/                 # Client-side providers and shared helpers
├── data/
│   ├── additives.json          # Index of additives with title and E-number
│   ├── <slug>/props.json       # Complete additive metadata and metrics
│   └── <slug>/searchHistory.json # Ahrefs keyword volume history
├── lib/                        # Utility helpers (theme, data loading, slugs)
├── public/                     # Public assets (placeholder)
├── vercel.json                 # Vercel static export configuration
└── readme.md                   # Project documentation (this file)
```

## Deployment

The project is configured for Vercel. Running `npm run build` outputs the fully static site to the `out` directory, which Vercel can host without additional configuration. To preview the production build locally, use a static server such as `npx serve out`.
