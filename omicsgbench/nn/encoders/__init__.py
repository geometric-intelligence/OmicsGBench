"""Init file for encoder module."""

from omicsgbench.nn.encoders.all_cell_encoder import AllCellFeatureEncoder
from omicsgbench.nn.encoders.dgm_encoder import DGMStructureFeatureEncoder
from omicsgbench.nn.encoders.flat_encoder import FlatEncoder
from omicsgbench.nn.encoders.gene_identity import GeneIdentityFeatureEncoder

# Create dictionary of all feature encoders
FEATURE_ENCODERS: dict[str, type] = {
    'AllCellFeatureEncoder': AllCellFeatureEncoder,
    'DGMStructureFeatureEncoder': DGMStructureFeatureEncoder,
    'FlatEncoder': FlatEncoder,
}

FEATURE_ENCODERS_list: list[str] = list(FEATURE_ENCODERS.keys())

# Generate __all__
__all__ = [
    'FEATURE_ENCODERS',
    'FEATURE_ENCODERS_list',
    'AllCellFeatureEncoder',
    'DGMStructureFeatureEncoder',
    'FlatEncoder',
    'GeneIdentityFeatureEncoder',
]
