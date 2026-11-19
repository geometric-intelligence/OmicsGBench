import { useState, useEffect, useMemo, lazy } from 'react';

const Plot = lazy(() => import('react-plotly.js'));
import type { ResultEntry, DatasetName, RankingMetric, DisplayMetric, Readout } from '../lib/types';
import {
  DATASETS,
  DATASET_ORDER,
  MODEL_ORDER,
  BASELINE_MODELS,
  MODEL_COLORS,
  MODEL_LABELS,
  RANKING_METRICS,
  DISPLAY_METRICS,
  VALID_METHODS,
  METHOD_LABELS,
  READOUT_LABELS,
  ADJACENCY_METHOD_LABELS,
  ratioKey,
  compareRatios,
  formatRatio,
} from '../lib/constants';
import { computeLeaderboard, filterResults, getModelsByDataset } from '../lib/data';

const CHART_MODELS = [...MODEL_ORDER, ...BASELINE_MODELS];
const CHART_LABELS = CHART_MODELS.map((m) => MODEL_LABELS[m] ?? m);

const FACET_HEIGHT = 260;
const FACET_ROW_GAP = 120;
const FACET_COL_GAP = 0.05;
const CHART_MARGIN = { l: 60, r: 20, t: 50, b: 90 };

function labelColor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#0f172a' : '#ffffff';
}

