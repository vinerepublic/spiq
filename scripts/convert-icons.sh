#!/bin/bash
# Convert SVG icons to PNG using ImageMagick
# Install: brew install imagemagick

cd "$(dirname "$0")/../assets"

echo "Converting SVG icons to PNG..."

convert icon.svg -resize 1024x1024 icon.png
convert adaptive-icon.svg -resize 1024x1024 adaptive-icon.png
convert splash-icon.svg -resize 1024x1024 splash-icon.png
convert favicon.svg -resize 48x48 favicon.png

echo "✓ All icons converted!"
