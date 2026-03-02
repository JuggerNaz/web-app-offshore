const fs = require('fs');

let c1 = fs.readFileSync('utils/report-generators/inspection-report.ts', 'utf8');
c1 = c1.replace(
    /const\s+imgData\s*=\s*await\s+loadImage\(\s*url\s*\);\s*doc\.addImage\(\s*imgData,\s*['"]JPEG['"],/g,
    "const imgData = await loadImage(url);\n                    if (imgData) doc.addImage(imgData.data, 'JPEG',"
);
fs.writeFileSync('utils/report-generators/inspection-report.ts', c1);

let c2 = fs.readFileSync('utils/report-generators/defect-anomaly-report.ts', 'utf8');
c2 = c2.replace(
    /processedImages\.push\(\{\s*data,\s*att:\s*\{\s*\.\.\.att,\s*meta\s*\}\s*\}\);/g,
    "processedImages.push({ data: data.data, att: { ...att, meta } });"
);
fs.writeFileSync('utils/report-generators/defect-anomaly-report.ts', c2);
