#!/bin/bash -l

# Check if conda is installed
if ! command -v conda &> /dev/null; then
    echo "Conda not found. Installing Miniconda..."

    # Download Miniconda installer
    wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O /tmp/miniconda.sh

    # Install Miniconda silently
    bash /tmp/miniconda.sh -b -p "$HOME/miniconda"

    # Remove installer
    rm /tmp/miniconda.sh

    # Initialize conda for bash shell
    eval "$("${HOME}"/miniconda/bin/conda shell.bash hook)"

    # Add conda to PATH permanently
    echo "export PATH=${HOME}/miniconda/bin:$PATH" >> ~/.bashrc

    # Source bashrc to apply changes
    # shellcheck disable=SC1090
    source ~/.bashrc

    echo "Conda installation complete"
fi

eval "$(conda shell.bash hook)"

if ! conda env list | grep -qw "omicsgbench"; then
    conda create -n omicsgbench python=3.12 -y
fi

conda activate omicsgbench

# pip ignores [tool.uv] in pyproject.toml, so pass the PyG wheel index explicitly.
pip install --upgrade pip
pip install -e '.[all]' -f "${PYG_WHEELS:-https://data.pyg.org/whl/torch-2.8.0+cu128.html}"

pre-commit install

echo "Done. Run 'conda activate omicsgbench' to use the environment."
