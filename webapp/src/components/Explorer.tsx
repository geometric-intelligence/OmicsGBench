import { useState, useEffect, useMemo, lazy } from 'react';

// Dynamically import Plotly to avoid SSR issues
const Plot = lazy(() => import('react-plotly.js'));
import type { DatasetName, GraphStats, GraphStatsMetric, NodeSelectionMethod } from '../lib/types';
import {
  DATASETS,
  DATASET_ORDER,
  VALID_METHODS,
  METHOD_LABELS,
  ADJACENCY_METHOD_LABELS,
  METRIC_LABELS,
  compareRatios,
  formatRatio,
} from '../lib/constants';
import { getStatsKey, computeMetricRange } from '../lib/data';

/** 3 × 3 grid: size, then connectivity, then structure. */
const EXPLORER_METRICS: GraphStatsMetric[] = [
  'num_nodes',
  'num_edges',
  'avg_degree',
  'density_pct',
  'largest_cc_ratio_pct',
  'diameter',
  'clustering_coefficient',
  'modularity',
  'homophily',
];

const METHOD_EMOJIS: Record<string, string> = {
  variance: '📊',
  correlation: '🔗',
  distance_correlation: '📐',
  random: '🎲',
};

const GRID_COLS = 3;
const FACET_HEIGHT = 190;
const FACET_ROW_GAP = 70;
const FACET_COL_GAP = 0.08;
const CHART_MARGIN = { l: 60, r: 30, t: 40, b: 20 };

const DEFAULT_RATIO = '0.5';
// The benchmark builds STRING graphs at a 0.4 confidence threshold.
const DEFAULT_THRESHOLD = 0.4;
const DEFAULT_ADJACENCY_METHOD = 'string';

const COUNT_METRICS = new Set<GraphStatsMetric>(['num_nodes', 'num_edges', 'avg_degree', 'degree_std']);

function formatCompact(v: number): string {
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e4) return `${(v / 1e3).toFixed(1)}k`;
  return Math.round(v).toLocaleString();
}

function formatMetric(metric: GraphStatsMetric, v: number | null): string {
  if (v === null) return 'n/a';
  switch (metric) {
    case 'num_nodes':
    case 'num_edges':
    case 'num_connected_components':
    case 'diameter':
      return formatCompact(v);
    case 'density_pct':
    case 'largest_cc_ratio_pct':
      return `${v.toFixed(1)}%`;
    case 'avg_degree':
    case 'degree_std':
      return v >= 1e4 ? formatCompact(v) : v.toFixed(1);
    default:
      return v.toFixed(2);
  }
}

interface StatsOptions {
  datasets: DatasetName[];
  ratios: string[];
  methods: string[];
  thresholds: string[];
  adjacencyMethods: string[];
}

/** Keys are "dataset|ratio|method|threshold|adjacency_method"; ratio and threshold stay strings to match them exactly. */
function deriveOptionsFromStats(stats: Record<string, GraphStats>): StatsOptions {
  const datasets = new Set<string>();
  const ratios = new Set<string>();
  const methods = new Set<string>();
  const thresholds = new Set<string>();
  const adjacencyMethods = new Set<string>();
  for (const key of Object.keys(stats)) {
    const [dataset, ratio, method, threshold, adjacencyMethod] = key.split('|');
    if (adjacencyMethod === undefined) continue;
    datasets.add(dataset);
    ratios.add(ratio);
    methods.add(method);
    thresholds.add(threshold);
    adjacencyMethods.add(adjacencyMethod);
  }
  return {
    datasets: DATASET_ORDER.filter((ds) => datasets.has(ds)),
    ratios: [...ratios].sort(compareRatios),
    methods: VALID_METHODS.filter((m) => methods.has(m)),
    thresholds: [...thresholds].sort((a, b) => parseFloat(a) - parseFloat(b)),
    adjacencyMethods: [...adjacencyMethods].sort(),
  };
}

function closestThreshold(thresholds: string[], target: number): string {
  return thresholds.reduce(
    (best, t) => (Math.abs(parseFloat(t) - target) < Math.abs(parseFloat(best) - target) ? t : best),
    thresholds[0]
  );
}

