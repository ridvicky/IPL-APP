/**
 * Patches ipl2025.json with historical IPL auction prices as marketValue.
 * These are the POOL players (unsold in IPL 2025) and their previous sale prices
 * from IPL 2024, 2023, 2022 auctions — used as a market anchor for the LLM.
 *
 * Where a player went unsold in 2025 after being sold in 2024, their marketValue
 * reflects their perceived current worth (typically below their 2024 price).
 *
 * Run: node scripts/patch-market-values.cjs
 */
const fs = require('fs')
const path = require('path')

const DATA_PATH = path.join(__dirname, '../src/data/datasets/ipl2025.json')

// Historical prices for players now in the unsold pool.
// Format: { name, value, note }
// value = best estimate of what the player is realistically worth in 2025 auction context
// Sources: IPL 2024 auction, IPL 2023 auction, IPL 2022 mega auction, last known sale
const HISTORICAL = [
  // ── OVERSEAS BATTERS ─────────────────────────────────────────────────────────
  { name: 'David Warner',          value: 5.25, note: 'PBKS 2022 ₹6.25Cr, declined with age; unsold 2025' },
  { name: 'Kane Williamson',       value: 2.0,  note: 'CSK 2018 mega ₹12.5Cr, GTfree 2022; form decline' },
  { name: 'Jonny Bairstow',        value: 4.0,  note: 'PBKS 2024 ₹6.75Cr; unsold 2025 after injury' },
  { name: 'Moeen Ali',             value: 2.0,  note: 'CSK retained historically; released; ageing' },
  { name: 'Jason Roy',             value: 1.0,  note: 'Not in IPL regularly; England T20 form patchy' },
  { name: 'Dawid Malan',          value: 0.75, note: 'Limited IPL history; older' },
  { name: 'Ben Duckett',           value: 1.0,  note: 'IPL debutant; ENG top-order' },
  { name: 'Rassie van der Dussen', value: 1.5,  note: 'Limited IPL; SA utility bat' },
  { name: 'Sarel Erwee',           value: 0.5,  note: 'Limited IPL exposure' },
  { name: 'Tom Latham',            value: 0.5,  note: 'Rarely in IPL; NZ stalwart but older' },
  { name: 'Devon Conway',          value: 2.0,  note: 'CSK 2025 ₹6.25Cr — is in sold list actually; check' },
  { name: 'Will Young',            value: 0.5,  note: 'Limited IPL history' },
  { name: 'Henry Nicholls',        value: 0.5,  note: 'No meaningful IPL history' },
  { name: 'Kusal Mendis',          value: 1.5,  note: 'SL captain; handy T20 bat' },
  { name: 'Pathum Nissanka',       value: 1.0,  note: 'Solid SL opener; limited IPL' },
  { name: 'Dimuth Karunaratne',    value: 0.4,  note: 'Test specialist; T20 fringe' },
  { name: 'Charith Asalanka',      value: 1.0,  note: 'SL T20 regular; some IPL exposure' },
  { name: 'Mark Chapman',          value: 0.5,  note: 'HK/NZ; limited IPL' },
  { name: 'Evin Lewis',            value: 1.0,  note: 'WI opener; powerful but inconsistent' },
  { name: 'Kyle Mayers',           value: 1.5,  note: 'WI allrounder; some IPL interest' },
  { name: 'Shimron Hetmyer',       value: 3.0,  note: 'RR 2022 ₹8.5Cr; valuable finisher' },
  { name: 'Nicholas Pooran',       value: 7.0,  note: 'LSG 2022 ₹10.75Cr; in-form WI bat-wk' },
  { name: 'Brandon King',          value: 1.5,  note: 'WI opener; IPL fringe' },
  { name: 'Shai Hope',             value: 1.0,  note: 'WI wk-bat; ODI specialist' },
  { name: 'Andre Russell',         value: 10.0, note: 'KKR retained ₹12Cr historically; mega draw' },
  { name: 'Rovman Powell',         value: 2.0,  note: 'KKR 2025 ₹1.5Cr — check if in pool' },
  { name: 'Daryl Mitchell',        value: 9.0,  note: 'CSK 2024 ₹14Cr; still strong all-format' },
  { name: 'Michael Bracewell',     value: 1.5,  note: 'NZ AR; some IPL exposure' },
  { name: 'Chad Bowes',            value: 0.5,  note: 'Limited IPL exposure' },
  { name: 'Corbin Bosch',          value: 0.75, note: 'SA allrounder; IPL debutant' },
  { name: 'Aiden Markram',         value: 2.0,  note: 'LSG 2025 ₹2Cr — in sold list; check' },
  { name: 'Reeza Hendricks',       value: 0.75, note: 'SA opener; limited IPL' },
  { name: 'Ryan Rickelton',        value: 1.0,  note: 'MI 2025 ₹1Cr — in sold list; check' },
  { name: 'Temba Bavuma',          value: 1.5,  note: 'SA captain; limited T20 IPL history' },
  { name: 'Matthew Breetzke',      value: 0.75, note: 'LSG 2025 ₹0.75Cr — in sold list; check' },
  { name: 'Rilee Rossouw',         value: 4.5,  note: 'PBKS 2024 ₹8Cr; dangerous but inconsistent' },
  { name: 'Colin Munro',           value: 1.0,  note: 'Ageing; NZ T20 stalwart' },
  { name: 'Josh Inglis',           value: 2.0,  note: 'PBKS 2025 ₹2.6Cr — in sold list; check' },
  { name: 'Travis Head',           value: 14.0, note: 'SRH 2024 retained; massively in-demand' },
  { name: 'David Payne',           value: 0.5,  note: 'English pacer; limited IPL' },
  { name: 'Tom Kohler-Cadmore',    value: 0.5,  note: 'Limited IPL exposure' },
  { name: 'Alex Hales',            value: 3.0,  note: 'KKR 2023 mega draw; strong T20 pedigree' },
  { name: 'Finn Allen',            value: 2.0,  note: 'RCB 2023; aggressive opener' },
  { name: 'Glenn Phillips',        value: 2.0,  note: 'GT 2025 ₹2Cr — in sold list; check' },
  { name: 'Tom Banton',            value: 0.75, note: 'Limited IPL; ENG fringe' },
  { name: 'Kamran Ghulam',         value: 1.0,  note: 'Afghan bat; rising profile' },
  { name: 'Ibrahim Zadran',        value: 1.5,  note: 'Afghan opener; promising' },
  { name: 'Rahmanullah Gurbaz',    value: 2.0,  note: 'KKR 2025 ₹2Cr — in sold list; check' },
  { name: 'Hazratullah Zazai',     value: 1.5,  note: 'Afghan T20 aggressor' },

  // ── OVERSEAS WK-BATTERS ──────────────────────────────────────────────────────
  { name: 'Jos Buttler',           value: 15.75,note: 'GT 2025 ₹15.75Cr — in sold list; check' },
  { name: 'Quinton de Kock',       value: 3.5,  note: 'KKR 2025 ₹3.6Cr — in sold list; check' },
  { name: 'Phil Salt',             value: 11.5, note: 'RCB 2025 ₹11.5Cr — in sold list; check' },
  { name: 'Ishan Kishan',          value: 11.25,note: 'SRH 2025 ₹11.25Cr — in sold list; check' },
  { name: 'Sam Billings',          value: 2.0,  note: 'CSK history; wk-bat; ageing slightly' },
  { name: 'Alex Carey',            value: 1.5,  note: 'Australia Test wk; limited IPL' },
  { name: 'Matthew Wade',          value: 1.0,  note: 'Ageing Aus wk; limited IPL future' },
  { name: 'Tom Latham',            value: 0.5,  note: 'NZ wk; test specialist' },
  { name: 'Sikandar Raza',         value: 2.0,  note: 'ZIM allrounder-wk; SRH 2023' },
  { name: 'Lorcan Tucker',         value: 0.5,  note: 'Ireland wk; limited IPL' },
  { name: 'Michael-Kyle Pepper',   value: 0.5,  note: 'SA debutant' },
  { name: 'Heinrich Klaasen',      value: 10.0, note: 'SRH retained; massive T20 value' },
  { name: 'Ben McDermott',         value: 1.0,  note: 'Aus wk-bat; limited IPL' },
  { name: 'Niroshan Dickwella',    value: 0.75, note: 'SL wk; limited modern IPL' },
  { name: 'Dinesh Karthik',        value: 2.0,  note: 'Retired from IPL; if in pool — symbolic' },

  // ── OVERSEAS ALL-ROUNDERS ─────────────────────────────────────────────────────
  { name: 'Ben Stokes',            value: 10.0, note: 'CSK 2023 ₹16.25Cr; injured but massive brand' },
  { name: 'Sam Curran',            value: 2.0,  note: 'CSK 2025 ₹2.4Cr — in sold list; check' },
  { name: 'Liam Livingstone',      value: 8.75, note: 'RCB 2025 ₹8.75Cr — in sold list; check' },
  { name: 'Marcus Stoinis',        value: 11.0, note: 'PBKS 2025 ₹11Cr — in sold list; check' },
  { name: 'Mitchell Marsh',        value: 3.0,  note: 'LSG 2025 ₹3.4Cr — in sold list; check' },
  { name: 'Glenn Maxwell',         value: 4.0,  note: 'PBKS 2025 ₹4.2Cr — in sold list; check' },
  { name: 'David Miller',          value: 7.5,  note: 'LSG 2025 ₹7.5Cr — in sold list; check' },
  { name: 'Harry Brook',           value: 6.0,  note: 'DC 2025 ₹6.25Cr — in sold list; check' },
  { name: 'Rachin Ravindra',       value: 4.0,  note: 'CSK 2025 ₹4Cr — in sold list; check' },
  { name: 'Tim David',             value: 3.0,  note: 'RCB 2025 ₹3Cr — in sold list; check' },
  { name: 'Will Jacks',            value: 5.25, note: 'MI 2025 ₹5.25Cr — in sold list; check' },
  { name: 'Romario Shepherd',      value: 1.5,  note: 'RCB 2025 ₹1.5Cr — in sold list; check' },
  { name: 'Tom Curran',            value: 1.5,  note: 'RCB 2024 ₹1.5Cr; limited impact' },
  { name: 'Odean Smith',           value: 1.0,  note: 'WI AR; limited IPL impact' },
  { name: 'Jason Holder',          value: 3.5,  note: 'SRH 2024 ₹4.6Cr; solid overseas AR' },
  { name: 'Alzarri Joseph',        value: 7.0,  note: 'RCB 2024 ₹11.5Cr; pace spearhead' },
  { name: 'Dominic Drakes',        value: 1.0,  note: 'WI pace-AR; limited IPL' },
  { name: 'Kylie Carty',           value: 0.4,  note: 'Debutant' },
  { name: 'Sherfane Rutherford',   value: 2.0,  note: 'GT 2025 ₹2.6Cr — in sold list; check' },
  { name: 'Azmatullah Omarzai',    value: 2.0,  note: 'PBKS 2025 ₹2.4Cr — in sold list; check' },
  { name: 'Daryl Mitchell',        value: 9.0,  note: 'CSK 2024 ₹14Cr; strong all-format value' },
  { name: 'Michael Bracewell',     value: 1.5,  note: 'NZ AR; some IPL exposure' },
  { name: 'Carlos Brathwaite',     value: 1.5,  note: 'WI AR; big-hitting reputation' },
  { name: 'Roston Chase',          value: 1.0,  note: 'WI off-spin AR; limited T20 IPL' },
  { name: 'Keemo Paul',            value: 1.0,  note: 'WI young AR; limited IPL' },
  { name: 'Imad Wasim',            value: 1.5,  note: 'PAK AR; limited India availability (visa)' },
  { name: 'Shoaib Malik',          value: 0.5,  note: 'Ageing PAK; limited modern IPL' },
  { name: 'Mohammad Nabi',         value: 1.5,  note: 'Afg AR; SRH 2022; experienced' },
  { name: 'Gulbadin Naib',         value: 0.75, note: 'Afg AR; limited IPL' },
  { name: 'Najibullah Zadran',     value: 1.0,  note: 'Afg power-hitter' },
  { name: 'Gus Atkinson',          value: 1.5,  note: 'KKR 2024 ₹1Cr; rising ENG pacer-AR' },
  { name: 'Chris Woakes',          value: 1.5,  note: 'ENG AR; limited modern IPL' },
  { name: 'Leus du Plooy',         value: 1.5,  note: 'SA AR; promising' },
  { name: 'Corbin Bosch',          value: 0.75, note: 'SA fast-AR; IPL debutant' },
  { name: 'Wiaan Mulder',          value: 1.5,  note: 'SA AR; useful with bat and ball' },
  { name: 'Tristan Stubbs',        value: 3.0,  note: 'SRH 2024 ₹5.8Cr; power-hitting SA bat' },
  { name: 'Donovan Ferreira',      value: 0.75, note: 'DC 2025 ₹0.75Cr — in sold list; check' },
  { name: 'Ryan Kleesen',          value: 0.4,  note: 'SA; limited IPL' },
  { name: 'Sikandar Raza',         value: 2.0,  note: 'Zim AR-wk; SRH 2023' },
  { name: 'Seekkuge Prasanna',     value: 0.5,  note: 'SL spin-AR; limited modern IPL' },
  { name: 'Wanindu Hasaranga',     value: 5.25, note: 'RR 2025 ₹5.25Cr — in sold list; check' },
  { name: 'Mitchell Santner',      value: 2.0,  note: 'MI 2025 ₹2Cr — in sold list; check' },

  // ── OVERSEAS FAST BOWLERS ─────────────────────────────────────────────────────
  { name: 'Jofra Archer',          value: 12.5, note: 'RR 2025 ₹12.5Cr — in sold list; check' },
  { name: 'Trent Boult',           value: 12.5, note: 'MI 2025 ₹12.5Cr — in sold list; check' },
  { name: 'Josh Hazlewood',        value: 12.5, note: 'RCB 2025 ₹12.5Cr — in sold list; check' },
  { name: 'Mitchell Starc',        value: 11.75,note: 'DC 2025 ₹11.75Cr — in sold list; check' },
  { name: 'Kagiso Rabada',         value: 10.75,note: 'GT 2025 ₹10.75Cr — in sold list; check' },
  { name: 'Pat Cummins',           value: 18.0, note: 'SRH retained ₹18Cr; world class' },
  { name: 'Anrich Nortje',         value: 6.5,  note: 'KKR 2025 ₹6.5Cr — in sold list; check' },
  { name: 'Marco Jansen',          value: 7.0,  note: 'PBKS 2025 ₹7Cr — in sold list; check' },
  { name: 'Gerald Coetzee',        value: 2.5,  note: 'GT 2025 ₹2.4Cr — in sold list; check' },
  { name: 'Lockie Ferguson',       value: 2.0,  note: 'PBKS 2025 ₹2Cr — in sold list; check' },
  { name: 'Spencer Johnson',       value: 2.8,  note: 'KKR 2025 ₹2.8Cr — in sold list; check' },
  { name: 'Kyle Jamieson',         value: 4.0,  note: 'RCB 2021 ₹15Cr; inconsistent since; injuries' },
  { name: 'Duanne Olivier',        value: 1.5,  note: 'SA pacer; limited IPL' },
  { name: 'Migael Pretorius',      value: 0.75, note: 'SA pacer; IPL debutant' },
  { name: 'Lizaad Williams',       value: 0.75, note: 'MI 2025 ₹0.75Cr — in sold list; check' },
  { name: 'Reece Topley',          value: 0.75, note: 'MI 2025 ₹0.75Cr — in sold list; check' },
  { name: 'Matthew Potts',         value: 0.5,  note: 'ENG pacer; IPL fringe' },
  { name: 'Olly Stone',            value: 0.5,  note: 'ENG pacer; injury history' },
  { name: 'Mark Wood',             value: 5.0,  note: 'LSG 2024 ₹7.5Cr; pace ace; injury-prone' },
  { name: 'Luke Wood',             value: 0.75, note: 'ENG pacer; limited IPL' },
  { name: 'Tymal Mills',           value: 1.5,  note: 'ENG death bowler; MI history' },
  { name: 'Alzarri Joseph',        value: 7.0,  note: 'RCB 2024 ₹11.5Cr; strong pace spearhead' },
  { name: 'Jayden Seales',         value: 1.5,  note: 'WI young pacer; rising' },
  { name: 'Kemar Roach',           value: 0.75, note: 'WI veteran pacer; ageing' },
  { name: 'Alzarri Joseph',        value: 7.0,  note: 'Already listed' },
  { name: 'Anderson Phillip',      value: 1.5,  note: 'WI pacer; limited IPL' },
  { name: 'Oshane Thomas',         value: 1.0,  note: 'WI pacer; injury-prone' },
  { name: 'Sheldon Cottrell',      value: 0.75, note: 'WI pacer; past prime' },
  { name: 'Ravi Rampaul',          value: 0.4,  note: 'Veteran WI; very old' },
  { name: 'Mohammad Abbas',        value: 0.5,  note: 'PAK test pacer; limited T20' },
  { name: 'Haris Rauf',            value: 5.0,  note: 'MI 2022; express pace; likely visa issues' },
  { name: 'Naseem Shah',           value: 5.0,  note: 'SA 2024; raw pace; visa issue concern' },
  { name: 'Shaheen Shah Afridi',   value: 6.0,  note: 'MI 2022 ₹9.25Cr; visa concern for PAK players' },
  { name: 'Fazalhaq Farooqi',      value: 2.0,  note: 'RR 2025 ₹2Cr — in sold list; check' },
  { name: 'Naveen-ul-Haq',         value: 2.5,  note: 'LSG 2023; quality Afghan pacer' },
  { name: 'Mujeeb Ur Rahman',      value: 3.0,  note: 'PBKS 2022; Afghan mystery spin' },
  { name: 'Noor Ahmad',            value: 10.0, note: 'CSK 2025 ₹10Cr — in sold list; check' },
  { name: 'Kwena Maphaka',         value: 1.5,  note: 'RR 2025 ₹1.5Cr — in sold list; check' },
  { name: 'Nuwan Thushara',        value: 1.6,  note: 'RCB 2025 ₹1.6Cr — in sold list; check' },
  { name: 'Matheesha Pathirana',   value: 8.0,  note: 'CSK retained; slingshot bowler; high value' },
  { name: 'Dushmantha Chameera',   value: 2.0,  note: 'SL pacer; some IPL history' },
  { name: 'Dilshan Madushanka',    value: 4.0,  note: 'MI 2024 ₹4.6Cr; left-arm pace' },
  { name: 'Lahiru Kumara',         value: 1.5,  note: 'SL pacer; inconsistent' },
  { name: 'Kasun Rajitha',         value: 0.75, note: 'SL pacer; limited IPL' },
  { name: 'David Payne',           value: 0.5,  note: 'ENG left-arm pacer; limited IPL' },
  { name: 'Josh Little',           value: 1.5,  note: 'Ireland left-arm; some IPL interest' },
  { name: 'Barry McCarthy',        value: 0.5,  note: 'Ireland pacer; limited IPL' },
  { name: 'Taskin Ahmed',          value: 2.5,  note: 'BGD pacer; some IPL history 2024' },
  { name: 'Mustafizur Rahman',     value: 2.5,  note: 'CSK 2022; cutters specialist' },
  { name: 'Shoriful Islam',        value: 0.75, note: 'BGD left-arm; limited IPL' },
  { name: 'Tanzim Hasan Sakib',    value: 1.0,  note: 'BGD pacer; young and quick' },
  { name: 'Mohammad Saifuddin',    value: 0.75, note: 'BGD AR pacer; limited IPL' },

  // ── OVERSEAS SPINNERS ─────────────────────────────────────────────────────────
  { name: 'Adam Zampa',            value: 2.4,  note: 'SRH 2025 ₹2.4Cr — in sold list; check' },
  { name: 'Maheesh Theekshana',    value: 4.4,  note: 'RR 2025 ₹4.4Cr — in sold list; check' },
  { name: 'Wanindu Hasaranga',     value: 5.25, note: 'RR 2025 ₹5.25Cr — in sold list; check' },
  { name: 'Mitchell Santner',      value: 2.0,  note: 'MI 2025 ₹2Cr — in sold list; check' },
  { name: 'Imad Wasim',            value: 1.5,  note: 'PAK spinner; visa concern' },
  { name: 'Shadab Khan',           value: 3.0,  note: 'PAK leg-spin AR; visa concern' },
  { name: 'Noor Ahmad',            value: 10.0, note: 'CSK 2025 ₹10Cr — in sold list; check' },
  { name: 'Mujeeb Ur Rahman',      value: 3.0,  note: 'Afghan mystery spinner; PBKS 2022' },
  { name: 'Rashid Khan',           value: 18.0, note: 'GT retained; world best leg-spinner' },
  { name: 'Naveen-ul-Haq',         value: 2.5,  note: 'Afghan pacer; quality' },
  { name: 'Prafull Matkar',        value: 0.4,  note: 'Domestic; limited exposure' },

  // ── INDIAN BATTERS ────────────────────────────────────────────────────────────
  { name: 'Prithvi Shaw',          value: 4.0,  note: 'DC 2022 ₹7.5Cr; inconsistent; unsold 2025' },
  { name: 'Manish Pandey',         value: 0.75, note: 'KKR 2025 ₹0.75Cr — in sold list; check' },
  { name: 'Ambati Rayudu',         value: 1.0,  note: 'Retired; if in pool — nostalgia only' },
  { name: 'Manan Vohra',           value: 0.5,  note: 'Fringe domestic' },
  { name: 'Shivam Dube',           value: 8.0,  note: 'CSK retained; valuable finisher' },
  { name: 'Suryakumar Yadav',      value: 20.0, note: 'MI retained; world T20 no.1 bat' },
  { name: 'Ruturaj Gaikwad',       value: 14.0, note: 'CSK retained; consistent top-order' },
  { name: 'Yashasvi Jaiswal',      value: 14.0, note: 'RR retained; explosive opener' },
  { name: 'Sanju Samson',          value: 14.0, note: 'RR retained; India wk-captain' },
  { name: 'Virat Kohli',           value: 21.0, note: 'RCB retained; India T20 GOAT' },
  { name: 'Rohit Sharma',          value: 16.0, note: 'MI retained; India captain' },
  { name: 'KL Rahul',              value: 14.0, note: 'DC 2025 ₹14Cr — in sold list; check' },
  { name: 'Faf du Plessis',        value: 2.0,  note: 'DC 2025 ₹2Cr — in sold list; check' },
  { name: 'Ajinkya Rahane',        value: 1.5,  note: 'KKR 2025 ₹1.5Cr — in sold list; check' },
  { name: 'Karun Nair',            value: 0.5,  note: 'DC 2025 ₹0.5Cr — in sold list; check' },
  { name: 'Rahul Tripathi',        value: 3.0,  note: 'CSK 2025 ₹3.4Cr — in sold list; check' },
  { name: 'Abhinav Manohar',       value: 3.0,  note: 'SRH 2025 ₹3.2Cr — in sold list; check' },
  { name: 'Devdutt Padikkal',      value: 2.0,  note: 'RCB 2025 ₹2Cr — in sold list; check' },
  { name: 'Sarfaraz Khan',         value: 6.0,  note: 'Domestic phenom; India call-ups' },
  { name: 'Tilak Varma',           value: 14.0, note: 'MI retained; India T20 regular' },
  { name: 'Dhruv Jurel',           value: 5.0,  note: 'RR 2024; India wk-bat rising' },
  { name: 'Rilee Rossouw',         value: 4.5,  note: 'PBKS 2024 ₹8Cr; overseas' },
  { name: 'Shreyas Iyer',          value: 26.75,note: 'PBKS 2025 ₹26.75Cr — in sold list' },
  { name: 'Sai Sudharsan',         value: 8.5,  note: 'GT retained; valuable Indian bat' },
  { name: 'Shubman Gill',          value: 16.5, note: 'GT retained; India future' },
  { name: 'Wriddhiman Saha',       value: 1.0,  note: 'Ageing Indian wk; fringe' },
  { name: 'Anmolpreet Singh',      value: 0.5,  note: 'Domestic fringe' },
  { name: 'Vivek Singh',           value: 2.0,  note: 'Young domestic bat; promising' },
  { name: 'Priyansh Arya',         value: 3.8,  note: 'PBKS 2025 ₹3.8Cr — in sold list; check' },
  { name: 'Vaibhav Suryavanshi',   value: 1.1,  note: 'RR 2025 ₹1.1Cr — in sold list; check' },
  { name: 'Riyan Parag',           value: 14.0, note: 'RR retained; India bat' },
  { name: 'B Sai Sudharsan',       value: 8.5,  note: 'GT retained' },
  { name: 'Rajat Patidar',         value: 11.0, note: 'RCB retained; consistent Indian bat' },

  // ── INDIAN WK-BATTERS ──────────────────────────────────────────────────────────
  { name: 'Dinesh Karthik',        value: 1.5,  note: 'Near-retired; finisher specialist' },
  { name: 'Wriddhiman Saha',       value: 0.75, note: 'Ageing; declining value' },
  { name: 'KS Bharat',             value: 1.5,  note: 'Domestic wk; India squad fringe' },
  { name: 'Ishan Kishan',          value: 11.25,note: 'SRH 2025 ₹11.25Cr — in sold list' },
  { name: 'Sanju Samson',          value: 14.0, note: 'RR retained' },
  { name: 'Dhruv Jurel',           value: 5.0,  note: 'Strong young wk-bat' },
  { name: 'Riyan Parag',           value: 14.0, note: 'RR retained; wk option' },
  { name: 'Tilak Varma',           value: 14.0, note: 'MI retained' },
  { name: 'Prabhsimran Singh',     value: 4.0,  note: 'PBKS history; aggressive opener-wk' },
  { name: 'Vishnu Vinod',          value: 0.95, note: 'PBKS 2025 ₹0.95Cr — in sold list; check' },
  { name: 'Anuj Rawat',            value: 0.3,  note: 'GT 2025 ₹0.3Cr — in sold list; check' },
  { name: 'Robin Minz',            value: 0.65, note: 'MI 2025 ₹0.65Cr — in sold list; check' },
  { name: 'Aryan Juyal',           value: 0.3,  note: 'LSG 2025 ₹0.3Cr — in sold list; check' },
  { name: 'Kumar Kushagra',        value: 0.65, note: 'GT 2025 ₹0.65Cr — in sold list; check' },
  { name: 'Luvnith Sisodia',       value: 0.3,  note: 'KKR 2025 ₹0.3Cr — in sold list; check' },

  // ── INDIAN ALL-ROUNDERS ────────────────────────────────────────────────────────
  { name: 'Hardik Pandya',         value: 16.35,note: 'MI retained ₹16.35Cr; India vice-captain' },
  { name: 'Venkatesh Iyer',        value: 23.75,note: 'KKR 2025 ₹23.75Cr — in sold list' },
  { name: 'Axar Patel',            value: 16.5, note: 'DC retained; India regular' },
  { name: 'Ravindra Jadeja',       value: 18.0, note: 'CSK retained; India legend' },
  { name: 'Krunal Pandya',         value: 5.75, note: 'RCB 2025 ₹5.75Cr — in sold list; check' },
  { name: 'Shivam Dube',           value: 8.0,  note: 'CSK retained' },
  { name: 'Abdul Samad',           value: 4.2,  note: 'LSG 2025 ₹4.2Cr — in sold list; check' },
  { name: 'Vijay Shankar',         value: 1.2,  note: 'CSK 2025 ₹1.2Cr — in sold list; check' },
  { name: 'Ashutosh Sharma',       value: 3.8,  note: 'DC 2025 ₹3.8Cr — in sold list; check' },
  { name: 'Nitish Rana',           value: 4.0,  note: 'RR 2025 ₹4.2Cr — in sold list; check' },
  { name: 'Washington Sundar',     value: 3.2,  note: 'GT 2025 ₹3.2Cr — in sold list; check' },
  { name: 'Shahbaz Ahmed',         value: 2.4,  note: 'LSG 2025 ₹2.4Cr — in sold list; check' },
  { name: 'Deepak Hooda',          value: 1.5,  note: 'CSK 2025 ₹1.7Cr — in sold list; check' },
  { name: 'Piyush Chawla',         value: 0.5,  note: 'Ageing spinner-AR; past prime' },
  { name: 'Shubman Gill',          value: 16.5, note: 'GT retained; doubles as AR context' },
  { name: 'Ravisrinivasan Sai Kishore', value: 1.5, note: 'Domestic; rising left-arm spinner' },
  { name: 'Sai Kishore',           value: 2.0,  note: 'GT 2025 ₹2Cr — in sold list; check' },
  { name: 'Naman Dhir',            value: 5.25, note: 'MI 2025 ₹5.25Cr — in sold list; check' },
  { name: 'Mahipal Lomror',        value: 1.7,  note: 'GT 2025 ₹1.7Cr — in sold list; check' },
  { name: 'Nehal Wadhera',         value: 4.0,  note: 'PBKS 2025 ₹4.2Cr — in sold list; check' },
  { name: 'Angkrish Raghuvanshi',  value: 3.0,  note: 'KKR 2025 ₹3Cr — in sold list; check' },
  { name: 'Deepak Chahar',         value: 9.25, note: 'MI 2025 ₹9.25Cr — in sold list; check' },
  { name: 'Harpreet Brar',         value: 1.5,  note: 'PBKS 2025 ₹1.5Cr — in sold list; check' },
  { name: 'Rishi Dhawan',          value: 0.5,  note: 'Domestic; ageing AR' },
  { name: 'Riyan Parag',           value: 14.0, note: 'RR retained' },
  { name: 'Manav Suthar',          value: 0.3,  note: 'GT 2025 ₹0.3Cr — in sold list' },
  { name: 'Nishant Sindhu',        value: 0.3,  note: 'GT 2025 ₹0.3Cr — in sold list' },
  { name: 'Anukul Roy',            value: 0.4,  note: 'KKR 2025 ₹0.4Cr — in sold list' },
  { name: 'Zeeshan Ansari',        value: 0.4,  note: 'SRH 2025 ₹0.4Cr — in sold list' },
  { name: 'Swapnil Singh',         value: 0.5,  note: 'RCB 2025 ₹0.5Cr — in sold list' },
  { name: 'Shaik Rasheed',         value: 0.3,  note: 'CSK 2025 ₹0.3Cr — in sold list' },
  { name: 'Nishant Sindhu',        value: 0.3,  note: 'GT 2025' },
  { name: 'Andre Siddarth',        value: 0.3,  note: 'CSK 2025 ₹0.3Cr — in sold list' },

  // ── INDIAN FAST BOWLERS ────────────────────────────────────────────────────────
  { name: 'Jasprit Bumrah',        value: 18.0, note: 'MI retained; world no.1 pacer' },
  { name: 'Mohammed Shami',        value: 10.0, note: 'SRH 2025 ₹10Cr — in sold list' },
  { name: 'Mohammed Siraj',        value: 12.25,note: 'GT 2025 ₹12.25Cr — in sold list' },
  { name: 'Arshdeep Singh',        value: 18.0, note: 'PBKS 2025 ₹18Cr — in sold list' },
  { name: 'Bhuvneshwar Kumar',     value: 10.75,note: 'RCB 2025 ₹10.75Cr — in sold list' },
  { name: 'T Natarajan',           value: 10.75,note: 'DC 2025 ₹10.75Cr — in sold list' },
  { name: 'Umesh Yadav',           value: 2.5,  note: 'GT 2024 ₹5.8Cr; ageing but still effective' },
  { name: 'Shardul Thakur',        value: 3.5,  note: 'CSK 2024 ₹4Cr; utility pace-AR' },
  { name: 'Ishant Sharma',         value: 0.75, note: 'GT 2025 ₹0.75Cr — in sold list' },
  { name: 'Prasidh Krishna',       value: 9.5,  note: 'GT 2025 ₹9.5Cr — in sold list' },
  { name: 'Akash Deep',            value: 8.0,  note: 'LSG 2025 ₹8Cr — in sold list' },
  { name: 'Avesh Khan',            value: 9.75, note: 'LSG 2025 ₹9.75Cr — in sold list' },
  { name: 'Harshal Patel',         value: 8.0,  note: 'SRH 2025 ₹8Cr — in sold list' },
  { name: 'Khaleel Ahmed',         value: 4.8,  note: 'CSK 2025 ₹4.8Cr — in sold list' },
  { name: 'Mukesh Kumar',          value: 8.0,  note: 'DC 2025 ₹8Cr — in sold list' },
  { name: 'Tushar Deshpande',      value: 6.5,  note: 'RR 2025 ₹6.5Cr — in sold list' },
  { name: 'Simarjeet Singh',       value: 1.5,  note: 'SRH 2025 ₹1.5Cr — in sold list' },
  { name: 'Yash Thakur',           value: 1.6,  note: 'PBKS 2025 ₹1.6Cr — in sold list' },
  { name: 'Vaibhav Arora',         value: 1.8,  note: 'KKR 2025 ₹1.8Cr — in sold list' },
  { name: 'Vijaykumar Vyshak',     value: 1.8,  note: 'PBKS 2025 ₹1.8Cr — in sold list' },
  { name: 'Akash Madhwal',         value: 1.2,  note: 'RR 2025 ₹1.2Cr — in sold list' },
  { name: 'Anshul Kamboj',         value: 3.4,  note: 'CSK 2025 ₹3.4Cr — in sold list' },
  { name: 'Mohit Sharma',          value: 2.2,  note: 'DC 2025 ₹2.2Cr — in sold list' },
  { name: 'Darshan Nalkande',      value: 0.3,  note: 'DC 2025 ₹0.3Cr — in sold list' },
  { name: 'Arshad Khan',           value: 1.3,  note: 'GT 2025 ₹1.3Cr — in sold list' },
  { name: 'Mukesh Choudhary',      value: 0.3,  note: 'CSK 2025 ₹0.3Cr — in sold list' },
  { name: 'Gurnoor Brar',          value: 1.3,  note: 'GT 2025 ₹1.3Cr — in sold list' },
  { name: 'Gurjapneet Singh',      value: 2.2,  note: 'CSK 2025 ₹2.2Cr — in sold list' },
  { name: 'Shivam Mavi',           value: 3.5,  note: 'LSG 2024 ₹6.4Cr; raw pace; young' },
  { name: 'Navdeep Saini',         value: 1.5,  note: 'Domestic pacer; inconsistent' },
  { name: 'Kuldeep Sen',           value: 0.8,  note: 'PBKS 2025 ₹0.8Cr — in sold list' },
  { name: 'Vidwath Kaverappa',     value: 1.5,  note: 'Domestic pacer; rising' },
  { name: 'Ravi Bishnoi',          value: 8.0,  note: 'LSG retained; India leg-spinner' },
  { name: 'Ashwani Kumar',         value: 0.3,  note: 'MI 2025 ₹0.3Cr — in sold list' },
  { name: 'Akash Singh',           value: 0.3,  note: 'LSG 2025 ₹0.3Cr — in sold list' },
  { name: 'Yudhvir Singh',         value: 0.35, note: 'RR 2025 ₹0.35Cr — in sold list' },
  { name: 'Rajvardhan Hangargekar', value: 0.3, note: 'LSG 2025 ₹0.3Cr — in sold list' },
  { name: 'Arshin Kulkarni',       value: 0.3,  note: 'LSG 2025 ₹0.3Cr — in sold list' },
  { name: 'Harnoor Singh',         value: 0.3,  note: 'PBKS 2025 ₹0.3Cr — in sold list' },
  { name: 'Manoj Bhandage',        value: 0.3,  note: 'RCB 2025 ₹0.3Cr — in sold list' },
  { name: 'Praveen Dubey',         value: 0.3,  note: 'PBKS 2025 ₹0.3Cr — in sold list' },
  { name: 'Ajay Mandal',           value: 0.3,  note: 'DC 2025 ₹0.3Cr — in sold list' },

  // ── INDIAN SPINNERS ─────────────────────────────────────────────────────────
  { name: 'Ravichandaran Ashwin',  value: 9.75, note: 'CSK 2025 ₹9.75Cr — in sold list' },
  { name: 'Yuzvendra Chahal',      value: 18.0, note: 'PBKS 2025 ₹18Cr — in sold list' },
  { name: 'Kuldeep Yadav',         value: 13.25,note: 'DC retained; India spin ace' },
  { name: 'Ravi Bishnoi',          value: 8.0,  note: 'LSG retained; strong leg-spinner' },
  { name: 'Axar Patel',            value: 16.5, note: 'DC retained; India all-format spinner-AR' },
  { name: 'Rahul Chahar',          value: 3.2,  note: 'SRH 2025 ₹3.2Cr — in sold list' },
  { name: 'Noor Ahmad',            value: 10.0, note: 'CSK 2025 ₹10Cr — in sold list' },
  { name: 'Varun Chakravarthy',    value: 12.0, note: 'KKR retained; mystery spinner' },
  { name: 'Suyash Sharma',         value: 2.6,  note: 'RCB 2025 ₹2.6Cr — in sold list' },
  { name: 'Karn Sharma',           value: 0.5,  note: 'MI 2025 ₹0.5Cr — in sold list' },
  { name: 'Kumar Kartikeya',       value: 0.3,  note: 'RR 2025 ₹0.3Cr — in sold list' },
  { name: 'Shreyas Gopal',         value: 0.3,  note: 'CSK 2025 ₹0.3Cr — in sold list' },
  { name: 'Mayank Markande',       value: 0.3,  note: 'KKR 2025 ₹0.3Cr — in sold list' },
  { name: 'Piyush Chawla',         value: 0.5,  note: 'Ageing; domestic fringe' },
  { name: 'Jayant Yadav',          value: 0.75, note: 'GT 2025 ₹0.75Cr — in sold list' },
  { name: 'Sai Kishore',           value: 2.0,  note: 'GT 2025 ₹2Cr — in sold list' },
  { name: 'Swastik Chikara',       value: 0.3,  note: 'RCB 2025 ₹0.3Cr — in sold list' },
  { name: 'Manimaran Siddharth',   value: 0.75, note: 'LSG 2025 ₹0.75Cr — in sold list' },
  { name: 'Tanvir Sangha',         value: 0.75, note: 'Australia leg-spinner; limited IPL' },
  { name: 'Himmat Singh',          value: 0.3,  note: 'LSG 2025 ₹0.3Cr — in sold list' },
  { name: 'Sachin Baby',           value: 0.3,  note: 'SRH 2025 ₹0.3Cr — in sold list' },
  { name: 'Swapnil Singh',         value: 0.5,  note: 'RCB 2025' },

  // ── MARQUEE / HIGH-VALUE PLAYERS (for context in unsold marquee pool) ─────────
  { name: 'Rishabh Pant',          value: 27.0, note: 'LSG 2025 ₹27Cr — in sold list' },
  { name: 'Shreyas Iyer',          value: 26.75,note: 'PBKS 2025 ₹26.75Cr — in sold list' },
  { name: 'Venkatesh Iyer',        value: 23.75,note: 'KKR 2025 ₹23.75Cr — in sold list' },
  { name: 'Arshdeep Singh',        value: 18.0, note: 'PBKS 2025 ₹18Cr — in sold list' },
  { name: 'Yuzvendra Chahal',      value: 18.0, note: 'PBKS 2025 ₹18Cr — in sold list' },
  { name: 'KL Rahul',              value: 14.0, note: 'DC 2025 ₹14Cr — in sold list' },

  // ── ADDITIONAL UNSOLD POOL PLAYERS WITH KNOWN HISTORICAL PRICES ──────────────
  { name: 'Shivam Mavi',           value: 3.5,  note: 'LSG 2024 ₹6.4Cr; unsold 2025' },
  { name: 'Umesh Yadav',           value: 2.5,  note: 'GT 2024 ₹5.8Cr; ageing but quality' },
  { name: 'Shardul Thakur',        value: 3.0,  note: 'CSK 2024 ₹4Cr; useful utility' },
  { name: 'Tom Curran',            value: 1.0,  note: 'RCB 2024 ₹1.5Cr; limited impact' },
  { name: 'Gus Atkinson',          value: 1.5,  note: 'KKR 2024 ₹1Cr; rising ENG pacer' },
  { name: 'Rilee Rossouw',         value: 4.5,  note: 'PBKS 2024 ₹8Cr; unsold 2025' },
  { name: 'Jonny Bairstow',        value: 4.5,  note: 'PBKS 2024 ₹6.75Cr; unsold 2025' },
  { name: 'Jason Holder',          value: 3.5,  note: 'SRH 2024 ₹4.6Cr; quality overseas AR' },
  { name: 'Mark Wood',             value: 5.0,  note: 'LSG 2024 ₹7.5Cr; injury history' },
  { name: 'Dilshan Madushanka',    value: 4.0,  note: 'MI 2024 ₹4.6Cr; left-arm pace' },
  { name: 'Tristan Stubbs',        value: 3.0,  note: 'SRH 2024 ₹5.8Cr; SA power-hitter' },
  { name: 'Alzarri Joseph',        value: 7.0,  note: 'RCB 2024 ₹11.5Cr; pace spearhead' },
  { name: 'Naveen-ul-Haq',         value: 2.5,  note: 'LSG 2023 ₹5.25Cr; Afghan quality pacer' },
  { name: 'Finn Allen',            value: 2.0,  note: 'RCB 2023; NZ aggressor' },
  { name: 'Alex Hales',            value: 3.0,  note: 'KKR 2023 mega; ENG T20 power' },
  { name: 'Nicholas Pooran',       value: 7.0,  note: 'LSG 2022 ₹10.75Cr; WI finisher' },
  { name: 'David Warner',          value: 4.5,  note: 'PBKS 2022 ₹6.25Cr; unsold 2025; ageing' },
  { name: 'Prithvi Shaw',          value: 3.5,  note: 'DC 2022 ₹7.5Cr; inconsistent since' },
  { name: 'Matheesha Pathirana',   value: 8.0,  note: 'CSK retained; high-value SL pacer' },
  { name: 'Heinrich Klaasen',      value: 10.0, note: 'SRH retained 2024; SA T20 power-hitter' },
  { name: 'Kyle Jamieson',         value: 3.5,  note: 'RCB 2021 ₹15Cr; injury-hit since' },
  { name: 'Shimron Hetmyer',       value: 3.0,  note: 'RR 2022 ₹8.5Cr; dangerous but injury-prone' },
  { name: 'Josh Little',           value: 1.5,  note: 'Ireland left-arm; some IPL interest' },
  { name: 'Haris Rauf',            value: 4.0,  note: 'MI 2022; express pace; PAK visa uncertainty' },
  { name: 'Naseem Shah',           value: 4.0,  note: 'Raw pace; PAK visa uncertainty' },
  { name: 'Shaheen Shah Afridi',   value: 5.0,  note: 'MI 2022 ₹9.25Cr; PAK visa uncertainty' },
  { name: 'Andre Russell',         value: 10.0, note: 'KKR historically retained; huge T20 draw' },
  { name: 'Ben Stokes',            value: 8.0,  note: 'CSK 2023 ₹16.25Cr; limited games; injuries' },
  { name: 'Mujeeb Ur Rahman',      value: 2.5,  note: 'PBKS 2022; Afghan mystery spinner' },
  { name: 'Shadab Khan',           value: 2.5,  note: 'PAK leg-spin AR; visa concern' },
  { name: 'Mustafizur Rahman',     value: 2.5,  note: 'CSK 2022; cutters master' },
  { name: 'Taskin Ahmed',          value: 2.0,  note: 'BGD pacer; 2024 auction listed' },
  { name: 'Jayden Seales',         value: 1.5,  note: 'WI young rapid pacer' },
  { name: 'Sam Billings',          value: 1.5,  note: 'CSK history; wk-bat utility' },
  { name: 'Sarfaraz Khan',         value: 6.0,  note: 'India Test regular; strong domestic record' },
  { name: 'Dhruv Jurel',           value: 5.0,  note: 'RR 2024; India rising wk-bat' },
  { name: 'Prabhsimran Singh',     value: 4.0,  note: 'PBKS history; aggressive opener' },
  { name: 'Vidwath Kaverappa',     value: 1.5,  note: 'Karnataka pacer; domestic star' },
  { name: 'Tanvir Sangha',         value: 0.75, note: 'Australia leg-spinner; limited IPL' },
]

