"""Init file for graph load module."""

from omicsgbench.data.loaders.graph.modecule_datasets import MoleculeDatasetLoader
from omicsgbench.data.loaders.graph.omics_datasets import OmicsDatasetLoader
from omicsgbench.data.loaders.graph.planetoid_datasets import PlanetoidDatasetLoader
from omicsgbench.data.loaders.graph.tu_datasets import TUDatasetLoader

# Create dictionary of all graph loaders
GRAPH_LOADERS: dict[str, type] = {
    'MoleculeDatasetLoader': MoleculeDatasetLoader,
    'OmicsDatasetLoader': OmicsDatasetLoader,
    'PlanetoidDatasetLoader': PlanetoidDatasetLoader,
    'TUDatasetLoader': TUDatasetLoader,
}

GRAPH_LOADERS_list: list[str] = list(GRAPH_LOADERS.keys())

# Generate __all__
__all__ = [
    'GRAPH_LOADERS',
    'GRAPH_LOADERS_list',
    'MoleculeDatasetLoader',
    'OmicsDatasetLoader',
    'PlanetoidDatasetLoader',
    'TUDatasetLoader',
]
