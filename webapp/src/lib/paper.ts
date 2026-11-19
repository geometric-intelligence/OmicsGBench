export interface PaperLink {
  label: string;
  href: string;
}

export const SITE_NAME = 'OmicsGBench';

export const SITE_DESCRIPTION =
  'OmicsGBench: leaderboard and dataset explorer for benchmarking graph neural networks on omics data.';

export const PAPER = {
  title: 'OmicsGBench: A Framework for Evaluating Graph Neural Networks on Omics Data',
  authors: [
    'Louisa Cornelis',
    'Johan Mathe',
    'Louis Van Langendonck',
    'Guillermo Bernárdez',
    'Nina Miolane',
  ],
  venue: 'NeurIPS 2026 Datasets and Benchmarks Track',
  conference: 'Advances in Neural Information Processing Systems (NeurIPS)',
  year: 2026,
  arxivId: '2605.15511',
  arxivUrl: 'https://arxiv.org/abs/2605.15511',
  pdfUrl: 'https://arxiv.org/pdf/2605.15511',
} as const;

export const PAPER_LINKS: PaperLink[] = [
  { label: 'Paper (arXiv)', href: PAPER.arxivUrl },
  { label: 'Code (GitHub)', href: 'https://github.com/geometric-intelligence/OmicsGBench' },
  {
    label: 'Datasets (Hugging Face)',
    href: 'https://huggingface.co/datasets/geometric-intelligence/omicsgbench',
  },
];

export const BIBTEX = `@inproceedings{cornelis2026omicsgbench,
  title         = {OmicsGBench: A Framework for Evaluating Graph Neural Networks on Omics Data},
  author        = {Cornelis, Louisa and Mathe, Johan and Van Langendonck, Louis and Bern{\\'a}rdez, Guillermo and Miolane, Nina},
  booktitle     = {Advances in Neural Information Processing Systems (NeurIPS), Datasets and Benchmarks Track},
  year          = {2026},
  eprint        = {2605.15511},
  archivePrefix = {arXiv},
  primaryClass  = {cs.LG},
  url           = {https://arxiv.org/abs/2605.15511}
}`;
