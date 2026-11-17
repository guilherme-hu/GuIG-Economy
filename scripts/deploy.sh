#!/usr/bin/env bash
# Publica dist/ no branch gh-pages (GitHub Pages em modo "deploy from branch").
# O branch gh-pages é só de publicação: é recriado e sobrescrito a cada deploy.
set -euo pipefail
cd "$(dirname "$0")/.."
remote=$(git remote get-url origin)
npm test
npm run build
touch dist/.nojekyll
cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C .. config user.name)" -c user.email="$(git -C .. config user.email)" commit -q -m "deploy: $(git -C .. rev-parse --short HEAD)"
git push -q -f "$remote" gh-pages
rm -rf .git
echo "Publicado: https://guilherme-hu.github.io/GuIG-Economy/"
