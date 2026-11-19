#!/usr/bin/env python3
"""Validate a stats.json from tutorials/dataset_stats_analysis.py and install it for the Explorer.

Browsers reject the NaN/Infinity literals Python's json module writes (homophily is undefined on
edgeless graphs), so non-finite values become null.

With NetworkX < 3.7 the generator failed on every edgeless graph and wrote all-zero stats with
num_nodes = 0. Node selection does not depend on the threshold, so those entries are rebuilt from
the node count of the same (dataset, ratio, method, graph) at another threshold, matching what the
fixed generator writes.

Run from webapp/ as ``make stats STATS=/path/to/stats.json``.
"""

from __future__ import annotations

import argparse
import collections
import json
import math
from pathlib import Path
from typing import Any

OUTPUT_PATH = Path(__file__).resolve().parent.parent / 'public' / 'data' / 'stats.json'

KEY_FIELDS = ('dataset', 'node_sample_ratio', 'method', 'adj_thresh', 'adjacency_method')
METRIC_FIELDS = (
    'num_nodes',
    'num_edges',
    'avg_degree',
    'density_pct',
    'largest_cc_ratio_pct',
    'num_connected_components',
    'degree_std',
    'homophily',
    'clustering_coefficient',
    'diameter',
    'modularity',
)

type Stats = dict[str, dict[str, Any]]


def _finite_or_none(value: Any) -> Any:
    return None if isinstance(value, float) and not math.isfinite(value) else value


def sanitize(stats: Stats) -> tuple[Stats, collections.Counter[str]]:
    """Replace non-finite metrics with None and check every key matches its entry's fields."""
    nulls: collections.Counter[str] = collections.Counter()
    sanitized: Stats = {}
    for key, entry in stats.items():
        missing = [f for f in (*KEY_FIELDS, *METRIC_FIELDS) if f not in entry]
        if missing:
            raise ValueError(f'{key}: missing fields {missing}')
        dataset, ratio, method, threshold, adjacency_method = key.split('|')
        if (dataset, ratio, method, adjacency_method) != (
            entry['dataset'],
            str(entry['node_sample_ratio']),
            entry['method'],
            entry['adjacency_method'],
        ) or float(threshold) != float(entry['adj_thresh']):
            raise ValueError(f'{key}: key does not match the entry fields')
        clean = {field: _finite_or_none(value) for field, value in entry.items()}
        nulls.update(f for f in METRIC_FIELDS if clean[f] is None and entry[f] is not None)
        sanitized[key] = clean
    return sanitized, nulls


def _cell(entry: dict[str, Any]) -> tuple[str, str, str, str]:
    return (
        entry['dataset'],
        str(entry['node_sample_ratio']),
        entry['method'],
        entry['adjacency_method'],
    )


def backfill_edgeless(stats: Stats) -> int:
    """Rebuild the num_nodes = 0 entries as edgeless graphs on the cell's node set."""
    node_counts: dict[tuple[str, str, str, str], set[int]] = collections.defaultdict(set)
    for entry in stats.values():
        if entry['num_nodes']:
            node_counts[_cell(entry)].add(entry['num_nodes'])

    rebuilt = 0
    for key, entry in stats.items():
        if entry['num_nodes'] or entry['num_edges']:
            continue
        counts = node_counts.get(_cell(entry), set())
        if len(counts) != 1:
            raise ValueError(
                f'{key}: cannot infer the node count from other thresholds ({counts})'
            )
        num_nodes = next(iter(counts))
        entry.update(
            num_nodes=num_nodes,
            avg_degree=0.0,
            density_pct=0.0,
            largest_cc_ratio_pct=100 / num_nodes,
            num_connected_components=num_nodes,
            degree_std=0.0,
            homophily=None,
            clustering_coefficient=0.0,
            diameter=0.0,
            modularity=0.0,
        )
        rebuilt += 1
    return rebuilt


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument(
        'source', type=Path, help='stats.json written by dataset_stats_analysis.py'
    )
    parser.add_argument('--output', type=Path, default=OUTPUT_PATH)
    args = parser.parse_args()

    stats, nulls = sanitize(json.loads(args.source.read_text()))
    rebuilt = backfill_edgeless(stats)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, 'w') as f:
        json.dump(stats, f, indent=2, allow_nan=False)
        f.write('\n')

    cells = collections.Counter((e['dataset'], e['adjacency_method']) for e in stats.values())
    print(f'Wrote {len(stats)} entries to {args.output}')
    for (dataset, adjacency_method), count in sorted(cells.items()):
        print(f'  {dataset:<14} {adjacency_method:<7} {count}')
    for field, count in sorted(nulls.items()):
        print(f'  {field}: {count} non-finite values -> null')
    if rebuilt:
        print(f'  {rebuilt} edgeless entries with num_nodes = 0 rebuilt from the other thresholds')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
