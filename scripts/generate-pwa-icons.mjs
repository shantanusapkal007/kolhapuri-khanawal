import fs from "fs";
import path from "path";
import sharp from "sharp";

const iconsDir = path.join(process.cwd(), "public", "icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1. Standard SVG Icon with rich Royal Crimson background, Golden Accent, Chef Hat & Marathi Typography
const createStandardSvg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#991B1B" />
      <stop offset="60%" stop-color="#7F1D1D" />
      <stop offset="100%" stop-color="#450A0A" />
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDE68A" />
      <stop offset="50%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#D97706" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.4" />
    </filter>
  </defs>

  <!-- Background with subtle border -->
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bg)" />
  <rect x="${size * 0.04}" y="${size * 0.04}" width="${size * 0.92}" height="${size * 0.92}" rx="${size * 0.18}" fill="none" stroke="url(#gold)" stroke-width="${size * 0.02}" opacity="0.6" />

  <!-- Center Chef Hat / Royal Kolhapuri Emblem -->
  <g transform="translate(${size * 0.25}, ${size * 0.18}) scale(${size / 512})" filter="url(#shadow)">
    <!-- Chef Hat Base -->
    <path d="M 64 200 L 192 200 L 192 230 C 192 236 186 240 180 240 L 76 240 C 70 240 64 236 64 230 Z" fill="url(#gold)" />
    <!-- Chef Hat Puffs -->
    <path d="M 72 195 C 40 190 30 140 60 115 C 45 80 85 50 120 70 C 150 45 195 70 188 110 C 220 135 210 185 184 195 Z" fill="#FFFBEB" />
    <!-- Hat Ribbon -->
    <rect x="70" y="206" width="116" height="8" rx="4" fill="#991B1B" />
    <!-- Spice Flame Accent -->
    <path d="M 128 85 C 135 110 115 125 128 145 C 138 125 145 115 138 95 Z" fill="#DC2626" />
  </g>

  <!-- Typography -->
  <text x="50%" y="${size * 0.73}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="${size * 0.13}" fill="#FFFBEB" letter-spacing="0.5">खानावळ</text>
  <text x="50%" y="${size * 0.86}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="${size * 0.08}" fill="url(#gold)" letter-spacing="1">RESTAURANT OS</text>
</svg>
`;

// 2. Maskable Icon (safe zone requires keeping content in inner 80% circle)
const createMaskableSvg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg-mask" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#991B1B" />
      <stop offset="60%" stop-color="#7F1D1D" />
      <stop offset="100%" stop-color="#450A0A" />
    </linearGradient>
    <linearGradient id="gold-mask" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDE68A" />
      <stop offset="50%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#D97706" />
    </linearGradient>
  </defs>

  <!-- Full-bleed background -->
  <rect width="${size}" height="${size}" fill="url(#bg-mask)" />

  <!-- Content positioned strictly in 80% safe center -->
  <g transform="translate(${size * 0.28}, ${size * 0.22}) scale(${(size * 0.88) / 512})">
    <path d="M 64 200 L 192 200 L 192 230 C 192 236 186 240 180 240 L 76 240 C 70 240 64 236 64 230 Z" fill="url(#gold-mask)" />
    <path d="M 72 195 C 40 190 30 140 60 115 C 45 80 85 50 120 70 C 150 45 195 70 188 110 C 220 135 210 185 184 195 Z" fill="#FFFBEB" />
    <rect x="70" y="206" width="116" height="8" rx="4" fill="#991B1B" />
    <path d="M 128 85 C 135 110 115 125 128 145 C 138 125 145 115 138 95 Z" fill="#DC2626" />
  </g>

  <text x="50%" y="${size * 0.70}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="${size * 0.11}" fill="#FFFBEB">खानावळ</text>
  <text x="50%" y="${size * 0.82}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="${size * 0.07}" fill="url(#gold-mask)">POS</text>
</svg>
`;

async function generate() {
  console.log("Generating PWA Icons...");

  // 192x192
  await sharp(Buffer.from(createStandardSvg(192)))
    .png()
    .toFile(path.join(iconsDir, "icon-192x192.png"));
  console.log("Created icon-192x192.png");

  // 512x512
  await sharp(Buffer.from(createStandardSvg(512)))
    .png()
    .toFile(path.join(iconsDir, "icon-512x512.png"));
  console.log("Created icon-512x512.png");

  // 180x180 Apple Touch Icon
  await sharp(Buffer.from(createStandardSvg(180)))
    .png()
    .toFile(path.join(iconsDir, "apple-touch-icon.png"));
  // Also copy to public root for default Apple crawler lookup
  await sharp(Buffer.from(createStandardSvg(180)))
    .png()
    .toFile(path.join(process.cwd(), "public", "apple-touch-icon.png"));
  console.log("Created apple-touch-icon.png");

  // Maskable 192x192
  await sharp(Buffer.from(createMaskableSvg(192)))
    .png()
    .toFile(path.join(iconsDir, "icon-maskable-192x192.png"));
  console.log("Created icon-maskable-192x192.png");

  // Maskable 512x512
  await sharp(Buffer.from(createMaskableSvg(512)))
    .png()
    .toFile(path.join(iconsDir, "icon-maskable-512x512.png"));
  console.log("Created icon-maskable-512x512.png");

  // Favicon 32x32 & 48x48
  await sharp(Buffer.from(createStandardSvg(32)))
    .png()
    .toFile(path.join(iconsDir, "favicon-32x32.png"));
  await sharp(Buffer.from(createStandardSvg(48)))
    .png()
    .toFile(path.join(process.cwd(), "public", "icon.png"));
  console.log("Created favicon and fallback icon.png");

  console.log("All PWA icons successfully generated!");
}

generate().catch(console.error);
