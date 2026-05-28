/**
 * Bowling type for All-Rounder players.
 * The main dataset has bowlingType on BWL players but not on ARs.
 * This lookup fills the gap without touching the 600-player JSON.
 */
export const AR_BOWLING_TYPES: Record<string, 'pace' | 'spin'> = {
  // ── Pace All-Rounders ─────────────────────────────────────────────────────
  'hardik-pandya':          'pace',
  'mitchell-marsh':         'pace',
  'sam-curran':             'pace',
  'shardul-thakur':         'pace',
  'venkatesh-iyer':         'pace',
  'nitish-kumar-reddy':     'pace',
  'moeen-ali':              'pace',
  'liam-livingstone':       'pace',
  'andre-russell':          'pace',
  'shivam-dube':            'pace',
  'deepak-hooda':           'pace',
  'vijay-shankar':          'pace',
  'mark-wood':              'pace',
  'gerald-coetzee':         'pace',
  'pat-cummins':            'pace',
  'cameron-green':          'pace',
  'ben-stokes':             'pace',
  'jason-holder':           'pace',
  'dwayne-bravo':           'pace',
  'chris-woakes':           'pace',
  'hardus-viljoen':         'pace',
  'rishi-dhawan':           'pace',
  'shivam-sharma':          'pace',
  'anshul-kamboj':          'pace',
  'ashutosh-sharma':        'pace',
  'priyansh-arya':          'pace',
  'rinku-singh':            'pace',
  'tilak-varma':            'pace',
  'abhishek-sharma':        'pace',
  'tristan-stubbs':         'pace',
  'shivam-mavi':            'pace',
  'romario-shepherd':       'pace',
  'david-wiese':            'pace',
  'carlos-brathwaite':      'pace',
  'corey-anderson':         'pace',
  'tim-david':              'pace',
  'david-miller':           'pace',
  'marcus-stoinis':         'pace',

  // ── Spin All-Rounders ─────────────────────────────────────────────────────
  'ravichandaran-ashwin':   'spin',
  'ravindra-jadeja':        'spin',
  'axar-patel':             'spin',
  'sunil-narine':           'spin',
  'washington-sundar':      'spin',
  'krunal-pandya':          'spin',
  'riyan-parag':            'spin',
  'mahipal-lomror':         'spin',
  'shahbaz-ahmed':          'spin',
  'shreyas-iyer':           'spin',
  'manish-pandey':          'spin',
  'suyash-sharma':          'spin',
  'karn-sharma':            'spin',
  'iqbal-abdulla':          'spin',
  'harpreet-brar':          'spin',
  'pawan-negi':             'spin',
  'sherfane-rutherford':    'spin',
  'glenn-maxwell':          'spin',

  // ── Newly added — International ARs ──────────────────────────────────────
  'harshal-patel':          'pace',   // pace — signature slower balls
  'marco-jansen':           'pace',   // SA tall left-arm pace
  'gus-atkinson':           'pace',   // England pace all-rounder
  'tom-curran':             'pace',   // England pace all-rounder
  'brydon-carse':           'pace',   // Scotland/England pace all-rounder
  'aaron-hardie':           'pace',   // Australia pace all-rounder
  'kyle-mayers':            'pace',   // WI left-arm pace all-rounder
  'daniel-sams':            'pace',   // Australia left-arm pace
  'jimmy-neesham':          'pace',   // NZ left-arm pace all-rounder
  'william-sutherland':     'pace',   // Australia pace all-rounder
  'zak-foulkes':            'pace',   // England pace all-rounder
  'wiaan-mulder':           'pace',   // SA pace all-rounder
  'dwaine-pretorius':       'pace',   // SA pace all-rounder
  'junior-dala':            'pace',   // SA pace all-rounder
  'dominic-drakes':         'pace',   // WI pace all-rounder
  'matthew-forde':          'pace',   // WI pace all-rounder
  'odean-smith':            'pace',   // WI pace all-rounder
  'keemo-paul':             'pace',   // WI pace all-rounder
  'patrick-kruger':         'pace',   // SA pace all-rounder
  'michael-neser':          'pace',   // Australia pace all-rounder
  'corbin-bosch':           'pace',   // SA pace all-rounder
  'duan-jansen':            'pace',   // SA pace all-rounder
  'karim-janat':            'pace',   // Afghanistan pace all-rounder
  'gulbadin-naib':          'pace',   // Afghanistan pace all-rounder
  'nangeyalia-kharote':     'pace',   // Afghanistan pace all-rounder
  'azmatullah-omarzai':     'pace',   // Afghanistan pace all-rounder
  'daryl-mitchell':         'pace',   // NZ pace all-rounder
  'sean-abbott':            'pace',   // Australia pace all-rounder
  'jamie-overton':          'pace',   // England pace all-rounder
  'cooper-connolly':        'pace',   // Australia pace all-rounder
  'ben-howell':             'pace',   // England pace all-rounder
  'hilton-cartwright':      'pace',   // Australia pace all-rounder
  'nathan-smith':           'pace',   // NZ pace all-rounder
  'brandon-mcmullen':       'pace',   // Scotland pace all-rounder

  'nitish-rana':            'spin',   // left-arm spin, occasional
  'shahbaz-ahamad':         'spin',   // left-arm spin all-rounder
  'r-sai-kishore':          'spin',   // left-arm chinaman spinner
  'krishnappa-gowtham':     'spin',   // off-spin all-rounder
  'jayant-yadav':           'spin',   // off-spin all-rounder
  'rachin-ravindra':        'spin',   // left-arm spin + bat NZ
  'will-jacks':             'spin',   // off-spin + bat England
  'mohammad-nabi':          'spin',   // Afghanistan off-spin AR
  'sikandar-raza':          'spin',   // Zimbabwe off-spin AR
  'mitchell-santner':       'spin',   // NZ left-arm spin
  'jacob-bethell':          'spin',   // England left-arm spin + bat
  'kamindu-mendis':         'spin',   // Sri Lanka multi-spin + bat
  'matthew-short':          'spin',   // Australia off-spin + bat
  'qais-ahmad':             'spin',   // Afghanistan leg-spin + bat
  'charith-asalanka':       'spin',   // Sri Lanka left-arm spin + bat
  'michael-bracewell':      'spin',   // NZ off-spin + bat
  'gudakesh-motie':         'spin',   // WI left-arm spin
  'daniel-mousley':         'spin',   // England left-arm spin + bat
  'dunith-wellalage':       'spin',   // Sri Lanka left-arm spin
  'dushan-hemantha':        'spin',   // Sri Lanka off-spin
  'chris-green':            'spin',   // Australia off-spin
  'shakib-al-hasan':        'spin',   // Bangladesh left-arm spin
  'mehidy-hasan-miraz':     'spin',   // Bangladesh off-spin
  'dasun-shanaka':          'pace',   // Sri Lanka pace all-rounder
  'ashton-agar':            'spin',   // Australia left-arm spin
  'roston-chase':           'spin',   // WI off-spin all-rounder
  'mahedi-hasan':           'spin',   // Bangladesh off-spin
  'dan-lawrence':           'spin',   // England occasional off-spin + bat
  'alick-athanaze':         'spin',   // WI left-arm spin + bat
  'sarfaraz-khan':          'spin',   // occasional leg-spin (classified as bat-heavy AR)

  // ── Indian domestic ARs ───────────────────────────────────────────────────
  'naman-dhir':             'pace',   // PBKS — right-arm pace all-rounder
  'sameer-rizvi':           'pace',   // CSK — pace all-rounder
  'abdul-samad':            'pace',   // SRH — hard-hitting pace AR
  'nishant-sindhu':         'spin',   // DC — left-arm spin all-rounder
  'utkarsh-singh':          'pace',   // pace bowling, lower-order bat
  'mayank-dagar':           'spin',   // left-arm spin all-rounder
  'mohd-arshad-khan':       'pace',   // left-arm pace all-rounder
  'darshan-nalkande':       'pace',   // right-arm pace all-rounder
  'suyash-prabhudessai':    'pace',   // Goa — right-arm pace AR
  'anukul-roy':             'spin',   // left-arm spin all-rounder
  'swapnil-singh':          'spin',   // left-arm spin all-rounder
  'sanvir-singh':           'pace',   // right-arm pace all-rounder
  'yudhvir-charak':         'pace',   // left-arm pace all-rounder
  'rajvardhan-hangargekar': 'pace',   // Maharashtra — right-arm pace AR
  'tanush-kotian':          'spin',   // Mumbai — off-spin all-rounder
  'arshin-kulkarni':        'pace',   // left-arm pace all-rounder
  'shams-mulani':           'spin',   // Mumbai — left-arm spin
  'shivam-singh':           'pace',   // right-arm pace AR
  'lalit-yadav':            'spin',   // DC — off-spin all-rounder
  'manoj-bhandage':         'spin',   // Karnataka — off-spin AR
  'pravin-dubey':           'spin',   // left-arm spin all-rounder
  'ajay-mandal':            'spin',   // left-arm spin all-rounder
  'prerak-mankad':          'spin',   // left-arm spin all-rounder
  'vipraj-nigam':           'spin',   // off-spin all-rounder
  'vicky-ostwal':           'spin',   // left-arm chinaman spinner
  'shivalik-sharma':        'spin',   // left-arm spin all-rounder
  'raj-angad-bawa':         'pace',   // left-arm pace all-rounder (PBKS)
  'emanjot-chahal':         'spin',   // left-arm spin AR
  'musheer-khan':           'spin',   // left-arm spin + bat (Mumbai)
  'manvanth-kumar-l':       'pace',   // right-arm pace AR
  'mayank-rawat':           'pace',   // Uttarakhand pace all-rounder
  'suryansh-shedge':        'pace',   // right-arm pace AR
  'hritik-shokeen':         'spin',   // left-arm spin all-rounder (MI)
  'sonu-yadav':             'spin',   // off-spin all-rounder
  'abdul-bazith':           'pace',   // Kerala — right-arm pace AR
  'kc-cariappa':            'spin',   // leg-spin all-rounder (Karnataka)
  'yuvraj-chaudhary':       'pace',   // left-arm pace all-rounder
  'aman-khan':              'pace',   // left-arm pace AR
  'sumit-kumar':            'spin',   // left-arm spin all-rounder
  'kamlesh-nagarkoti':      'pace',   // right-arm pace all-rounder
  'hardik-raj':             'pace',   // right-arm pace AR
  'harsh-tyagi':            'pace',   // right-arm pace all-rounder
  'krish-bhagat':           'pace',   // right-arm pace AR
  'sohraab-dhaliwal':       'pace',   // left-arm pace AR
  'harsh-dubey':            'spin',   // right-arm off-spin AR
  'ramakrishna-ghosh':      'pace',   // right-arm pace AR
  'raj-limbani':            'pace',   // right-arm pace AR
  'ninad-rathva':           'pace',   // right-arm pace AR
  'vivrant-sharma':         'pace',   // right-arm pace AR (HP)
  'shiva-singh':            'spin',   // left-arm spin AR
  'nasir-lone':             'pace',   // J&K — right-arm pace AR
  's-midhun':               'pace',   // Kerala — right-arm pace AR
  'abid-mushtaq':           'spin',   // J&K — leg-spin AR
  'mahesh-pithiya':         'spin',   // left-arm spin AR
  'maramreddy-reddy':       'pace',   // Andhra — right-arm pace AR
  'atit-sheth':             'pace',   // Gujarat — right-arm pace AR
  'jonty-sidhu':            'pace',   // Punjab — right-arm pace AR
  'kartik-chadha':          'spin',   // left-arm spin AR
  'writtick-chatterjee':    'pace',   // Bengal — right-arm pace AR
  'prerit-dutta':           'pace',   // right-arm pace AR
  'rajneesh-gurbani':       'pace',   // MP — right-arm pace AR
  'shubhang-hegde':         'spin',   // Karnataka — off-spin AR
  'saransh-jain':           'spin',   // left-arm spin AR
  'ripal-patel':            'spin',   // Gujarat — off-spin AR
  'akash-vashisht':         'pace',   // HP — right-arm pace AR
  'ajay-ahlawat':           'pace',   // right-arm pace AR
  'mayank-gusain':          'pace',   // Uttarakhand — right-arm pace AR
  'mukhtar-hussain':        'pace',   // J&K — right-arm pace AR
  'girinath-reddy':         'pace',   // Andhra — right-arm pace AR
  'jalaj-saxena':           'spin',   // MP — off-spin all-rounder
  'yajas-sharma':           'pace',   // right-arm pace AR
  'sanjay-yadav':           'spin',   // left-arm spin AR
  'umang-kumar':            'pace',   // HP — right-arm pace AR
  'mohamed-ali':            'pace',   // right-arm pace AR
  'atharva-ankolekar':      'spin',   // left-arm spin AR (Mumbai)
  'vaisakh-chandran':       'pace',   // Kerala — right-arm pace AR
  'auqib-dar':              'pace',   // J&K — right-arm pace AR
  'rohit-rayudu':           'pace',   // right-arm pace AR
  'uday-saharan':           'spin',   // left-arm spin AR (Delhi)
  'ayush-vartak':           'pace',   // right-arm pace AR
  'baba-aparajith':         'spin',   // Tamil Nadu — off-spin AR
  'sumit-kumar-beniwal':    'pace',   // right-arm pace AR
  'nishunk-birla':          'pace',   // right-arm pace AR
  'digvijay-deshmukh':      'pace',   // right-arm pace AR
  'lakshay-jain':           'spin',   // left-arm spin AR
  'kritagya-singh':         'spin',   // leg-spin AR
  'p-vignesh':              'spin',   // Tamil Nadu — off-spin AR
  'sabhay-chadha':          'pace',   // right-arm pace AR
  'hemanth-kumar':          'pace',   // Karnataka — right-arm pace AR
  'rohan-rana':             'pace',   // right-arm pace AR
  'bharat-sharma':          'pace',   // right-arm pace AR
  'pratham-singh':          'spin',   // left-arm spin AR
  'tripurana-vijay':        'spin',   // Andhra — off-spin AR
  'ravi-yadav':             'spin',   // left-arm spin AR
  'arjun-azad':             'pace',   // right-arm pace AR
  'abhay-choudhary':        'pace',   // right-arm pace AR
  'gaurav-gambhir':         'spin',   // off-spin AR
  'shubham-garhwal':        'pace',   // right-arm pace AR
  'tejasvi-jaiswal':        'pace',   // right-arm pace AR
  'sairaj-patil':           'spin',   // left-arm spin AR (Maharashtra)
  'madhav-tiwari':          'pace',   // right-arm pace AR
  'kamal-tripathi':         'spin',   // off-spin AR
  'prashant-chauhan':       'pace',   // HP — right-arm pace AR
  'yash-dabas':             'pace',   // right-arm pace AR
  'dhruv-kaushik':          'pace',   // right-arm pace AR
  'khrievitso-kense':       'pace',   // Nagaland — right-arm pace AR
  'akash-parkar':           'pace',   // right-arm pace AR
  'vignesh-puthur':         'spin',   // left-arm spin AR
  'tripuresh-singh':        'pace',   // right-arm pace AR
  'vijay-yadav':            'spin',   // leg-spin AR
}
