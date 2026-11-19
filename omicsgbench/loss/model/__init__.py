"""This module implements the loss functions for the omicsgbench package."""

from omicsgbench.loss.model.DGMLoss import DGMLoss
from omicsgbench.loss.model.GraphMLPLoss import GraphMLPLoss

# Create dictionary of all model losses
LOSSES: dict[str, type] = {
    'DGMLoss': DGMLoss,
    'GraphMLPLoss': GraphMLPLoss,
}

LOSSES_list: list[str] = list(LOSSES.keys())

# Generate __all__
__all__ = [
    'LOSSES',
    'LOSSES_list',
    'DGMLoss',
    'GraphMLPLoss',
]
