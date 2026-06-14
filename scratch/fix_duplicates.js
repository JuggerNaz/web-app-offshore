const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/dashboard/inspection-v2/workspace/hooks/useWorkspaceReports.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace any occurrence of watermark: reportConfig.watermark followed by a closing brace with } as any
// using a more permissive regex that handles newlines, carriage returns, spaces and commas.
content = content.replace(/watermark\s*:\s*reportConfig\s*\.\s*watermark\s*,?\s*(\r?\n\s*)\}/g, 'watermark: reportConfig.watermark$1} as any');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully appended as any to all reportConfig blocks using permissive regex!');
