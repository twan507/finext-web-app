/**
 * Script to generate PWA icon assets from the source logo.
 * Uses the Canvas API (via node built-in or sharp-like approach).
 * Since we don't want extra dependencies, we'll just copy and
 * the user can replace with properly sized icons later.
 *
 * For now, we create a simple HTML-based approach to verify.
 */
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, '..', 'public', 'finext-icon-trans.png');
const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// Copy source as both sizes (user should replace with properly resized versions)
const sizes = [192, 512];
sizes.forEach(size => {
    const dest = path.join(ICONS_DIR, `icon-${size}x${size}.png`);
    fs.copyFileSync(SOURCE, dest);
    console.log(`Created ${dest} (${size}x${size}) - copied from source`);
});

console.log('\nDone! Icons created in public/icons/');
console.log('Note: These are copies of the original logo. For production,');
console.log('resize them to exact 192x192 and 512x512 dimensions.');
