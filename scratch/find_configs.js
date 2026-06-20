const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../utils/report-generators');
const files = fs.readdirSync(dir);

for (const file of files) {
    if (!file.endsWith('.ts') || file === 'shared-logo.ts') continue;
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes('interface ReportConfig') || content.includes('type ReportConfig')) {
        console.log(`Found ReportConfig in: ${file}`);
    }
}
