"""Feature lifting transforms."""

from omicsgbench.transforms.feature_liftings.concatenation import Concatenation
from omicsgbench.transforms.feature_liftings.identity import Identity
from omicsgbench.transforms.feature_liftings.projection_sum import ProjectionSum
from omicsgbench.transforms.feature_liftings.set import Set

# Create dictionary of all feature liftings with special case for None
FEATURE_LIFTINGS: dict[str | None, type] = {
    'Concatenation': Concatenation,
    'Identity': Identity,
    'ProjectionSum': ProjectionSum,
    'Set': Set,
    None: Identity,  # Special case: None maps to Identity
}

# Generate __all__ (excluding None key)
__all__ = [
    'FEATURE_LIFTINGS',
    'Concatenation',
    'Identity',
    'ProjectionSum',
    'Set',
]
