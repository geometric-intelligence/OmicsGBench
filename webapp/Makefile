SHELL := /bin/bash

.PHONY: help dev build preview stats lint clean install deps deploy

PROJECT ?= omicsgbench
DIST_DIR ?= dist
NPM ?= npm
PYTHON ?= python3
WRANGLER ?= npx --yes wrangler

help:
	@echo "Available targets:"
	@echo "  dev      - Start development server"
	@echo "  build    - Build for production from the committed public/data/*.json"
	@echo "  preview  - Preview production build"
	@echo "  stats    - Regenerate public/data/stats.json from the stats CSVs (review the diff before committing)"
	@echo "  lint     - Typecheck (astro check)"
	@echo "  clean    - Clean build artifacts"
	@echo "  install  - Install dependencies"
	@echo "  deps     - Alias for install"
	@echo "  deploy   - Deploy to Cloudflare Pages via wrangler"
	@echo ""
	@echo "Config:"
	@echo "  PROJECT=$(PROJECT)"
	@echo "  DIST_DIR=$(DIST_DIR)"

dev: build
	$(NPM) run dev

stats:
	$(PYTHON) scripts/build_stats_from_csv.py

# The stats CSVs are not all in the repo (BRCA WGCNA is missing), so build never regenerates stats.json.
build:
	$(NPM) run build

preview:
	$(NPM) run preview

lint:
	$(NPM) run lint

clean:
	rm -rf "$(DIST_DIR)/" .astro/ node_modules/.vite/

install:
	$(NPM) install

deps: install

deploy: lint build
	$(WRANGLER) pages deploy "$(DIST_DIR)" --project-name "$(PROJECT)"
