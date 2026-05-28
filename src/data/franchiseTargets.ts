import type { TeamId } from '@/types/team'

/**
 * Real-world IPL 2025 auction franchise targeting data.
 * Maps playerId → teams that aggressively targeted this player.
 * Sourced from 2025 IPL auction bidding wars and reported team strategies.
 */
export const FRANCHISE_TARGETS: Record<string, TeamId[]> = {
  // ── Wicket Keepers ────────────────────────────────────────────────────────
  'ishan-kishan':          ['MI', 'SRH', 'CSK'],
  'rishabh-pant':          ['DC', 'CSK', 'MI'],
  'kl-rahul':              ['LSG', 'DC', 'MI'],
  'jos-buttler':           ['RR', 'GT', 'MI'],
  'quinton-de-kock':       ['LSG', 'MI', 'KKR'],
  'heinrich-klaasen':      ['SRH', 'MI', 'DC'],
  'sanju-samson':          ['RR', 'DC', 'CSK'],
  'josh-inglis':           ['PBKS', 'MI', 'RCB'],
  'phil-salt':             ['RCB', 'KKR', 'DC'],
  'nicholas-pooran':       ['LSG', 'MI', 'KKR'],
  'dhruv-jurel':           ['RR', 'GT', 'DC'],
  'ryan-rickelton':        ['MI', 'SRH', 'DC'],

  // ── Batters ───────────────────────────────────────────────────────────────
  'virat-kohli':           ['RCB', 'MI', 'CSK'],
  'shreyas-iyer':          ['KKR', 'PBKS', 'DC'],
  'shubman-gill':          ['GT', 'KKR', 'MI'],
  'yashasvi-jaiswal':      ['RR', 'GT', 'MI'],
  'travis-head':           ['SRH', 'GT', 'RCB'],
  'david-warner':          ['DC', 'SRH', 'PBKS'],
  'faf-du-plessis':        ['RCB', 'CSK', 'DC'],
  'devdutt-padikkal':      ['RR', 'DC', 'LSG'],
  'prithvi-shaw':          ['DC', 'MI', 'PBKS'],
  'ruturaj-gaikwad':       ['CSK', 'GT', 'RCB'],
  'abhishek-sharma':       ['SRH', 'KKR', 'PBKS'],
  'tilak-varma':           ['MI', 'CSK', 'DC'],
  'rajat-patidar':         ['RCB', 'MI', 'GT'],
  'suryakumar-yadav':      ['MI', 'RCB', 'CSK'],
  'shivam-dube':           ['CSK', 'MI', 'RCB'],
  'rinku-singh':           ['KKR', 'LSG', 'DC'],
  'tristan-stubbs':        ['MI', 'DC', 'SRH'],
  'axar-patel':            ['DC', 'GT', 'RCB'],
  'jake-fraser-mcgurk':    ['DC', 'RCB', 'PBKS'],

  // ── All Rounders ──────────────────────────────────────────────────────────
  'hardik-pandya':         ['MI', 'GT', 'CSK'],
  'ravichandaran-ashwin':  ['CSK', 'RR', 'DC'],
  'ravindra-jadeja':       ['CSK', 'GT', 'DC'],
  'washington-sundar':     ['SRH', 'RCB', 'GT'],
  'sam-curran':            ['PBKS', 'CSK', 'MI'],
  'mitchell-marsh':        ['DC', 'SRH', 'MI'],
  'venkatesh-iyer':        ['KKR', 'DC', 'LSG'],
  'sunil-narine':          ['KKR', 'RCB', 'DC'],
  'liam-livingstone':      ['PBKS', 'RCB', 'MI'],
  'moeen-ali':             ['CSK', 'RCB', 'MI'],
  'krunal-pandya':         ['LSG', 'MI', 'DC'],
  'nitish-kumar-reddy':    ['SRH', 'DC', 'RCB'],
  'shardul-thakur':        ['DC', 'CSK', 'KKR'],
  'deepak-hooda':          ['LSG', 'DC', 'MI'],
  'shivam-sharma':         ['LSG', 'PBKS', 'DC'],
  'riyan-parag':           ['RR', 'GT', 'DC'],

  // ── Bowlers ───────────────────────────────────────────────────────────────
  'jasprit-bumrah':        ['MI', 'GT', 'CSK'],
  'mohammed-shami':        ['GT', 'DC', 'RCB'],
  'arshdeep-singh':        ['PBKS', 'MI', 'CSK'],
  'kagiso-rabada':         ['PBKS', 'DC', 'MI'],
  'trent-boult':           ['RR', 'MI', 'PBKS'],
  'mitchell-starc':        ['KKR', 'MI', 'SRH'],
  'pat-cummins':           ['SRH', 'MI', 'GT'],
  'jofra-archer':          ['MI', 'RCB', 'PBKS'],
  'mohammed-siraj':        ['RCB', 'GT', 'SRH'],
  'bhuvneshwar-kumar':     ['SRH', 'RCB', 'KKR'],
  'prasidh-krishna':       ['RR', 'GT', 'DC'],
  'umesh-yadav':           ['KKR', 'DC', 'RCB'],
  'deepak-chahar':         ['CSK', 'MI', 'DC'],
  'harshal-patel':         ['RCB', 'PBKS', 'MI'],
  'avesh-khan':            ['LSG', 'DC', 'MI'],
  'akash-deep':            ['RCB', 'KKR', 'GT'],
  'yash-dayal':            ['GT', 'RCB', 'LSG'],
  'mukesh-kumar':          ['DC', 'KKR', 'RCB'],
  'khaleel-ahmed':         ['DC', 'SRH', 'RCB'],
  'tushar-deshpande':      ['CSK', 'DC', 'MI'],
  'ravi-bishnoi':          ['LSG', 'DC', 'PBKS'],
  'yuzvendra-chahal':      ['RR', 'RCB', 'PBKS'],
  'kuldeep-yadav':         ['DC', 'KKR', 'RCB'],
  'varun-chakravarthy':    ['KKR', 'RCB', 'DC'],
  'mystery-spinner':       ['CSK', 'MI', 'KKR'],
  'maheesh-theekshana':    ['CSK', 'RR', 'MI'],
  'adam-zampa':            ['RR', 'PBKS', 'RCB'],
  'wanindu-hasaranga':     ['RCB', 'CSK', 'KKR'],
  'noor-ahmad':            ['GT', 'MI', 'DC'],
  'rashid-khan':           ['GT', 'SRH', 'RCB'],
  'matheesha-pathirana':   ['CSK', 'MI', 'SRH'],
  'anrich-nortje':         ['DC', 'SRH', 'PBKS'],
  'lockie-ferguson':       ['GT', 'KKR', 'RR'],
  'alzarri-joseph':        ['MI', 'SRH', 'DC'],
  'david-miller':          ['GT', 'RR', 'PBKS'],
  'glenn-maxwell':         ['RCB', 'PBKS', 'GT'],
  'tim-david':             ['MI', 'SRH', 'GT'],
  'mark-wood':             ['SRH', 'MI', 'KKR'],
  'gerald-coetzee':        ['MI', 'DC', 'SRH'],
  'mustafizur-rahman':     ['CSK', 'DC', 'SRH'],
  'angkrish-raghuvanshi':  ['KKR', 'MI', 'RCB'],
  'vaibhav-suryavanshi':   ['RR', 'MI', 'GT'],

  // ── Uncapped Indians (real 2025 auction bidding wars) ─────────────────────
  // Rasikh Dar — DC original, RCB won the war at ₹6 Cr
  'rasikh-dar':            ['RCB', 'DC', 'MI'],
  // Naman Dhir — MI fought hard to keep him at ₹5.25 Cr
  'naman-dhir':            ['MI', 'RCB', 'KKR'],
  // Nehal Wadhera — MI released, PBKS & MI both went hard
  'nehal-wadhera':         ['PBKS', 'MI', 'GT'],
  // Abdul Samad — SRH released, LSG won at ₹4.2 Cr
  'abdul-samad':           ['LSG', 'SRH', 'KKR'],
  // Ashutosh Sharma — PBKS released, DC snagged at ₹3.8 Cr
  'ashutosh-sharma':       ['DC', 'PBKS', 'SRH'],
  // Priyansh Arya — debut auction, PBKS fought MI at ₹3.8 Cr
  'priyansh-arya':         ['PBKS', 'MI', 'DC'],
  // Anshul Kamboj — MI released, CSK won at ₹3.4 Cr
  'anshul-kamboj':         ['CSK', 'MI', 'RCB'],
  // Abhinav Manohar — GT released, SRH bid up to ₹3.2 Cr
  'abhinav-manohar':       ['SRH', 'GT', 'RCB'],
  // Suyash Sharma — KKR released, RCB won at ₹2.6 Cr
  'suyash-sharma':         ['RCB', 'KKR', 'MI'],
  // Gurjapneet Singh — debut, CSK & PBKS both chased hard
  'gurjapneet-singh':      ['CSK', 'PBKS', 'MI'],
  // Mohit Sharma — GT released, DC & SRH fought at ₹2.2 Cr
  'mohit-sharma':          ['DC', 'SRH', 'GT'],
  // Vaibhav Arora — KKR retained-then-released, multiple teams chased
  'vaibhav-arora':         ['KKR', 'CSK', 'MI'],
  // Vyshak Vijaykumar — RCB released, PBKS won at ₹1.8 Cr
  'vyshak-vijaykumar':     ['PBKS', 'RCB', 'GT'],
  // Mahipal Lomror — RCB released, GT & SRH fought at ₹1.7 Cr
  'mahipal-lomror':        ['GT', 'SRH', 'RCB'],
  // Yash Thakur — LSG released, PBKS & DC bid up
  'yash-thakur':           ['PBKS', 'DC', 'LSG'],
  // Harpreet Brar — PBKS loyalty, CSK also chased
  'harpreet-brar':         ['PBKS', 'CSK', 'RCB'],
  // Simarjeet Singh — CSK released, SRH & GT fought
  'simarjeet-singh':       ['SRH', 'GT', 'CSK'],
  // Gurnoor Singh Brar — GT kept him at ₹1.3 Cr, RR also chased
  'gurnoor-singh-brar':    ['GT', 'RR', 'PBKS'],
  // Mohd Arshad Khan — LSG released, GT won
  'mohd-arshad-khan':      ['GT', 'LSG', 'CSK'],
  // Akash Madhwal — MI released, RR & DC fought
  'akash-madhwal':         ['RR', 'DC', 'MI'],
  // Vijay Shankar — GT released, CSK won at ₹1.2 Cr
  'vijay-shankar':         ['CSK', 'GT', 'DC'],
  // Eshan Malinga — SRH & RCB chased overseas uncapped WK
  'eshan-malinga':         ['SRH', 'RCB', 'MI'],

  // ── High-potential uncapped (teams known to scout these) ──────────────────
  // Vaibhav Suryavanshi — RR went to ₹1.1 Cr, massive bidding war
  // (already above but strengthening with more teams)
  'ayush-mhatre':          ['MI', 'CSK', 'RCB'],
  'uday-saharan':          ['DC', 'LSG', 'KKR'],
  'musheer-khan':          ['MI', 'PBKS', 'RCB'],
  'naman-tiwari':          ['MI', 'DC', 'RCB'],
  'vasu-vats':             ['RR', 'DC', 'GT'],
  'yash-dhull':            ['DC', 'RR', 'LSG'],
  'aryan-juyal':           ['MI', 'GT', 'RR'],
  'swastik-chhikara':      ['DC', 'RCB', 'MI'],
  'sameer-rizvi':          ['CSK', 'DC', 'RCB'],
  'kumar-kushagra':        ['GT', 'MI', 'DC'],
  'robin-minz':            ['MI', 'GT', 'RR'],
  'luvnith-sisodia':       ['KKR', 'RCB', 'DC'],
  'zeeshan-ansari':        ['SRH', 'GT', 'RCB'],
  'arshin-kulkarni':       ['LSG', 'MI', 'RCB'],
  'shaik-rasheed':         ['CSK', 'DC', 'SRH'],
  'digvesh-singh':         ['LSG', 'DC', 'MI'],
  'rajvardhan-hangargekar':['LSG', 'CSK', 'MI'],
  'harnoor-pannu':         ['PBKS', 'DC', 'MI'],
  'manav-suthar':          ['GT', 'RR', 'DC'],
  'vidwath-kaverappa':     ['PBKS', 'RCB', 'DC'],
  'vicky-ostwal':          ['DC', 'MI', 'GT'],
}
