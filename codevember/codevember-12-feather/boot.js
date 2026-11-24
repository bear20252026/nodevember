// The page's entry: the creature (main.js), or with ?lab the feather lab (lab.js), a bench
// of single feathers to work on their look.
if (new URLSearchParams(location.search).has('lab')) import('./lab.js');
else import('./main.js');
