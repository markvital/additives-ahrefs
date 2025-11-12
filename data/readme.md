# Data directory

This folder stores the static dataset that powers the catalogue. All files are committed so the site can be exported statically without runtime API calls.

## Layout

```
/data
├── additive/
│   └── <slug>/
│       ├── props.json
│       ├── searchHistory.json
│       ├── searchHistoryFull.json
│       └── searchVolume.json
├── additives.json
```

- **`additives.json`** — lightweight index used during static generation. Each entry includes only the additive `title` and `eNumber`. The slug for each additive is derived from these two fields using the format `<eNumber>-<title>`, lowercased and slugified. If either field is missing the slug falls back to the available value.
- **`additive/<slug>/props.json`** — full metadata for a single additive. Keys include:
  - `title`
  - `eNumber`
  - `synonyms`
  - `searchKeywords` — optional supplementary keywords that are force-included when querying Ahrefs.
  - `searchFilter` — optional list of keywords that should be excluded from Ahrefs calls.
  - `functions`
  - `description`
  - `wikipedia`
- **`additive/<slug>/searchHistory.json`** — aggregated monthly keyword volume returned by the Ahrefs API (summed across all keywords) plus a precomputed ten-year sparkline.
- **`additive/<slug>/searchHistoryFull.json`** — raw keyword-level history returned by the Ahrefs API. Useful for debugging and secondary analysis; not shipped to the client.
- **`additive/<slug>/searchVolume.json`** — aggregated snapshot of the latest monthly search volume and per-keyword breakdown. Includes a `keywordConfig` object showing which keywords were queried, which were added manually, and which were excluded.

## Data pipeline

1. **Open Food Facts** — `src/scripts/fetch-additives.js` queries the Open Food Facts taxonomy to build the additive list. It normalises metadata and writes the per-additive `props.json` files into `data/additive/<slug>` alongside the updated `additives.json` index.
2. **Ahrefs keyword metrics** — `src/scripts/update-search-volume.js` reads the index, retrieves the latest U.S. search volume, and writes `additive/<slug>/searchVolume.json` with the aggregated total and keyword breakdown.
3. **Ahrefs volume history** — `src/scripts/fetch-search-history.js` collects the ten-year volume trend for each additive, writes the aggregated data to `additive/<slug>/searchHistory.json`, and stores the raw keyword-level series in `additive/<slug>/searchHistoryFull.json`.
4. **Ahrefs question ideas** — `src/scripts/fetch-search-questions.js` requests matching-question keywords for each additive and stores the top ten results (including an `original_keyword` field that records which query produced the question) inside `additive/<slug>/search-questions.json`.

The scripts are idempotent and can be re-run to refresh the dataset. Each script expects the `data/` directory to exist and will create per-additive folders under `data/additive` as needed.

### Search keyword filters

- **`searchFilter`** removes overly broad or misleading keywords from Ahrefs requests. The excluded keywords are still listed in the generated datasets for traceability.
- **`searchKeywords`** appends extra keywords to the Ahrefs requests. These supplementary keywords also appear in `keywordConfig.supplementary` so the UI can flag them as manual additions.
- `keywordConfig.included` mirrors the final keyword list sent to Ahrefs for a given additive. The search volume tooltip surfaces this alongside the excluded keywords to keep the dataset auditable.

## Card preview generation

Card preview images are used for social media meta tags (OpenGraph and Twitter cards). Preview images are generated using Playwright to capture screenshots of individual additive cards at 1200×630px (Meta's recommended dimensions).

The preview system reuses the existing `AdditiveGrid` component to ensure visual consistency between the live site and social media previews. Cards are rendered at 500px width (mobile layout) centered on a gradient background matching the hero section, then captured at 1200×630px resolution.

### Usage

```bash
# Generate previews for specific additives
node src/scripts/generate-card-previews.js --additive e330-citric-acid
# Regenerate all existing previews
node src/scripts/generate-card-previews.js
```

**Requirements:**
- Dev server must be running (`npm run dev`) or production build (`npm run build && npm run start`)
- Playwright browser (Chromium) installed via `npm install`
- Set `BASE_URL` environment variable if server is not on default port 3000

**Output:** JPEG images saved to `public/img/card-preview/{slug}.jpg`

The script follows the same behavior as other data scripts: targeted runs (`--additive`) always regenerate, bulk runs skip existing files unless `--override` is specified.

## Ahrefs data scripts quick reference

All Ahrefs-driven scripts (`update-search-volume`, `fetch-search-history`, `fetch-search-questions`, `generate-articles` and others) share the same CLI surface and behaviour. They require API key to be available in the environment or `env.local`.

### Common flags

| Flag | Description |
| --- | --- |
| `--additive <slug...>` / `--additive=slug,slug` | Process only the specified additive slugs. Targeted mode forces regeneration even if local files exist. |
| `--limit <n>` | Process at most _n_ additives (ignored when `--additive` is supplied). |
| `--parallel <n>` | Maximum number of additives processed concurrently (defaults to 10 in most scripts). |
| `--override` / `--overide` | Regenerate data even when the target files already exist. Without this flag, bulk runs skip existing outputs. |
| `--debug` | Enables verbose logging: request URLs, API errors, per-keyword lists, skipped slug names, and the exact file paths written. |

### Skip and override behaviour

- **Targeted runs (`--additive`)** always refresh the requested additives. Existing data is overwritten and the console prints the updated file paths when `--debug` is set.
- **Bulk runs** skip additives that already have data unless `--override` is supplied. In non-debug mode, the script prints a single `skipped: <count>` summary before processing the remaining additives.

## Awareness Score calculation

The Awareness Score surfaced in the UI compares search interest with product prevalence. We smooth sparse additives against the dataset baseline before mapping the index to chip colours. The smoothed ratio for additive *i* is:

$$
R_i = \frac{S_i + \alpha \cdot r_{\text{base}}}{(P_i + \alpha) \cdot r_{\text{base}}}
$$

Where:

- $S_i$ — monthly search volume for additive *i*.
- $P_i$ — product count for additive *i*.
- $\alpha$ — Laplace smoothing constant (5).
- $r_{\text{base}}$ — baseline searches-per-product rate across the dataset.

Step-by-step:

1. Compute the baseline searches per product across all qualifying additives:

   $$
   r_{\text{base}} = \frac{\sum_i S_i}{\sum_i P_i}
   $$

2. Smooth each additive’s observed counts with the baseline expectation:

   $$
   S'_i = S_i + \alpha \cdot r_{\text{base}}, \quad P'_i = P_i + \alpha, \quad r_i = \frac{S'_i}{P'_i}
   $$

3. Divide the smoothed searches-per-product ratio by the baseline to obtain the Awareness Score:

   $$
   R_i = \frac{r_i}{r_{\text{base}}}
   $$

When we need a log-scaled view for colouring or sorting we take the base-10 logarithm of the index:

$$
L_i = \log_{10}(R_i)
$$
