"""Wrappers for cell neural networks."""

from omicsgbench.nn.wrappers.cell.can_wrapper import CANWrapper
from omicsgbench.nn.wrappers.cell.cccn_wrapper import CCCNWrapper
from omicsgbench.nn.wrappers.cell.ccxn_wrapper import CCXNWrapper
from omicsgbench.nn.wrappers.cell.cwn_wrapper import CWNWrapper

# Create dictionary of all wrapper classes
WRAPPER_CLASSES: dict[str, type] = {
    'CANWrapper': CANWrapper,
    'CCCNWrapper': CCCNWrapper,
    'CCXNWrapper': CCXNWrapper,
    'CWNWrapper': CWNWrapper,
}

# Generate __all__
__all__ = [
    'WRAPPER_CLASSES',
    'CANWrapper',
    'CCCNWrapper',
    'CCXNWrapper',
    'CWNWrapper',
]
