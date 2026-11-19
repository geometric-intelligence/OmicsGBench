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

`make build` never regenerates data: builds and deploys always use the committed `public/data/*.json`. The Explorer and Leaderboard derive their datasets, ratios, thresholds, and readouts from those files, so new values show up without code changes.

### Graph statistics (`stats.json`)

The `tutorials/dataset_stats_analysis.py` script computes graph statistics for all parameter combinations and writes both the CSVs and `webapp/public/data/stats.json`.

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

**Metrics computed per graph** (self-loops removed; LCC = largest connected component):

- `num_nodes` — Number of nodes (features)
- `num_edges` — Number of edges
- `density_pct` — Graph density (%)
- `avg_degree` — Average node degree
- `degree_std` — Standard deviation of degrees
- `num_connected_components` — Number of connected components
- `largest_cc_ratio_pct` — LCC size / total nodes (%)
- `homophily` — Feature homophily: mean Pearson correlation, over edges, of the two endpoints' training-sample profiles (`null` on edgeless graphs)
- `clustering_coefficient` — Average clustering of the LCC (10,000-sample estimate)
- `diameter` — Diameter of the LCC (2-sweep lower bound)
- `modularity` — Louvain modularity of the LCC

**Expected runtime:** Varies based on number of parallel jobs and dataset sizes.

**Installing a stats.json computed elsewhere** (e.g. on a cluster):

```bash
make stats STATS=/path/to/stats.json
```

[`scripts/import_stats.py`](scripts/import_stats.py) checks that every key matches its entry's fields and writes `NaN`/`Infinity` as `null`, which browsers' `JSON.parse` would otherwise reject. Files from runs with NetworkX < 3.7 have all-zero entries (`num_nodes: 0`) for every edgeless graph, because modularity divided by zero. The importer rebuilds those from the node count at the other thresholds, matching what the current script writes.

### Leaderboard results (`results.json`)

```bash
make results GNN_CSV=/path/to/gnn_results.csv BASELINE_CSV=/path/to/baseline_results.csv PYTHON=/path/to/env/python
```

[`scripts/transform_csv_to_json.py`](scripts/transform_csv_to_json.py) needs pandas. It reads the aggregated GNN and baseline CSVs (`best_<metric>_mean` / `best_<metric>_std` over the folds). For each (dataset, model, graph construction, ratio, selection method, readout), it keeps the hyperparameter configuration with the best mean validation macro F1. The leaderboard then picks the best remaining entry per model and dataset by the "Rank Models By" metric, for GNNs and baselines alike, and draws the fold std as error bars. A pre-built file can also be copied to `public/data/results.json` directly.

To publish, commit the new JSON files, then run the Deploy Website workflow (`gh workflow run deploy-website.yml`). See [Deployment](#deployment) for Cloudflare Pages.

### JSON File Structure

**`public/data/results.json`** — Benchmark results, mean and std over the folds:

```json
{
  "addneuromed|0.3|correlation|NoReadOut|string|ChebNet": {
    "graph_config": "addneuromed|0.3|correlation|NoReadOut|string",
    "model": "ChebNet",
    "dataset": "addneuromed",
    "readout": "NoReadOut",
    "node_sample_ratio": 0.3,
    "method": "correlation",
    "adjacency_method": "string",
    "val_f1_macro": 0.5055,
    "val_f1_macro_std": 0.0089,
    "test_f1_macro": 0.3902,
    "test_f1_macro_std": 0.0331,
    "train_f1_macro": 0.5572,
    "train_f1_macro_std": 0.0128,
    "test_f1_weighted": 0.394,
    "test_f1_weighted_std": 0.0366,
    "test_accuracy": 0.392,
    "test_accuracy_std": 0.0385,
    "test_auroc": 0.5602,
    "test_auroc_std": 0.0145
  }
}
```

**`public/data/stats.json`** — Graph statistics:

```json
{
  "motrpac|0.5|variance|0.44|string": {
    "num_nodes": 784,
    "num_edges": 6889,
    "avg_degree": 17.57,
    "density_pct": 2.24,
    "largest_cc_ratio_pct": 91.33,
    "num_connected_components": 66,
    "degree_std": 22.85,
    "homophily": 0.43,
    "clustering_coefficient": 0.38,
    "diameter": 8.0,
    "modularity": 0.41,
    "dataset": "motrpac",
    "adj_thresh": 0.44,
    "node_sample_ratio": "0.5",
    "method": "variance",
    "adjacency_method": "string"
  }
}
```

### Key Format

Results key: `{dataset}|{ratio}|{method}|{readout}|{adjacency_method}|{model}`, or `{dataset}|{ratio}|{method}|baseline|{model}` for baselines, which use no graph
Stats key: `{dataset}|{ratio}|{method}|{threshold}|{adjacency_method}`

Where:

- `dataset`: `motrpac`, `addneuromed`, `parkinsons`, `brca`, `tuberculosis`, or `smoking` (the stats cover all six; the current results cover the first four)
- `ratio`: node sample ratio n_train / p. Results use `1.0`, `0.8`, `0.5`, `0.3`; stats also have `full` (every feature)
- `method`: `variance`, `correlation`, `distance_correlation`, or `random`
- `threshold`: adjacency threshold (0.0–1.0)
- `readout`: `OmicsReadOut` (MLP readout), `NoReadOut` (mean pooling), or `baseline`
- `adjacency_method`: `string` (PPI Network) or `wgcna` (Co-expression)
- `model`: `SVM`, `ElasticNet`, `MLP`, `MLA-GNN` (the `gatv4` config), `GATv2`, `GIN`, `GCN`, `GraphSAGE`, `SAGN`, `ChebNet`, `GPS`

## Tech Stack

- **[Astro](https://astro.build/)** — Static site generator
- **[React](https://react.dev/)** — Interactive components (islands)
- **[Plotly.js](https://plotly.com/javascript/)** — Charts
- **[Tailwind CSS](https://tailwindcss.com/)** — Styling
- **[GitHub Pages](https://pages.github.com/)** — Hosting ([Cloudflare Pages](https://pages.cloudflare.com/) also supported)
