import sharp from 'sharp'
import { readFileSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// GPL logo SVG — simplified square crop centred on the shield
// viewBox 680x520, shield is roughly centred at 340,258
// We'll use a slightly modified version with a square viewBox for the icon
const iconSvg = `<svg width="1024" height="1024" viewBox="120 48 440 440" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="1024" height="1024" fill="#0A1628"/>

  <!-- Shield -->
  <path d="M340 68 L510 130 L510 290 Q510 390 340 452 Q170 390 170 290 L170 130 Z" fill="#0A1628" stroke="#C9A227" stroke-width="3"/>
  <path d="M340 94 L486 147 L486 284 Q486 370 340 424 Q194 370 194 284 L194 147 Z" fill="#0D1E35"/>

  <!-- Inner shield border -->
  <path d="M340 88 L492 143 L492 286 Q492 376 340 432 Q188 376 188 286 L188 143 Z" fill="none" stroke="#C9A227" stroke-width="1" opacity="0.5"/>

  <!-- Top banner -->
  <path d="M220 148 L460 148 L460 175 L340 182 L220 175 Z" fill="#C9A227" opacity="0.15"/>

  <!-- Horizontal divider -->
  <line x1="205" y1="215" x2="475" y2="215" stroke="#C9A227" stroke-width="1" opacity="0.6"/>

  <!-- GPL text -->
  <text x="340" y="205" font-family="Impact, sans-serif" font-size="92" font-weight="400" fill="#C9A227" text-anchor="middle" letter-spacing="6">GPL</text>

  <!-- Subtitle -->
  <text x="340" y="248" font-family="Arial Narrow, Arial, sans-serif" font-size="14" font-weight="700" fill="#E8D88A" text-anchor="middle" letter-spacing="5">GEEK PREMIER LEAGUE</text>

  <!-- Divider dots -->
  <line x1="200" y1="260" x2="298" y2="260" stroke="#C9A227" stroke-width="0.8" opacity="0.7"/>
  <line x1="382" y1="260" x2="480" y2="260" stroke="#C9A227" stroke-width="0.8" opacity="0.7"/>
  <circle cx="340" cy="260" r="3" fill="#C9A227" opacity="0.9"/>

  <!-- AUCTION badge -->
  <rect x="254" y="275" width="172" height="36" rx="4" fill="#C9A227"/>
  <text x="340" y="299" font-family="Impact, Arial, sans-serif" font-size="22" font-weight="400" fill="#0A1628" text-anchor="middle" letter-spacing="5">AUCTION</text>

  <!-- Bottom decoration -->
  <line x1="230" y1="328" x2="310" y2="328" stroke="#C9A227" stroke-width="0.8" opacity="0.5"/>
  <line x1="370" y1="328" x2="450" y2="328" stroke="#C9A227" stroke-width="0.8" opacity="0.5"/>
  <circle cx="340" cy="328" r="3" fill="#C9A227" opacity="0.6"/>

  <!-- Season text -->
  <text x="340" y="358" font-family="Arial Narrow, Arial, sans-serif" font-size="12" font-weight="700" fill="#C9A227" text-anchor="middle" letter-spacing="4" opacity="0.7">SEASON 2026</text>
</svg>`

// Sizes needed for Android
const sizes = [
  { dir: 'mipmap-mdpi',    size: 48  },
  { dir: 'mipmap-hdpi',    size: 72  },
  { dir: 'mipmap-xhdpi',   size: 96  },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
]

const resDir = join(root, 'android', 'app', 'src', 'main', 'res')

const svgBuf = Buffer.from(iconSvg)

for (const { dir, size } of sizes) {
  const outDir = join(resDir, dir)
  mkdirSync(outDir, { recursive: true })

  await sharp(svgBuf, { density: Math.round(size * 2.5) })
    .resize(size, size, { fit: 'contain', background: { r: 10, g: 22, b: 40, alpha: 1 } })
    .png()
    .toFile(join(outDir, 'ic_launcher.png'))

  await sharp(svgBuf, { density: Math.round(size * 2.5) })
    .resize(size, size, { fit: 'contain', background: { r: 10, g: 22, b: 40, alpha: 1 } })
    .png()
    .toFile(join(outDir, 'ic_launcher_round.png'))

  // Foreground — same icon with transparent background for adaptive icons
  await sharp(svgBuf, { density: Math.round(size * 2.5) })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(outDir, 'ic_launcher_foreground.png'))

  console.log(`✓ ${dir}: ${size}×${size}`)
}

// Also write the 1024px master to assets folder for reference
mkdirSync(join(root, 'assets'), { recursive: true })
await sharp(svgBuf, { density: 300 })
  .resize(1024, 1024, { fit: 'contain', background: { r: 10, g: 22, b: 40, alpha: 1 } })
  .png()
  .toFile(join(root, 'assets', 'icon.png'))
console.log('✓ assets/icon.png (1024×1024)')

console.log('\nDone — Android icons generated.')
