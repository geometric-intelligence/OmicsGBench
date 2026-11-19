# OmicsGBench Webapp

Static website for the OmicsGBench leaderboard and dataset explorer, served at [omicsgbench.github.io](https://omicsgbench.github.io). Built with Astro, React, and Plotly.js.

## Architecture

```
webapp/
├── public/data/           # JSON data files served at /data/*
│   ├── results.json       # Benchmark results for all models
│   └── stats.json         # Graph statistics for all configurations
├── src/
│   ├── pages/             # Astro pages (routes)
│   │   ├── index.astro    # Leaderboard (/)
│   │   └── explorer.astro # Dataset Explorer (/explorer)
│   ├── components/        # UI components
│   │   ├── Leaderboard.tsx   # React: filters, table, charts
│   │   ├── Explorer.tsx      # React: sliders, 9-chart grid
│   │   ├── Logo.tsx          # React: SVG logo
│   │   ├── Header.astro      # Astro: page header
│   │   ├── Citation.astro    # Astro: paper links + BibTeX with copy button
│   │   └── Footer.astro      # Astro: page footer
│   ├── lib/               # Utilities
│   │   ├── types.ts       # TypeScript interfaces
│   │   ├── constants.ts   # Datasets, models, colors
│   │   ├── paper.ts       # Paper metadata, links, BibTeX (citation block + meta tags)
│   │   └── data.ts        # Data processing functions
│   ├── layouts/
│   │   └── Layout.astro   # Base HTML layout
│   └── styles/
│       └── global.css     # Tailwind + custom styles
└── dist/                  # Build output (static files)
```

### How It Works

1. **Build time**: Astro generates static HTML for each page
2. **Runtime**: React components hydrate client-side with `client:only="react"`
3. **Data**: JSON files in `public/data/` are fetched by React components on mount
4. **Charts**: Plotly.js renders interactive visualizations

The site is fully static — no server required. All interactivity runs in the browser.

Every page ends with the citation block, and `Layout.astro` emits Google Scholar `citation_*`, Open Graph, and canonical-URL tags. All of them read `src/lib/paper.ts`, so update the paper metadata there.

## Development

```bash
# Install dependencies
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
source ~/.profile
nvm install --lts
make install

# Start dev server (http://localhost:4321)
make dev

# Type check
make lint

# Build for production
make build

# Preview production build
make preview
```

## Deployment

### GitHub Pages (omicsgbench.github.io)

The site is a root-level GitHub Pages site (`site: 'https://omicsgbench.github.io'` in `astro.config.mjs`, no `base`), so it lives in the repo `omicsgbench/omicsgbench.github.io`. The [Deploy Website](../.github/workflows/deploy-website.yml) workflow builds `webapp/` and pushes `dist/` to that repo's `main` branch. It only runs when triggered manually.

One-time setup:

1. Create the GitHub organization `omicsgbench` and a public repo `omicsgbench.github.io` in it.
2. Generate a key pair: `ssh-keygen -t ed25519 -N "" -C omicsgbench-website -f deploy_key`.
3. In `omicsgbench/omicsgbench.github.io` → Settings → Deploy keys, add `deploy_key.pub` with **write access**.
4. In `geometric-intelligence/OmicsGBench` → Settings → Secrets and variables → Actions, add the private key `deploy_key` as `WEBSITE_DEPLOY_KEY`.
5. Run the workflow: Actions → Deploy Website → Run workflow (or `gh workflow run deploy-website.yml`).
6. In `omicsgbench.github.io` → Settings → Pages, set the source to "Deploy from a branch", `main`, `/ (root)`.

### Cloudflare Pages

```bash
make deploy
```

This runs `wrangler pages deploy dist/ --project-name omicsgbench`, which serves the site at `omicsgbench.pages.dev`. Cloudflare can't rename a Pages project; the old `ogbench` project at `ogbench.pages.dev` keeps serving the previous build until it is deleted in the Cloudflare dashboard.

### Other hosts

The `dist/` directory contains all static files and can be served from any static host (Vercel, Netlify, any web server). Pages and data are referenced with root-absolute paths (`/explorer`, `/data/*.json`), so serve the site from the root of a domain. Serving it under a subpath also requires setting `base` in `astro.config.mjs`.

## Updating Data

### Building stats.json from existing CSVs

If you already have the graph-statistics CSV files (e.g. from a previous run of `dataset_stats_analysis.py` or from the repo), you can regenerate `public/data/stats.json` without PyTorch:

```bash
# From repo root
python webapp/scripts/build_stats_from_csv.py
```

This reads the co-expression CSVs `tutorials/stats/<dataset>/graph_stats_comprehensive_<dataset>.csv` and the PPI CSVs `stats/<dataset>/graph_stats_comprehensive.csv` for `addneuromed`, `motrpac`, `parkinsons`, and `brca`, and writes `webapp/public/data/stats.json`. Missing CSVs are skipped silently. `tutorials/stats/brca/graph_stats_comprehensive_brca.csv` is not in the repo, so a regeneration from a fresh clone drops the 120 BRCA co-expression entries from the committed `stats.json`; check `git diff --stat public/data/stats.json` before committing. `make build` doesn't regenerate stats, so builds and deploys always use the committed JSON. Run this after updating any of those CSVs or when setting up the webapp on a fresh clone so the Dataset Explorer has data. The Explorer’s Node Sample Ratio and Adjacency Threshold sliders will only show values that exist in the generated stats. If the CSVs contain an `adjacency_method` column, it will be included in the key and the Explorer will show a Graph Construction dropdown.

### Regenerating Graph Statistics (full pipeline)

The `tutorials/dataset_stats_analysis.py` script computes graph statistics for all parameter combinations and outputs both the CSVs and `stats.json` for the webapp.

**Prerequisites:**

The script needs the full `omicsgbench` Python environment with PyTorch. Set it up as described under Installation in the [main README](../README.md#installation).

**Run the script:**

```bash
cd tutorials
# Generate stats for both graph construction methods (PPI + co-expression)
python dataset_stats_analysis.py --adjacency-method string wgcna
```

**Note:** If the environment is not properly set up, some selection methods (like `distance_correlation`) may not have data available in the webapp.

This will:

1. Load datasets using the HFOmicsDataset loader
2. Compute graph statistics for all parameter combinations
3. Save results to both CSV files (in `./stats/`) and JSON for the webapp (`webapp/public/data/stats.json`)

**Parameters computed:**

| Parameter            | Values                                                                    |
| -------------------- | ------------------------------------------------------------------------- |
| Datasets             | `motrpac`, `tuberculosis`, `parkinsons`, `addneuromed`, `smoking`, `brca` |
| Node sample ratios   | `full`, `1.0`, `0.5`, `0.3`                                               |
| Selection methods    | `variance`, `correlation`, `distance_correlation`, `random`               |
| Adjacency thresholds | 10 values from 0.0 to 1.0                                                 |
| Graph construction   | `string` (PPI Network), `wgcna` (Co-expression)                           |

**Metrics computed per graph:**

- `num_nodes` — Number of nodes (features)
- `num_edges` — Number of edges
- `density_pct` — Graph density (%)
- `avg_degree` — Average node degree
- `degree_std` — Standard deviation of degrees
- `num_connected_components` — Number of connected components
- `largest_cc_ratio_pct` — Largest connected component / total nodes (%)
- `avg_clustering_coeff` — Average clustering coefficient
- `avg_shortest_path_length` — Average shortest path length

**Expected runtime:** Varies based on number of parallel jobs and dataset sizes.

### JSON File Structure

**`public/data/results.json`** — Benchmark results:

```json
{
  "motrpac|0.5|variance|NoReadOut|string|SVM": {
    "graph_config": "motrpac|0.5|variance|NoReadOut|string",
    "model": "SVM",
    "dataset": "motrpac",
    "adjacency_method": "string",
    "test_accuracy": 0.8549,
    "f1_macro": 0.8159,
    "f1_weighted": 0.8198,
    "precision_macro": 0.8121,
    "recall_macro": 0.7921,
    "runtime_seconds": 5.46,
    "epochs": 1
  }
}
```

**`public/data/stats.json`** — Graph statistics:

```json
{
  "motrpac|0.5|variance|0.02|string": {
    "num_nodes": 914,
    "num_edges": 135087,
    "density_pct": 32.37,
    "avg_degree": 295.59,
    "degree_std": 240.65,
    "num_connected_components": 172,
    "largest_cc_ratio_pct": 77.68,
    "avg_clustering_coeff": 0.72,
    "avg_shortest_path_length": 2.59,
    "dataset": "motrpac",
    "adjacency_method": "string"
  }
}
```

### How to Update

1. **Replace or regenerate the JSON files** in `public/data/`:

   - For **stats.json** (Dataset Explorer): run `python webapp/scripts/build_stats_from_csv.py` from the repo root if you have the graph-statistics CSVs (see [Building stats.json from existing CSVs](#building-statsjson-from-existing-csvs)), or copy a pre-built file: `cp /path/to/new/stats.json public/data/stats.json`
   - For **results.json** (Leaderboard): `cp /path/to/new/results.json public/data/results.json`

2. **Rebuild and deploy**: commit the new JSON files, then run the Deploy Website workflow (`gh workflow run deploy-website.yml`). See [Deployment](#deployment) for Cloudflare Pages.

### Key Format

Results key: `{dataset}|{ratio}|{method}|{readout}|{adjacency_method}|{model}`
Stats key: `{dataset}|{ratio}|{method}|{threshold}|{adjacency_method}`

Where:

- `dataset`: `motrpac`, `addneuromed`, `parkinsons`, `brca`, `tuberculosis`, or `smoking` (the current results and stats cover the first four)
- `ratio`: node sample ratio (`full`, `1.0`, `0.5`, `0.3`)
- `method`: `variance`, `correlation`, `distance_correlation`, or `random`
- `threshold`: adjacency threshold (0.0–1.0)
- `readout`: `NoReadOut`, `OmicsReadOut`, or `baseline`
- `adjacency_method`: `string` (PPI Network) or `wgcna` (Co-expression)
- `model`: `SVM`, `ElasticNet`, `MLP`, `MLA-GNN` (the `gatv4` config), `GATv2`, `GIN`, `GCN`, `GraphSAGE`, `SAGN`, `ChebNet`, `GPS`

The `adjacency_method` segment is optional for backward compatibility — keys without it are treated as having a single graph construction method.

## Tech Stack

- **[Astro](https://astro.build/)** — Static site generator
- **[React](https://react.dev/)** — Interactive components (islands)
- **[Plotly.js](https://plotly.com/javascript/)** — Charts
- **[Tailwind CSS](https://tailwindcss.com/)** — Styling
- **[GitHub Pages](https://pages.github.com/)** — Hosting ([Cloudflare Pages](https://pages.cloudflare.com/) also supported)