export default function Explorer() {
  const [allStats, setAllStats] = useState<Record<string, GraphStats>>({});
  const [loading, setLoading] = useState(true);
  const [nodeSampleRatio, setNodeSampleRatio] = useState(DEFAULT_RATIO);
  const [nodeSelectionMethod, setNodeSelectionMethod] = useState<NodeSelectionMethod>('variance');
  const [adjacencyThreshold, setAdjacencyThreshold] = useState('');
  const [adjacencyMethod, setAdjacencyMethod] = useState(DEFAULT_ADJACENCY_METHOD);

  const options = useMemo(() => deriveOptionsFromStats(allStats), [allStats]);

  useEffect(() => {
    fetch('/data/stats.json')
      .then((res) => res.json())
      .then((data: Record<string, GraphStats>) => {
        const derived = deriveOptionsFromStats(data);
        setAllStats(data);
        setNodeSampleRatio((prev) => (derived.ratios.includes(prev) ? prev : derived.ratios[0]));
        setAdjacencyThreshold(closestThreshold(derived.thresholds, DEFAULT_THRESHOLD));
        setAdjacencyMethod((prev) => (derived.adjacencyMethods.includes(prev) ? prev : derived.adjacencyMethods[0]));
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load stats:', err);
        setLoading(false);
      });
  }, []);

  // Axes are shared by every method and threshold at the current ratio and graph construction, so they
  // stay fixed while those controls move but still fit the much larger "all features" graphs.
  const metricRanges = useMemo(() => {
    const scope = Object.values(allStats).filter(
      (s) => s.node_sample_ratio === nodeSampleRatio && s.adjacency_method === adjacencyMethod
    );
    return Object.fromEntries(EXPLORER_METRICS.map((m) => [m, computeMetricRange(scope, m)]));
  }, [allStats, nodeSampleRatio, adjacencyMethod]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="text-text-muted">Loading data...</div>
      </div>
    );
  }

  const datasetLabels = options.datasets.map((ds) => DATASETS[ds].fullName);
  const datasetColors = options.datasets.map((ds) => DATASETS[ds].color);
  const currentStats = options.datasets.map(
    (ds) => allStats[getStatsKey(ds, nodeSampleRatio, nodeSelectionMethod, adjacencyThreshold, adjacencyMethod)]
  );

  const numRows = Math.ceil(EXPLORER_METRICS.length / GRID_COLS);
  const innerHeight = numRows * FACET_HEIGHT + (numRows - 1) * FACET_ROW_GAP;
  const chartHeight = innerHeight + CHART_MARGIN.t + CHART_MARGIN.b;
  const colWidth = (1 - (GRID_COLS - 1) * FACET_COL_GAP) / GRID_COLS;

  const subplotData: Plotly.Data[] = [];
  const annotations: Partial<Plotly.Annotations>[] = [];
  const layout: Partial<Plotly.Layout> = {
    height: chartHeight,
    font: { family: 'DM Sans', size: 14, color: '#0f172a' },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: '#ffffff',
    margin: CHART_MARGIN,
    annotations,
    showlegend: false,
  };

  EXPLORER_METRICS.forEach((metric, idx) => {
    const row = Math.floor(idx / GRID_COLS);
    const col = idx % GRID_COLS;
    const axisNum = idx === 0 ? '' : `${idx + 1}`;
    const top = 1 - (row * (FACET_HEIGHT + FACET_ROW_GAP)) / innerHeight;
    const xDomain = [col * (colWidth + FACET_COL_GAP), col * (colWidth + FACET_COL_GAP) + colWidth];
    const values = currentStats.map((s) => (s ? s[metric] : null));

    subplotData.push({
      type: 'bar',
      x: datasetLabels,
      y: values.map((v) => v ?? 0),
      marker: { color: currentStats.map((s, i) => (s ? datasetColors[i] : 'rgba(200,200,200,0.3)')) },
      text: currentStats.map((s, i) => (s ? formatMetric(metric, values[i]) : '')),
      textposition: 'outside',
      textfont: { size: 11, family: 'JetBrains Mono', color: '#0f172a' },
      hovertemplate: `<b>%{x}</b><br>${METRIC_LABELS[metric]}: %{text}<extra></extra>`,
      cliponaxis: false,
      xaxis: `x${axisNum}`,
      yaxis: `y${axisNum}`,
    } as Plotly.Data);

    annotations.push({
      text: `<b>${METRIC_LABELS[metric]}</b>`,
      xref: 'paper',
      yref: 'paper',
      x: (xDomain[0] + xDomain[1]) / 2,
      y: top,
      yshift: 14,
      showarrow: false,
      font: { size: 12, color: '#1e293b', family: 'DM Sans' },
      xanchor: 'center',
      yanchor: 'bottom',
    });

    const layoutAxes = layout as Record<string, unknown>;
    layoutAxes[`xaxis${axisNum}`] = {
      domain: xDomain,
      anchor: `y${axisNum}`,
      showgrid: false,
      showticklabels: false,
      fixedrange: true,
    };
    layoutAxes[`yaxis${axisNum}`] = {
      domain: [top - FACET_HEIGHT / innerHeight, top],
      anchor: `x${axisNum}`,
      showgrid: true,
      gridcolor: 'rgba(226,232,240,0.8)',
      zeroline: true,
      zerolinecolor: 'rgba(226,232,240,1)',
      tickfont: { size: 11, color: '#475569' },
      tickformat: COUNT_METRICS.has(metric) ? '~s' : undefined,
      fixedrange: true,
      range: metricRanges[metric],
    };
  });

  return (
    <div>
      {/* Controls */}
      <div className="controls-panel">
        <div className="controls-grid">
          <div className="control-group">
            <div className="control-label">Node Sample Ratio</div>
            <div className="control-value">{formatRatio(nodeSampleRatio)}</div>
            <input
              type="range"
              min={0}
              max={options.ratios.length - 1}
              step={1}
              value={Math.max(0, options.ratios.indexOf(nodeSampleRatio))}
              onChange={(e) => setNodeSampleRatio(options.ratios[parseInt(e.target.value)] ?? options.ratios[0])}
            />
            <div className="flex justify-between text-xs text-text-muted mt-1">
              {options.ratios.map((r) => (
                <span key={r}>{r === 'full' ? 'all' : r}</span>
              ))}
            </div>
          </div>

          <div className="control-group">
            <div className="control-label">Node Selection Method</div>
            <select
              value={nodeSelectionMethod}
              onChange={(e) => setNodeSelectionMethod(e.target.value as NodeSelectionMethod)}
            >
              {options.methods.map((m) => (
                <option key={m} value={m}>
                  {METHOD_EMOJIS[m] ?? '🔹'} {METHOD_LABELS[m] ?? m}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <div className="control-label">Graph Construction</div>
            <select value={adjacencyMethod} onChange={(e) => setAdjacencyMethod(e.target.value)}>
              {options.adjacencyMethods.map((m) => (
                <option key={m} value={m}>
                  {ADJACENCY_METHOD_LABELS[m] ?? m}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <div className="control-label">Adjacency Threshold</div>
            <div className="control-value">τ = {parseFloat(adjacencyThreshold).toFixed(2)}</div>
            <input
              type="range"
              min={0}
              max={options.thresholds.length - 1}
              step={1}
              value={Math.max(0, options.thresholds.indexOf(adjacencyThreshold))}
              onChange={(e) =>
                setAdjacencyThreshold(options.thresholds[parseInt(e.target.value)] ?? options.thresholds[0])
              }
            />
            <div className="flex justify-between text-xs text-text-muted mt-1">
              {options.thresholds.map((t) => (
                <span key={t}>{parseFloat(t)}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-container">
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 pt-2 text-sm text-text-secondary">
          {options.datasets.map((ds, i) => (
            <span key={ds} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: datasetColors[i] }}
              />
              {DATASETS[ds].emoji} {datasetLabels[i]}
            </span>
          ))}
        </div>
        <Plot
          data={subplotData}
          layout={layout}
          config={{ displayModeBar: 'hover', responsive: true }}
          style={{ width: '100%', height: `${chartHeight}px` }}
        />
      </div>
    </div>
  );
}
