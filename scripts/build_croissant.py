#!/usr/bin/env python3
"""Regenerate the file and record-set sections of croissant_omicsgbench.json from the Hub.

Every file is pinned to the revision in configs/hf/default.yaml (the one the loaders download),
with its size and sha256. The descriptive and Responsible AI fields are maintained by hand in the
JSON and are left untouched.

The expression matrices are described as file objects only: listing their columns as fields
would take ~206k fields (139,125 for smoking alone). Their column identifiers are in the
``{dataset}_map`` record sets.

    python scripts/build_croissant.py
"""

import hashlib
import json
from pathlib import Path
from typing import Any, NamedTuple

import pyarrow.parquet as pq
import yaml
from huggingface_hub import HfApi, HfFileSystem, hf_hub_download
from huggingface_hub.hf_api import RepoFile

REPO_ID = 'geometric-intelligence/omicsgbench'
ROOT = Path(__file__).resolve().parent.parent
CROISSANT_PATH = ROOT / 'croissant_omicsgbench.json'
HF_CONFIG = ROOT / 'configs' / 'hf' / 'default.yaml'

type Json = dict[str, Any]


class DatasetInfo(NamedTuple):
    title: str
    feature_ids: str
    # Corrections the loader fits on each fold's training split; the Hub matrices are uncorrected.
    corrections: str = ''
    # Only for datasets whose *_metadata.json has no class mapping.
    classes: dict[str, int] | None = None


DATASETS: dict[str, DatasetInfo] = {
    'motrpac': DatasetInfo(
        'HERITAGE plasma proteomics (SomaScan, log2 RFU)',
        'SomaScan analyte ids',
        'covariate adjustment for age, sex, BMI, and race',
        {'non-responder (<=15% relative VO2max gain)': 0, 'responder (>15%)': 1},
    ),
    'addneuromed': DatasetInfo(
        'AddNeuroMed whole-blood gene expression (GSE63063, Illumina GPL6947 + GPL10558)',
        'Entrez Gene ids',
        'ComBat across the two platforms',
    ),
    'parkinsons': DatasetInfo(
        "Parkinson's disease whole-blood gene expression (GSE99039, Affymetrix GPL570)",
        'HGNC gene symbols',
    ),
    'brca': DatasetInfo(
        'TCGA-BRCA tumour DNA methylation, gene level (via AIBIC/MLOmics)',
        'HGNC gene symbols',
    ),
    'tuberculosis': DatasetInfo(
        'Serum antibody reactivity to the M. tuberculosis proteome (GSE19433, GPL9790)',
        'M. tuberculosis H37Rv locus tags',
    ),
    'smoking': DatasetInfo(
        'Whole-blood promoter DNA methylation (GSE50660, Illumina 450k beta values)',
        'Illumina CpG probe ids in TSS1500/TSS200',
        'per-gene selection of the probe with the lowest mean beta in never-smokers, then median '
        'centering',
    ),
}

SIDECARS: dict[str, str] = {
    'motrpac_covariates': (
        'Baseline covariates per sample. Covariate adjustment (age, sex, BMI, race) is fit on the '
        'training split of each fold.'
    ),
    'motrpac_targets_vo2_rel': 'Relative VO2max change after training (continuous).',
    'addneuromed_batches': (
        'Microarray platform per sample, the ComBat batch (fit on the training split of each fold).'
    ),
    'parkinsons_sample_meta': 'GEO sample characteristics per sample (clinical scores, sex, age).',
    'tuberculosis_batches': (
        'Country of serum collection per sample. k-fold splits keep each country in one split.'
    ),
    'smoking_probe_map': (
        'Promoter CpG probe (column of smoking_data.parquet) to gene pairs; a probe annotated '
        'to several genes appears once per gene.'
    ),
}

DATA_TYPES: dict[str, str] = {
    'double': 'cr:Float64',
    'int64': 'cr:Int64',
    'string': 'sc:Text',
    'large_string': 'sc:Text',
}


def _field_id(record_set: str, column: str) -> str:
    return f'{record_set}/' + ''.join(c if c.isalnum() else '_' for c in column)


def _file_object(path: str, size: int, sha256: str, revision: str, description: str) -> Json:
    return {
        '@type': 'cr:FileObject',
        '@id': path,
        'name': path,
        'description': description,
        'contentUrl': f'https://huggingface.co/datasets/{REPO_ID}/resolve/{revision}/{path}',
        'contentSize': f'{size} B',
        'encodingFormat': 'application/x-parquet'
        if path.endswith('.parquet')
        else 'application/json',
        'sha256': sha256,
    }