// Manual name corrections (data name → dataset name)
const NAME_MAP = {
  'Ravichandaran Ashwin': 'Ravichandaran Ashwin',
  'Vaibhav Suryavanshi': 'Vaibhav Suryavanshi',
  'T Natarajan': 'T Natarajan',
  'Jake Fraser-McGurk': 'Jake Fraser-Mcgurk',
  'Rahmanullah Gurbaz': 'Rahmanulloh Gurbaz',
  'Rasikh Salam Dar': 'Rasikh Dar',
  'Ravisrinivasan Sai Kishore': 'Sai Kishore',
}

function norm(s) {
  return s.toLowerCase()
    .replace(/\./g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const dataset = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'))

// Only patch players NOT already in the sold/retained set
// Sold players already have finalPrice as their real market value
const pool = dataset.players.filter(p => p.auctionStatus !== 'sold')

let matchedCount = 0
let alreadySold = 0
let skippedDuplicate = 0
const unmatched = []
const matchLog = []

// Deduplicate HISTORICAL by name (take first occurrence per norm name)
const seen = new Set()
const deduped = []
for (const h of HISTORICAL) {
  const resolvedName = NAME_MAP[h.name] || h.name
  const key = norm(resolvedName)
  if (!seen.has(key)) {
    seen.add(key)
    deduped.push({ ...h, resolvedName })
  } else {
    skippedDuplicate++
  }
}

for (const h of deduped) {
  const sNorm = norm(h.resolvedName)

  // Check if this is actually a sold player (already has finalPrice)
  const soldPlayer = dataset.players.find(p => p.auctionStatus === 'sold' && norm(p.name) === sNorm)
  if (soldPlayer) {
    alreadySold++
    continue
  }

  // Try exact match in pool
  let found = pool.find(p => norm(p.name) === sNorm)

  // Try first+last name match only (no loose surname matching to prevent wrong matches)
  if (!found) {
    const parts = sNorm.split(' ')
    if (parts.length >= 2) {
      const firstName = parts[0]
      const lastName = parts[parts.length - 1]
      // Only match if BOTH first name starts AND last name match exactly
      found = pool.find(p => {
        const pn = norm(p.name).split(' ')
        return pn[0] === firstName && pn[pn.length - 1] === lastName
      }) ?? null
    }
  }

  if (found) {
    found.marketValue = h.value
    matchedCount++
    matchLog.push(`✓ ${h.name} → ${found.name} ₹${h.value}Cr`)
  } else {
    // Only report unmatched if the name looks like it should be in the dataset
    // (exclude players that are clearly in the sold list already)
    if (!h.note.includes('in sold list')) {
      unmatched.push(`${h.name} (${h.note})`)
    }
  }
}

fs.writeFileSync(DATA_PATH, JSON.stringify(dataset, null, 2))

console.log('\n=== MARKET VALUE PATCH RESULTS ===')
console.log(`Skipped duplicates in input:    ${skippedDuplicate}`)
console.log(`Already sold (skipped):         ${alreadySold}`)
console.log(`Matched & updated in pool:      ${matchedCount}`)

const withMV = dataset.players.filter(p => p.marketValue != null && p.auctionStatus !== 'sold')
console.log(`\nTotal POOL players with marketValue: ${withMV.length} / ${pool.length}`)

if (matchLog.length > 0) {
  console.log('\nPatched players:')
  matchLog.forEach(l => console.log('  ' + l))
}

if (unmatched.length > 0) {
  console.log('\nUnmatched (may not be in dataset):')
  unmatched.forEach(n => console.log('  ✗ ' + n))
}
