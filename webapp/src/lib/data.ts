import type {
  DatasetName,
  DisplayMetric,
  GraphStats,
  GraphStatsMetric,
  LeaderboardEntry,
  RankingMetric,
  Readout,
  ResultEntry,
} from './types';
import { MODEL_CATEGORIES, ratioKey } from './constants';

function getRankingMetricValue(entry: ResultEntry, metric: RankingMetric): { value: number; std: number } {
  switch (metric) {
    case 'val_f1_macro':
      return { value: entry.val_f1_macro, std: entry.val_f1_macro_std };
    case 'test_f1_macro':
      return { value: entry.test_f1_macro, std: entry.test_f1_macro_std };
    default:
      return { value: entry.val_f1_macro, std: entry.val_f1_macro_std };
  }
}

export function getDisplayMetricValue(entry: ResultEntry, metric: DisplayMetric): { value: number; std: number } {
  switch (metric) {
    case 'test_f1_macro':
      return { value: entry.test_f1_macro, std: entry.test_f1_macro_std };
    case 'train_f1_macro':
      return { value: entry.train_f1_macro, std: entry.train_f1_macro_std };
    case 'test_f1_weighted':
      return { value: entry.test_f1_weighted, std: entry.test_f1_weighted_std };
    case 'test_accuracy':
      return { value: entry.test_accuracy, std: entry.test_accuracy_std };
    case 'test_auroc':
      return { value: entry.test_auroc, std: entry.test_auroc_std };
    default:
      return { value: entry.test_f1_macro, std: entry.test_f1_macro_std };
  }
}

function pickBest(entries: ResultEntry[], rankBy: RankingMetric): ResultEntry {
  let bestEntry = entries[0];
  let bestRankValue = getRankingMetricValue(bestEntry, rankBy).value;
  for (const entry of entries) {
    const rankValue = getRankingMetricValue(entry, rankBy).value;
    if (rankValue > bestRankValue) {
      bestEntry = entry;
      bestRankValue = rankValue;
    }
  }
  return bestEntry;
}

function groupBy<K extends string>(entries: ResultEntry[], key: (entry: ResultEntry) => K): Map<K, ResultEntry[]> {
  const groups = new Map<K, ResultEntry[]>();
  for (const entry of entries) {
    const k = key(entry);
    const group = groups.get(k);
    if (group) group.push(entry);
    else groups.set(k, [entry]);
  }
  return groups;
}

/**
 * For each model, selects the BEST configuration (highest ranking metric value)
 * rather than averaging across all configurations.
 */
export function computeLeaderboard(
  results: ResultEntry[],
  rankBy: RankingMetric = 'val_f1_macro',
  displayMetric: DisplayMetric = 'test_f1_macro'
): LeaderboardEntry[] {
  const aggregates: LeaderboardEntry[] = [...groupBy(results, (r) => r.model)].map(([model, entries]) => {
    const isBaseline = entries.some((e) => e.readout === 'baseline');
    const bestEntry = pickBest(entries, rankBy);
    const rankMetric = getRankingMetricValue(bestEntry, rankBy);
    const displayMetricVal = getDisplayMetricValue(bestEntry, displayMetric);

    return {
      rank: 0,
      model,
      category: MODEL_CATEGORIES[model] || 'baseline',
      rankValue: rankMetric.value,
      rankStd: rankMetric.std,
      displayValue: displayMetricVal.value,
      displayStd: displayMetricVal.std,
      testF1Macro: bestEntry.test_f1_macro,
      testF1MacroStd: bestEntry.test_f1_macro_std,
      isBaseline,
    };
  });

  aggregates.sort((a, b) => {
    if (a.isBaseline && b.isBaseline) return b.displayValue - a.displayValue;
    if (a.isBaseline) return 1;
    if (b.isBaseline) return -1;
    return b.rankValue - a.rankValue;
  });

  aggregates.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  return aggregates;
}

export interface ResultFilters {
  dataset: DatasetName | 'all';
  method: string | 'all';
  ratio: string | 'all';
  adjacencyMethod: string | 'all';
  readout: Readout | 'all';
}

/** Baselines have no graph and no readout, so the graph construction and readout filters keep them. */
export function filterResults(results: ResultEntry[], filters: ResultFilters): ResultEntry[] {
  const { dataset, method, ratio, adjacencyMethod, readout } = filters;
  return results.filter(
    (r) =>
      (dataset === 'all' || r.dataset === dataset) &&
      (method === 'all' || r.method === method) &&
      (ratio === 'all' || ratioKey(r.node_sample_ratio) === ratio) &&
      (adjacencyMethod === 'all' || r.adjacency_method === adjacencyMethod || r.adjacency_method === 'baseline') &&
      (readout === 'all' || r.readout === readout || r.readout === 'baseline')
  );
}

export function getStatsKey(
  dataset: string,
  ratio: string,
  method: string,
  threshold: string,
  adjacencyMethod: string
): string {
  return `${dataset}|${ratio}|${method}|${threshold}|${adjacencyMethod}`;
}

/** Axis range over `stats`, padded so the outside bar labels fit; null values are ignored. */
export function computeMetricRange(stats: GraphStats[], metric: GraphStatsMetric): [number, number] {
  const values = stats.map((s) => s[metric]).filter((v): v is number => v !== null && Number.isFinite(v));
  if (values.length === 0) return [0, 1];
  const max = Math.max(...values);
  const min = Math.min(...values);
  return [min < 0 ? min * 1.2 : 0, max > 0 ? max * 1.2 : 1];
}

export interface ModelDataByDataset {
  value: number;
  std: number;
}

/**
 * For each model+dataset combination, selects the BEST configuration
 * (highest ranking metric value) rather than averaging.
 */
export function getModelsByDataset(
  results: ResultEntry[],
  modelOrder: string[],
  displayMetric: DisplayMetric,
  rankBy: RankingMetric
): Map<string, Map<string, ModelDataByDataset>> {
  const modelsByDataset = new Map<string, Map<string, ModelDataByDataset>>();
  const groups = groupBy(results, (r) => `${r.dataset}|${r.model}`);

  for (const dataset of new Set(results.map((r) => r.dataset))) {
    const models = new Map<string, ModelDataByDataset>();
    for (const model of modelOrder) {
      const entries = groups.get(`${dataset}|${model}`);
      if (entries) models.set(model, getDisplayMetricValue(pickBest(entries, rankBy), displayMetric));
    }
    modelsByDataset.set(dataset, models);
  }

  return modelsByDataset;
}
