/**
 * Script to generate PWA icon assets from source logos.
 *
 * - icon-{size}.png: Rounded icon for desktop/Windows (purpose: "any")
 *   Source: finext-icon-color-rounded.png
 *
 * - icon-maskable-{size}.png: Square icon for Android/iOS (purpose: "maskable")
 *   Source: finext-icon-color.png (OS will auto-crop/round)
 *
 * - apple-touch-icon.png: Apple devices
 *   Source: finext-icon-color.png
 */
const fs = require('fs');
const path = require('path');

const SOURCE_ROUNDED = path.join(__dirname, '..', 'public', 'finext-icon-color-rounded.png');
const SOURCE_SQUARE = path.join(__dirname, '..', 'public', 'finext-icon-color.png');
const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
}

const sizes = [192, 512];

// Generate "any" purpose icons (pre-rounded for desktop/Windows)
sizes.forEach(size => {
    const dest = path.join(ICONS_DIR, `icon-${size}x${size}.png`);
    fs.copyFileSync(SOURCE_ROUNDED, dest);
    console.log(`Created ${dest} (${size}x${size}) - rounded icon for desktop`);
});

// Generate "maskable" purpose icons (square for Android/iOS)
sizes.forEach(size => {
    const dest = path.join(ICONS_DIR, `icon-maskable-${size}x${size}.png`);
    fs.copyFileSync(SOURCE_SQUARE, dest);
    console.log(`Created ${dest} (${size}x${size}) - maskable icon for mobile`);
});

// Apple touch icon (square, iOS will auto-round)
const appleDest = path.join(ICONS_DIR, 'apple-touch-icon.png');
fs.copyFileSync(SOURCE_SQUARE, appleDest);
console.log(`Created ${appleDest} - apple touch icon`);

console.log('\nDone! Icons created in public/icons/');
console.log('Note: These are copies of the original logos. For production,');
console.log('resize them to exact 192x192 and 512x512 dimensions.');
