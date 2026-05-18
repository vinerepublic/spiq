#!/usr/bin/env node

/**
 * Generate placeholder app icons for Spiq
 *
 * This creates simple colored icons with text that you can replace later
 * with professional designs.
 */

const fs = require('fs');
const path = require('path');

// Create assets directory if it doesn't exist
const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// SVG template for app icon
const createSVG = (size, text) => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#grad)"/>

  <!-- Icon graphic - microphone symbol -->
  <g transform="translate(${size * 0.5}, ${size * 0.5})">
    <!-- Microphone body -->
    <rect x="${-size * 0.1}" y="${-size * 0.25}" width="${size * 0.2}" height="${size * 0.3}" rx="${size * 0.1}" fill="white" opacity="0.95"/>

    <!-- Microphone stand -->
    <line x1="0" y1="${size * 0.1}" x2="0" y2="${size * 0.25}" stroke="white" stroke-width="${size * 0.03}" opacity="0.95"/>
    <line x1="${-size * 0.08}" y1="${size * 0.25}" x2="${size * 0.08}" y2="${size * 0.25}" stroke="white" stroke-width="${size * 0.03}" opacity="0.95"/>

    <!-- Sound waves -->
    <path d="M ${-size * 0.2} ${-size * 0.15} Q ${-size * 0.25} ${-size * 0.1} ${-size * 0.2} ${-size * 0.05}"
          stroke="white" stroke-width="${size * 0.025}" fill="none" opacity="0.7"/>
    <path d="M ${size * 0.2} ${-size * 0.15} Q ${size * 0.25} ${-size * 0.1} ${size * 0.2} ${-size * 0.05}"
          stroke="white" stroke-width="${size * 0.025}" fill="none" opacity="0.7"/>
  </g>

  ${text ? `<text x="${size / 2}" y="${size * 0.85}" font-family="Arial, sans-serif" font-size="${size * 0.15}" font-weight="bold" fill="white" text-anchor="middle" opacity="0.9">${text}</text>` : ''}
</svg>`;

// Create icon files
const icons = [
  { name: 'icon.png', size: 1024, text: 'SPIQ' },           // iOS App Store
  { name: 'adaptive-icon.png', size: 1024, text: 'SPIQ' },  // Android
  { name: 'splash-icon.png', size: 1024, text: '' },        // Splash screen
  { name: 'favicon.png', size: 48, text: '' },              // Web favicon
];

console.log('🎨 Generating Spiq app icons...\n');

icons.forEach(({ name, size, text }) => {
  const svgContent = createSVG(size, text);
  const svgPath = path.join(assetsDir, name.replace('.png', '.svg'));

  fs.writeFileSync(svgPath, svgContent);
  console.log(`✓ Created ${name.replace('.png', '.svg')} (${size}x${size})`);
});

console.log('\n📝 Next Steps:');
console.log('1. Convert SVG files to PNG using an online tool:');
console.log('   - https://cloudconvert.com/svg-to-png');
console.log('   - Or use: brew install imagemagick && ./scripts/convert-icons.sh\n');
console.log('2. Or use a design tool like Figma/Canva to create professional icons\n');
console.log('3. Replace the SVG files in ./assets/ with your final PNG icons\n');

// Create conversion script
const convertScript = `#!/bin/bash
# Convert SVG icons to PNG using ImageMagick
# Install: brew install imagemagick

cd "$(dirname "$0")/../assets"

echo "Converting SVG icons to PNG..."

convert icon.svg -resize 1024x1024 icon.png
convert adaptive-icon.svg -resize 1024x1024 adaptive-icon.png
convert splash-icon.svg -resize 1024x1024 splash-icon.png
convert favicon.svg -resize 48x48 favicon.png

echo "✓ All icons converted!"
`;

const convertScriptPath = path.join(__dirname, 'convert-icons.sh');
fs.writeFileSync(convertScriptPath, convertScript);
fs.chmodSync(convertScriptPath, '755');

console.log('💡 Pro Tip: These are placeholder icons. For production, consider:');
console.log('   - Hiring a designer on Fiverr ($20-50)');
console.log('   - Using Canva Pro templates');
console.log('   - AI icon generators like Midjourney/DALL-E');
