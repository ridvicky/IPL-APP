/**
 * Batting position for players — used for squad composition and team affinity scoring.
 * Covers BAT, WK, and AR players who have a clear batting role.
 * Engine falls back to auctionSet inference for unlisted players.
 */
export const BATTING_POSITIONS: Record<string, 'opener' | 'middleOrder' | 'finisher'> = {
  // ── Openers / Top-order ───────────────────────────────────────────────────
  'virat-kohli':           'opener',
  'rohit-sharma':          'opener',
  'shubman-gill':          'opener',
  'yashasvi-jaiswal':      'opener',
  'travis-head':           'opener',
  'david-warner':          'opener',
  'jos-buttler':           'opener',
  'rishabh-pant':          'opener',
  'kl-rahul':              'opener',
  'ishan-kishan':          'opener',
  'phil-salt':             'opener',
  'quinton-de-kock':       'opener',
  'prithvi-shaw':          'opener',
  'abhishek-sharma':       'opener',
  'ruturaj-gaikwad':       'opener',
  'faf-du-plessis':        'opener',
  'jake-fraser-mcgurk':    'opener',
  'ryan-rickelton':        'opener',
  'priyansh-arya':         'opener',
  'venkatesh-iyer':        'opener',   // AR opener
  'sunil-narine':          'opener',   // AR opener
  'devdutt-padikkal':      'opener',
  'vaibhav-suryavanshi':   'opener',
  'angkrish-raghuvanshi':  'opener',
  'paul-stirling':         'opener',
  'jason-roy':             'opener',
  'tom-kohler-cadmore':    'opener',
  'matthew-short':         'opener',
  'will-jacks':            'opener',
  'naman-dhir':            'opener',
  'dhruv-jurel':           'opener',   // WK opener

  // ── Middle-order / Anchors ────────────────────────────────────────────────
  'shreyas-iyer':          'middleOrder',
  'sanju-samson':          'middleOrder',
  'tilak-varma':           'middleOrder',
  'rajat-patidar':         'middleOrder',
  'heinrich-klaasen':      'middleOrder',
  'axar-patel':            'middleOrder',   // AR middle
  'ravindra-jadeja':       'middleOrder',   // AR middle
  'ravichandaran-ashwin':  'middleOrder',   // AR middle
  'washington-sundar':     'middleOrder',   // AR middle
  'liam-livingstone':      'middleOrder',   // AR middle
  'david-miller':          'middleOrder',
  'krunal-pandya':         'middleOrder',   // AR middle
  'suryakumar-yadav':      'middleOrder',
  'shivam-dube':           'middleOrder',
  'riyan-parag':           'middleOrder',   // AR middle
  'deepak-hooda':          'middleOrder',
  'manish-pandey':         'middleOrder',
  'ambati-rayudu':         'middleOrder',
  'vijay-shankar':         'middleOrder',   // AR middle
  'mahipal-lomror':        'middleOrder',   // AR middle
  'abhinav-manohar':       'middleOrder',
  'shaik-rasheed':         'middleOrder',
  'nitish-rana':           'middleOrder',
  'rinku-singh':           'middleOrder',   // also finisher depending on context
  'nehal-wadhera':         'middleOrder',
  'suyash-sharma':         'middleOrder',
  'kumar-kushagra':        'middleOrder',   // WK middle

  // ── Finishers / Power hitters ──────────────────────────────────────────────
  'hardik-pandya':         'finisher',   // AR finisher
  'andre-russell':         'finisher',   // AR finisher
  'tim-david':             'finisher',
  'shardul-thakur':        'finisher',   // AR finisher
  'sam-curran':            'finisher',   // AR finisher
  'nitish-kumar-reddy':    'finisher',   // AR finisher
  'tristan-stubbs':        'finisher',
  'moeen-ali':             'finisher',   // AR finisher
  'mitchell-marsh':        'finisher',   // AR finisher
  'glenn-maxwell':         'finisher',   // AR finisher
  'jitesh-sharma':         'finisher',   // WK finisher
  'ms-dhoni':              'finisher',   // WK finisher (legend)
  'romario-shepherd':      'finisher',   // AR finisher
  'carlos-brathwaite':     'finisher',   // AR finisher
  'corey-anderson':        'finisher',   // AR finisher
  'dwayne-bravo':          'finisher',   // AR finisher
  'ben-stokes':            'finisher',   // AR finisher
  'jason-holder':          'finisher',   // AR finisher
  'cameron-green':         'finisher',   // AR finisher
  'marcus-stoinis':        'finisher',   // AR finisher
  'kieron-pollard':        'finisher',
  'abdul-samad':           'finisher',
  'ashutosh-sharma':       'finisher',
  'anshul-kamboj':         'finisher',
  'harnoor-pannu':         'finisher',
}
