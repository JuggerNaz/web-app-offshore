const fs = require('fs');
const lines = fs.readFileSync('app/dashboard/settings/defect-criteria/page.tsx', 'utf8').split('\n');
lines.forEach((line, idx) => {
  if (line.includes('const [ruleForm') || line.includes('ruleForm,') || line.includes('resetRuleForm') || line.includes('handleEditRule')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
