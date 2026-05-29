const densityRegex = new RegExp("density(?:\\s*value)?(?:\\s*:|\\s)?\\s*([0-9]+(?:\\.[0-9]+)?)\\b", "i");

const testComments = [
  "DENSITY: 1.025 g/cm3; other comment text here",
  "flooded; density value: 1.03; test point 1",
  "density 1.05; dry",
  "FMD test completed. density:1.02",
  "no density value here, member is dry"
];

testComments.forEach(tc => {
  const match = tc.match(densityRegex);
  if (match) {
    const val = parseFloat(match[1]);
    // Cut the matched portion out of the comment
    const cutText = tc.replace(match[0], "").trim();
    console.log(`Original: "${tc}"`);
    console.log(`Parsed density: ${val}`);
    console.log(`Cleaned comment (Cut): "${cutText}"\n`);
  } else {
    console.log(`Original: "${tc}" -> No match\n`);
  }
});
