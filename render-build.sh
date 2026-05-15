#!/usr/bin/env bash
set -e

PUPPETEER_SKIP_DOWNLOAD=true npm install
PUPPETEER_CACHE_DIR=/opt/render/project/puppeteer npx puppeteer browsers install chrome
