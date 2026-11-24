// The page's entry: the sea floor to draw kelp on (main.js), or with ?lab the kelp lab
// (lab.js), the kinds of kelp side by side, each named.
if (new URLSearchParams(location.search).has('lab')) import('./lab.js');
else import('./main.js');
