/**
 * Merges boughtPrice from playerinterests2025.json into ipl2025.json.
 * Matches by playerName (case-insensitive, normalized).
 * Run: node scripts/patch-bought-prices.cjs
 */

const fs = require('fs')
const path = require('path')

const DATASET_PATH  = path.join(__dirname, '../src/data/datasets/ipl2025.json')
const INTERESTS_PATH = path.join(__dirname, '../src/data/datasets/playerinterests2025.json')

const dataset   = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf-8'))
const interests = JSON.parse(fs.readFileSync(INTERESTS_PATH, 'utf-8'))

const normalize = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '')
const lookup = new Map()
for (const entry of interests) {
  if (entry.boughtPrice != null) {
    lookup.set(normalize(entry.playerName), entry.boughtPrice)
  }
}

let patched = 0
let skipped = 0

for (const player of dataset.players) {
  const key = normalize(player.name)
  if (lookup.has(key)) {
    player.boughtPrice = lookup.get(key)
    patched++
  } else {
    skipped++
  }
}

fs.writeFileSync(DATASET_PATH, JSON.stringify(dataset, null, 2), 'utf-8')
console.log(`Done. Patched: ${patched} with boughtPrice | Skipped (unsold/no match): ${skipped}`)
