const fs = require('fs');
const content = fs.readFileSync('app/dashboard/utilities/migration/page.tsx', 'utf8');

const lines = content.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('handleSelectInspectionMapping') || l.includes('SelectInspection')) {
    console.log(`Line ${idx+1}:`, l.trim());
  }
});
