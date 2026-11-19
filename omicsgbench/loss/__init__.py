"""This module implements the loss functions for the omicsgbench package."""

from omicsgbench.loss.base import AbstractLoss
from omicsgbench.loss.dataset import LOSSES as DATASET_LOSSES
from omicsgbench.loss.dataset import DatasetLoss
from omicsgbench.loss.loss import TBLoss
from omicsgbench.loss.model import LOSSES as MODEL_LOSSES
from omicsgbench.loss.model import DGMLoss, GraphMLPLoss

# Aggregate all losses from subpackages
LOSSES: dict[str, type] = {
    **DATASET_LOSSES,
    **MODEL_LOSSES,
}

LOSSES_list: list[str] = list(LOSSES.keys())

# Generate __all__
__all__ = [
    'LOSSES',
    'LOSSES_list',
    'AbstractLoss',
    'DatasetLoss',
    'TBLoss',
    'DGMLoss',
    'GraphMLPLoss',
]
