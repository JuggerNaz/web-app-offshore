// Condition Mapper Test Simulation Suite

// Mock libDescMap for case normalization
const libDescMap = new Map([
  ["good", "Good"],
  ["satisfactory", "Satisfactory"],
  ["poor", "Poor"],
  ["fair", "Fair"],
  ["debris present", "Debris Present"],
  ["not inspected", "Not Inspected"]
]);

const simulateConditionMapping = (rowObj, isRov) => {
  const inspectionDataObj = {};

  // Copy COMP_COND to component_condition if present
  const compCondVal = rowObj.COMP_COND !== undefined && rowObj.COMP_COND !== null ? String(rowObj.COMP_COND).trim() : null;
  if (compCondVal) {
    let normalizedVal = compCondVal;
    if (isRov) {
      const trimmedLower = compCondVal.toLowerCase();
      if (libDescMap.has(trimmedLower)) {
        normalizedVal = libDescMap.get(trimmedLower);
      }
    }
    inspectionDataObj.component_condition = normalizedVal;
  }

  // Copy COAT_COND to coating_condition if present
  const coatCondVal = rowObj.COAT_COND !== undefined && rowObj.COAT_COND !== null ? String(rowObj.COAT_COND).trim() : null;
  if (coatCondVal) {
    let normalizedVal = coatCondVal;
    if (isRov) {
      const trimmedLower = coatCondVal.toLowerCase();
      if (libDescMap.has(trimmedLower)) {
        normalizedVal = libDescMap.get(trimmedLower);
      }
    }
    inspectionDataObj.coating_condition = normalizedVal;
  }

  return inspectionDataObj;
};

const testCases = [
  { COMP_COND: "good", COAT_COND: "satisfactory", isRov: true },
  { COMP_COND: "poor", COAT_COND: "poor", isRov: true },
  { COMP_COND: "GOOD", COAT_COND: "SATISFACTORY", isRov: true },
  { COMP_COND: "unknown condition", COAT_COND: "undamaged", isRov: true },
  { COMP_COND: null, COAT_COND: "fair", isRov: true },
  { COMP_COND: "good", COAT_COND: null, isRov: true }
];

console.log("=== RUNNING CONDITION MIGRATION PARSER SIMULATION ===");
testCases.forEach((tc, idx) => {
  console.log(`\nTest Case #${idx + 1}:`);
  console.log(`Input - COMP_COND: "${tc.COMP_COND}", COAT_COND: "${tc.COAT_COND}"`);
  const res = simulateConditionMapping(tc, tc.isRov);
  console.log("Resulting Inspection Data:", JSON.stringify(res, null, 2));
});
