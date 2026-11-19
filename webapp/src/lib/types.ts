export type AdjacencyMethod = 'string' | 'wgcna';

export interface ResultEntry {
  graph_config: string;
  model: string;
  dataset: string;
  readout: string; // 'NoReadOut' | 'OmicsReadOut' | 'baseline'
  node_sample_ratio: number | 'full';
  method: string;
  adjacency_method?: string;
  val_f1_macro: number;
  val_f1_macro_std: number;
  test_f1_macro: number;
  test_f1_macro_std: number;
  train_f1_macro: number;
  train_f1_macro_std: number;
  test_f1_weighted: number;
  test_f1_weighted_std: number;
  test_accuracy: number;
  test_accuracy_std: number;
  test_auroc: number;
  test_auroc_std: number;
}

/** Non-finite values (no edges: homophily, diameter) are serialized as null. */
export interface GraphStats {
  num_nodes: number;
  num_edges: number;
  avg_degree: number;
  density_pct: number;
  largest_cc_ratio_pct: number;
  num_connected_components: number;
  degree_std: number;
  homophily: number | null;
  clustering_coefficient: number | null;
  diameter: number | null;
  modularity: number | null;
  dataset: string;
  adj_thresh: number;
  node_sample_ratio: string;
  method: string;
  adjacency_method: string;
}

export type GraphStatsMetric =
  | 'num_nodes'
  | 'num_edges'
  | 'avg_degree'
  | 'density_pct'
  | 'largest_cc_ratio_pct'
  | 'num_connected_components'
  | 'degree_std'
  | 'homophily'
  | 'clustering_coefficient'
  | 'diameter'
  | 'modularity';

export interface LeaderboardEntry {
  rank: number;
  model: string;
  category: ModelCategory;
  rankValue: number;
  rankStd: number;
  displayValue: number;
  displayStd: number;
  testF1Macro: number;
  testF1MacroStd: number;
  isBaseline: boolean;
}

export type ModelCategory = 'gnn' | 'neural' | 'baseline';

export interface DatasetInfo {
  fullName: string;
  color: string;
  emoji: string;
}

export type DatasetName = 'motrpac' | 'addneuromed' | 'parkinsons' | 'brca' | 'tuberculosis' | 'smoking';

export type NodeSelectionMethod = 'variance' | 'correlation' | 'distance_correlation' | 'random';

export type Readout = 'OmicsReadOut' | 'NoReadOut';

export type RankingMetric = 'val_f1_macro' | 'test_f1_macro';

export type DisplayMetric = 'test_f1_macro' | 'train_f1_macro' | 'test_f1_weighted' | 'test_accuracy' | 'test_auroc';