export default function Leaderboard() {
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [datasetFilter, setDatasetFilter] = useState<DatasetName | 'all'>('all');
  const [methodFilter, setMethodFilter] = useState<string | 'all'>('all');
  const [ratioFilter, setRatioFilter] = useState<string | 'all'>('all');
  const [adjacencyMethodFilter, setAdjacencyMethodFilter] = useState<string | 'all'>('all');
  const [readoutFilter, setReadoutFilter] = useState<Readout | 'all'>('all');
  const [rankBy, setRankBy] = useState<RankingMetric>('val_f1_macro');
  const [displayMetric, setDisplayMetric] = useState<DisplayMetric>('test_f1_macro');

  useEffect(() => {
    fetch('/data/results.json')
      .then((res) => res.json())
      .then((data) => {
        const entries = Object.values(data) as ResultEntry[];
        setResults(entries);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load results:', err);
        setLoading(false);
      });
  }, []);

  const options = useMemo(() => {
    const datasets = new Set(results.map((r) => r.dataset));
    const adjacencyMethods = new Set(results.map((r) => r.adjacency_method ?? 'baseline'));
    adjacencyMethods.delete('baseline');
    const readouts = new Set(results.map((r) => r.readout));
    return {
      datasets: DATASET_ORDER.filter((ds) => datasets.has(ds)),
      ratios: [...new Set(results.map((r) => ratioKey(r.node_sample_ratio)))].sort(compareRatios),
      adjacencyMethods: [...adjacencyMethods].sort(),
      readouts: (Object.keys(READOUT_LABELS) as Readout[]).filter((r) => readouts.has(r)),
    };
  }, [results]);

  const filters = { method: methodFilter, ratio: ratioFilter, adjacencyMethod: adjacencyMethodFilter, readout: readoutFilter };

  const filteredResults = useMemo(
    () => filterResults(results, { ...filters, dataset: datasetFilter }),
    [results, datasetFilter, methodFilter, ratioFilter, adjacencyMethodFilter, readoutFilter]
  );

  const chartFilteredResults = useMemo(
    () => filterResults(results, { ...filters, dataset: 'all' }),
    [results, methodFilter, ratioFilter, adjacencyMethodFilter, readoutFilter]
  );

  const leaderboard = useMemo(
    () => computeLeaderboard(filteredResults, rankBy, displayMetric),
    [filteredResults, rankBy, displayMetric]
  );

  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (datasetFilter === 'all') {
      parts.push('All datasets');
    } else {
      parts.push(DATASETS[datasetFilter].fullName);
    }
    if (methodFilter !== 'all') {
      parts.push(METHOD_LABELS[methodFilter]);
    }
    if (ratioFilter !== 'all') {
      parts.push(formatRatio(ratioFilter));
    }
    if (adjacencyMethodFilter !== 'all') {
      parts.push(ADJACENCY_METHOD_LABELS[adjacencyMethodFilter] ?? adjacencyMethodFilter);
    }
    if (readoutFilter !== 'all') {
      parts.push(READOUT_LABELS[readoutFilter]);
    }
    return parts.join(' • ');
  }, [datasetFilter, methodFilter, ratioFilter, adjacencyMethodFilter, readoutFilter]);

  const allModelsData = useMemo(
    () => getModelsByDataset(chartFilteredResults, CHART_MODELS, displayMetric, rankBy),
    [chartFilteredResults, displayMetric, rankBy]
  );

  const displayMetricLabel = DISPLAY_METRICS[displayMetric];
  const rankMetricLabel = RANKING_METRICS[rankBy];

  const chartTitle = useMemo(() => {
    let title = `${displayMetricLabel} of Best Models`;
    title += ` (Ranked by ${rankMetricLabel})`;

    if (methodFilter !== 'all') {
      title += ` using ${METHOD_LABELS[methodFilter]} Selection`;
    } else {
      title += ` across All Selection Methods`;
    }

    if (ratioFilter !== 'all') {
      title += ratioFilter === 'full' ? ' with All Features' : ` at Sample-to-Node Ratio ${ratioFilter}`;
    }

    if (adjacencyMethodFilter !== 'all') {
      title += ` — ${ADJACENCY_METHOD_LABELS[adjacencyMethodFilter] ?? adjacencyMethodFilter}`;
    }

    if (readoutFilter !== 'all') {
      title += ` — ${READOUT_LABELS[readoutFilter]}`;
    }

    return title;
  }, [displayMetricLabel, rankMetricLabel, methodFilter, ratioFilter, adjacencyMethodFilter, readoutFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="text-text-muted">Loading data...</div>
      </div>
    );
  }

  const chartDatasets = options.datasets;
  const numCols = chartDatasets.length <= 4 ? Math.max(chartDatasets.length, 1) : 3;
  const numRows = Math.max(Math.ceil(chartDatasets.length / numCols), 1);
  const innerHeight = numRows * FACET_HEIGHT + (numRows - 1) * FACET_ROW_GAP;
  const chartHeight = innerHeight + CHART_MARGIN.t + CHART_MARGIN.b;
  const colWidth = (1 - (numCols - 1) * FACET_COL_GAP) / numCols;

  const facetValues = chartDatasets.flatMap((ds) => [...(allModelsData.get(ds)?.values() ?? [])]);
  const maxValue = Math.max(...facetValues.map((d) => d.value + d.std), 0);
  const minValue = Math.min(...facetValues.map((d) => d.value - d.std).filter((v) => v > 0), 1);
  const yRange = [Math.max(0, minValue - 0.08), Math.min(1, maxValue + 0.12)];

  const facetedChartData: Plotly.Data[] = [];
  const facetedAnnotations: Partial<Plotly.Annotations>[] = [];
  const facetedShapes: Partial<Plotly.Shape>[] = [];
  const facetedLayout: Partial<Plotly.Layout> = {
    height: chartHeight,
    font: { family: 'DM Sans', size: 12, color: '#0f172a' },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: '#ffffff',
    margin: CHART_MARGIN,
    annotations: facetedAnnotations,
    shapes: facetedShapes,
    showlegend: false,
  };

  chartDatasets.forEach((ds, dsIdx) => {
    const row = Math.floor(dsIdx / numCols);
    const col = dsIdx % numCols;
    const axisNum = dsIdx === 0 ? '' : `${dsIdx + 1}`;
    const top = 1 - (row * (FACET_HEIGHT + FACET_ROW_GAP)) / innerHeight;
    const xDomain = [col * (colWidth + FACET_COL_GAP), col * (colWidth + FACET_COL_GAP) + colWidth];
    const yDomain = [top - FACET_HEIGHT / innerHeight, top];

    const modelsData = allModelsData.get(ds);
    const bars = CHART_MODELS.map((model) => modelsData?.get(model));

    facetedChartData.push({
      type: 'bar',
      name: DATASETS[ds].fullName,
      x: CHART_LABELS,
      y: bars.map((d) => d?.value ?? null),
      customdata: bars.map((d) => d?.std ?? null),
      error_y: {
        type: 'data',
        array: bars.map((d) => d?.std ?? 0),
        visible: true,
        color: '#333333',
        thickness: 1.5,
        width: 4,
      },
      marker: { color: CHART_MODELS.map((m) => MODEL_COLORS[m] || '#888888') },
      hovertemplate: `<b>%{x}</b><br>${displayMetricLabel}: %{y:.1%} ± %{customdata:.1%}<extra>${DATASETS[ds].fullName}</extra>`,
      xaxis: `x${axisNum}`,
      yaxis: `y${axisNum}`,
    } as Plotly.Data);

    // Bars start at 0, below the zoomed y-range, so value labels are pinned to the axis bottom.
    bars.forEach((d, i) => {
      if (!d) return;
      facetedAnnotations.push({
        text: `${(d.value * 100).toFixed(1)}%`,
        xref: `x${axisNum}` as Plotly.XAxisName,
        yref: `y${axisNum}` as Plotly.YAxisName,
        x: CHART_LABELS[i],
        y: yRange[0],
        yshift: 4,
        textangle: '-90',
        xanchor: 'center',
        yanchor: 'bottom',
        showarrow: false,
        font: { family: 'JetBrains Mono', size: 10, color: labelColor(MODEL_COLORS[CHART_MODELS[i]] || '#888888') },
      });
    });

    facetedShapes.push({
      type: 'line',
      xref: `x${axisNum}` as Plotly.XAxisName,
      yref: `y${axisNum} domain` as Plotly.YAxisName,
      x0: MODEL_ORDER.length - 0.5,
      x1: MODEL_ORDER.length - 0.5,
      y0: 0,
      y1: 1,
      line: { color: '#94a3b8', width: 1, dash: 'dot' },
    });

    facetedAnnotations.push({
      text: `<b>${DATASETS[ds].emoji} ${DATASETS[ds].fullName}</b>`,
      xref: 'paper',
      yref: 'paper',
      x: (xDomain[0] + xDomain[1]) / 2,
      y: top,
      yshift: 18,
      showarrow: false,
      font: { size: 14, color: '#1e293b', family: 'DM Sans' },
      xanchor: 'center',
      yanchor: 'bottom',
    });

    const layoutAxes = facetedLayout as Record<string, unknown>;
    layoutAxes[`xaxis${axisNum}`] = {
      domain: xDomain,
      anchor: `y${axisNum}`,
      showgrid: false,
      tickangle: -45,
      tickfont: { size: 9, color: '#475569' },
      fixedrange: true,
    };
    layoutAxes[`yaxis${axisNum}`] = {
      domain: yDomain,
      anchor: `x${axisNum}`,
      title: col === 0 ? { text: displayMetricLabel, font: { size: 12 } } : undefined,
      showgrid: true,
      gridcolor: 'rgba(226,232,240,0.8)',
      tickformat: '.0%',
      tickfont: { size: 11, color: '#475569' },
      fixedrange: true,
      range: yRange,
    };
  });

  return (
    <div>
      {/* Controls */}
      <div className="controls-panel">
        <div className="controls-grid">
          <div className="control-group">
            <div className="control-label">Dataset Filter</div>
            <select
              value={datasetFilter}
              onChange={(e) => setDatasetFilter(e.target.value as DatasetName | 'all')}
            >
              <option value="all">📊 All Datasets (Aggregate)</option>
              {options.datasets.map((key) => (
                <option key={key} value={key}>
                  {DATASETS[key].emoji} {DATASETS[key].fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <div className="control-label">Node Selection Method</div>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as string | 'all')}
            >
              <option value="all">🔀 All Methods</option>
              {VALID_METHODS.map((method) => (
                <option key={method} value={method}>
                  🔹 {METHOD_LABELS[method]}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <div className="control-label">Sample-Node Ratio</div>
            <select value={ratioFilter} onChange={(e) => setRatioFilter(e.target.value)}>
              <option value="all">📏 All Ratios</option>
              {options.ratios.map((ratio) => (
                <option key={ratio} value={ratio}>
                  📐 {formatRatio(ratio)}
                </option>
              ))}
            </select>
          </div>

          {options.adjacencyMethods.length > 0 && (
            <div className="control-group">
              <div className="control-label">Graph Construction</div>
              <select
                value={adjacencyMethodFilter}
                onChange={(e) => setAdjacencyMethodFilter(e.target.value as string | 'all')}
              >
                <option value="all">🔀 All Methods</option>
                {options.adjacencyMethods.map((m) => (
                  <option key={m} value={m}>
                    🔹 {ADJACENCY_METHOD_LABELS[m] ?? m}
                  </option>
                ))}
              </select>
            </div>
          )}

          {options.readouts.length > 0 && (
            <div className="control-group">
              <div className="control-label">Readout</div>
              <select
                value={readoutFilter}
                onChange={(e) => setReadoutFilter(e.target.value as Readout | 'all')}
              >
                <option value="all">🔀 All Readouts</option>
                {options.readouts.map((r) => (
                  <option key={r} value={r}>
                    🔹 {READOUT_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="control-group">
            <div className="control-label">Rank Models By</div>
            <select
              value={rankBy}
              onChange={(e) => setRankBy(e.target.value as RankingMetric)}
            >
              {Object.entries(RANKING_METRICS).map(([key, label]) => (
                <option key={key} value={key}>
                  📊 {label}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <div className="control-label">Display Metric</div>
            <select
              value={displayMetric}
              onChange={(e) => setDisplayMetric(e.target.value as DisplayMetric)}
            >
              {Object.entries(DISPLAY_METRICS).map(([key, label]) => (
                <option key={key} value={key}>
                  🎯 {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="leaderboard-section">
        <div className="section-header">
          <div className="section-title">
            <span style={{ fontSize: '1.2rem' }}>🏆</span>
            <span>Leaderboard Rankings</span>
          </div>
          <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
            {subtitle} — Ranked by {rankMetricLabel}, displaying {displayMetricLabel}
          </div>
        </div>

        {leaderboard.length === 0 ? (
          <div className="p-10 text-center text-text-muted">
            No results match the current filters
          </div>
        ) : (
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Model</th>
                <th>Category</th>
                <th>{rankMetricLabel} (rank)</th>
                <th>{displayMetricLabel} (display)</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => (
                <tr
                  key={entry.model}
                  className={entry.rank === 1 ? 'highlight-row' : ''}
                >
                  <td
                    className={`rank-cell ${entry.rank <= 3 ? `rank-${entry.rank}` : ''}`}
                  >
                    {entry.rank}
                  </td>
                  <td className="model-cell">
                    <span
                      style={{
                        display: 'inline-block',
                        width: '12px',
                        height: '12px',
                        borderRadius: '2px',
                        backgroundColor: MODEL_COLORS[entry.model] || '#888',
                        marginRight: '8px',
                      }}
                    />
                    {MODEL_LABELS[entry.model] ?? entry.model}
                  </td>
                  <td className={`category-${entry.category}`}>{entry.category}</td>
                  <td className="mono-cell">
                    {entry.isBaseline ? (
                      <span style={{ color: '#94a3b8' }}>N/A</span>
                    ) : (
                      <>
                        {(entry.rankValue * 100).toFixed(1)}%
                        {entry.rankStd > 0 && (
                          <span style={{ color: '#94a3b8' }}> ± {(entry.rankStd * 100).toFixed(1)}%</span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="mono-cell">
                    {(entry.displayValue * 100).toFixed(1)}%
                    {entry.displayStd > 0 && (
                      <span style={{ color: '#94a3b8' }}> ± {(entry.displayStd * 100).toFixed(1)}%</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Faceted Bar Chart */}
      <div className="chart-card" style={{ marginTop: '24px' }}>
        <div className="chart-title">{chartTitle}</div>
        <Plot
          data={facetedChartData}
          layout={facetedLayout}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', height: `${chartHeight}px` }}
        />
      </div>
    </div>
  );
}
