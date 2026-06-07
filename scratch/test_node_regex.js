const r = /(?:scour\s+)?(?:at\s+)?(?:leg|node|location)\s*[:\-]?\s*([A-Za-z0-9\-\/]+)/i;
const tests = [
  'SCOUR AT LEG: A1',
  'AT NODE: 101A',
  'NODE: 203B',
  'SCOUR AT NODE N5',
  'LOCATION: D4',
  'LEG: A1-B2',
  'AT NODE: 101A; SCOUR DEPTH: 200mm',
  'SCOUR AT NODE: N1; DEPTH: 150mm; PILE NOT EXPOSED',
];
tests.forEach(t => {
  const m = t.match(r);
  const isNode = m ? m[0].toLowerCase().includes('node') : false;
  const prefix = isNode ? 'At Node' : 'At Leg';
  console.log(`"${t}" -> ${m ? prefix + ': ' + m[1].toUpperCase() : '(no match)'}`);
});
