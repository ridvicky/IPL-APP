/**
 * Merges interestedTeams from playerinterests2025.json into ipl2025.json.
 * Matches by playerName (case-insensitive, trimmed).
 * Run: node scripts/patch-interested-teams.cjs
 */

const fs = require('fs')
const path = require('path')

const DATASET_PATH = path.join(__dirname, '../src/data/datasets/ipl2025.json')
const INTERESTS_PATH = path.join(__dirname, '../src/data/datasets/playerinterests2025.json')

const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf-8'))
const interests = JSON.parse(fs.readFileSync(INTERESTS_PATH, 'utf-8'))

// Build lookup: normalized name → interestedTeams
const normalize = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '')
const lookup = new Map()
for (const entry of interests) {
  lookup.set(normalize(entry.playerName), entry.interestedTeams ?? [])
}

let matched = 0
let unmatched = []

for (const player of dataset.players) {
  const key = normalize(player.name)
  if (lookup.has(key)) {
    const teams = lookup.get(key)
    if (teams.length > 0) {
      player.interestedTeams = teams
    } else {
      delete player.interestedTeams
    }
    matched++
  } else {
    unmatched.push(player.name)
  }
}

fs.writeFileSync(DATASET_PATH, JSON.stringify(dataset, null, 2), 'utf-8')

console.log(`\nDone. Matched: ${matched} / ${dataset.players.length}`)
if (unmatched.length > 0) {
  console.log(`\nUnmatched players (no interests entry):\n${unmatched.join('\n')}`)
}
