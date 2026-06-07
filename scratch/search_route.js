const fs = require('fs');
const content = fs.readFileSync('app/api/migration/execute/route.ts', 'utf8');
const lines = content.split('\n');

const terms = [
  'Phase 5', 'Phase 4', 'Phase 3', 'Phase 2', 'Phase 1', 'Phase 6',
  'ANOMALY', 'anomaly', 'u_defect', 'dft_',
  'PLATGI', 'GVINS', 'CVINS', 'defect_type',
  'defect_category_code', 'priority_code', 'defect_type_code',
  'is_rectified', 'rectified_remarks', 'rectified_Date', 'rectified_date',
  'insp_anomalies', 'rectifid', 'RECTIFID', 'RECT_DATE', 'RECTIFID_DESC',
  'Approv_by', 'reviewed_by', 'eval_by', 'approved_by',
  'insp_cond', 'findings', 'Findings', 'comments'
];

lines.forEach((line, idx) => {
  terms.forEach(term => {
    if (line.includes(term)) {
      console.log(`Line ${idx+1} [${term}]: ${line.trim()}`);
    }
  });
});
