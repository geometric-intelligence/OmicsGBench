"""Graph backbones."""

from omicsgbench.nn.backbones.graph.chebnet import ChebNet
from omicsgbench.nn.backbones.graph.gat_v4 import CustomGATConv, GATv4
from omicsgbench.nn.backbones.graph.gps import GPSEncoder
from omicsgbench.nn.backbones.graph.identity_gnn import (
    IdentityGAT,
    IdentityGCN,
    IdentityGIN,
    IdentitySAGE,
)
from omicsgbench.nn.backbones.graph.mlp import MLP
from omicsgbench.nn.backbones.graph.sagn import (
    SAGN,
    GroupMLP,
    MultiHeadBatchNorm,
    MultiHeadLinear,
)

# Create dictionary of all backbone classes
BACKBONE_CLASSES: dict[str, type] = {
    'ChebNet': ChebNet,
    'CustomGATConv': CustomGATConv,
    'GATv4': GATv4,
    'IdentityGAT': IdentityGAT,
    'IdentityGCN': IdentityGCN,
    'IdentityGIN': IdentityGIN,
    'IdentitySAGE': IdentitySAGE,
    'MLP': MLP,
    'GroupMLP': GroupMLP,
    'MultiHeadBatchNorm': MultiHeadBatchNorm,
    'MultiHeadLinear': MultiHeadLinear,
    'SAGN': SAGN,
    'GPSEncoder': GPSEncoder,
}

# Generate __all__
__all__ = [
    'BACKBONE_CLASSES',
    'ChebNet',
    'CustomGATConv',
    'GATv4',
    'IdentityGAT',
    'IdentityGCN',
    'IdentityGIN',
    'IdentitySAGE',
    'MLP',
    'GroupMLP',
    'MultiHeadBatchNorm',
    'MultiHeadLinear',
    'SAGN',
    'GPSEncoder',
]