def _record_set(name: str, path: str, schema: list[tuple[str, str]], description: str) -> Json:
    return {
        '@type': 'cr:RecordSet',
        '@id': name,
        'name': name,
        'description': description,
        'field': [
            {
                '@type': 'cr:Field',
                '@id': _field_id(name, column),
                'name': column,
                'dataType': DATA_TYPES[dtype],
                'source': {'fileObject': {'@id': path}, 'extract': {'column': column}},
            }
            for column, dtype in schema
        ],
    }


def _class_list(classes: dict[str, int], counts: dict[int, int]) -> str:
    return ', '.join(f'{index} = {name} ({counts[index]})' for name, index in classes.items())


def build(revision: str) -> tuple[list[Json], list[Json]]:
    fs = HfFileSystem()
    files = {
        f.path: f
        for f in HfApi().list_repo_tree(
            REPO_ID, revision=revision, repo_type='dataset', expand=True
        )
        if isinstance(f, RepoFile) and f.path.split('_')[0] in DATASETS
    }

    def schema(path: str) -> tuple[int, list[tuple[str, str]]]:
        with fs.open(f'datasets/{REPO_ID}@{revision}/{path}', block_size=1 << 22) as f:
            parquet = pq.ParquetFile(f)
            arrow = parquet.schema_arrow
            return parquet.metadata.num_rows, [(n, str(arrow.field(n).type)) for n in arrow.names]

    def sha256(file: RepoFile) -> str:
        if file.lfs:
            return file.lfs.sha256
        local = hf_hub_download(  # nosec B615
            REPO_ID, file.path, repo_type='dataset', revision=revision
        )
        return hashlib.sha256(Path(local).read_bytes()).hexdigest()

    distribution: list[Json] = []
    record_sets: list[Json] = []
    for dataset, (title, feature_ids, corrections, fixed_classes) in DATASETS.items():
        metadata_path = f'{dataset}_metadata.json'
        local = hf_hub_download(  # nosec B615
            REPO_ID, metadata_path, repo_type='dataset', revision=revision
        )
        stats = json.loads(Path(local).read_text())['statistics']
        classes = fixed_classes or stats['target_stats']['class_mapping']
        correction_note = (
            f' Uncorrected: the loader fits {corrections} on the training split of each fold.'
            if corrections
            else ''
        )

        n_samples, data_schema = schema(f'{dataset}_data.parquet')
        _, target_schema = schema(f'{dataset}_targets.parquet')
        with fs.open(f'datasets/{REPO_ID}@{revision}/{dataset}_targets.parquet') as f:
            targets = pq.read_table(f).column('target').to_pylist()
        counts = {index: targets.count(index) for index in classes.values()}

        descriptions = {
            f'{dataset}_data.parquet': (
                f'{title}: {n_samples} samples x {len(data_schema)} Float64 features, one column per '
                f'feature named by its {feature_ids}. Rows are aligned with '
                f'{dataset}_targets.parquet.{correction_note}'
            ),
            f'{dataset}_targets.parquet': f'Class label per sample of {dataset}_data.parquet.',
            f'{dataset}_map.parquet': 'Graph node id to STRING lookup id for each feature.',
            metadata_path: 'Source URLs, download time, class mapping, and preprocessing notes.',
        }
        for sidecar, description in SIDECARS.items():
            if sidecar.startswith(f'{dataset}_'):
                descriptions[f'{sidecar}.parquet'] = description
        for path, description in descriptions.items():
            file = files[path]
            distribution.append(_file_object(path, file.size, sha256(file), revision, description))

        record_sets.append(
            _record_set(
                f'{dataset}_targets',
                f'{dataset}_targets.parquet',
                target_schema,
                f'{title}. Classes: {_class_list(classes, counts)}.',
            )
        )
        record_sets.append(
            _record_set(
                f'{dataset}_map',
                f'{dataset}_map.parquet',
                schema(f'{dataset}_map.parquet')[1],
                f'node_id is a graph node ({feature_ids if dataset != "smoking" else "gene"}); '
                'string_id is the identifier looked up in STRING to build the PPI graph.',
            )
        )
        for sidecar, description in SIDECARS.items():
            if sidecar.startswith(f'{dataset}_'):
                path = f'{sidecar}.parquet'
                record_sets.append(_record_set(sidecar, path, schema(path)[1], description))

    return distribution, record_sets


def main() -> None:
    revision = yaml.safe_load(HF_CONFIG.read_text())['revision']
    croissant = json.loads(CROISSANT_PATH.read_text())
    croissant['distribution'], croissant['recordSet'] = build(revision)
    CROISSANT_PATH.write_text(json.dumps(croissant, indent=2, ensure_ascii=False) + '\n')
    n_fields = sum(len(r['field']) for r in croissant['recordSet'])
    print(
        f'{CROISSANT_PATH.name}: {len(croissant["distribution"])} files, '
        f'{len(croissant["recordSet"])} record sets, {n_fields} fields at revision {revision}'
    )


if __name__ == '__main__':
    main()
