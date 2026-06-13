#!/bin/bash
# One-time deploy script for bia-beriim
# Run this from Terminal once, then use Vercel's GitHub integration going forward.

set -e

PROJ_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "📁 Project folder: $PROJ_DIR"

# 1. Install Vercel CLI if missing
if ! command -v vercel &>/dev/null; then
  echo "📦 Installing Vercel CLI..."
  npm install -g vercel
fi

# 2. Deploy
cd "$PROJ_DIR"
echo "🚀 Deploying to Vercel..."
vercel --prod --yes --name bia-beriim

echo ""
echo "✅ Done! Your live URL is above."
echo "👉 Next: connect Vercel to a GitHub repo for automatic deploys."
