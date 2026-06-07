const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'utils', 'types', 'inspection-types.json');
const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

const rfmd = content.inspectionTypes.find(t => t.code === 'RFMD');
if (rfmd) {
  console.log(JSON.stringify(rfmd, null, 2));
} else {
  console.log("RFMD not found in inspectionTypes");
}
