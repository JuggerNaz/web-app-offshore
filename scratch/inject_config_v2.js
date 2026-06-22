const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/dashboard/inspection-v2/workspace/hooks/useWorkspaceReports.ts');
const content = fs.readFileSync(filePath, 'utf8');

let newContent = '';
let i = 0;
while (i < content.length) {
    if (content[i] === '{') {
        // Find matching brace, correctly handling nested ones
        let braceCount = 1;
        let start = i;
        let j = i + 1;
        while (j < content.length && braceCount > 0) {
            if (content[j] === '{') braceCount++;
            else if (content[j] === '}') braceCount--;
            j++;
        }
        
        let blockText = content.substring(start, j);
        
        // Exclude function bodies, try blocks, etc. by checking for statements like return, await, const, let
        const isConfigBlock = blockText.includes('printFriendly') && 
                              (blockText.includes('sowReportNo') || blockText.includes('jobPackId') || blockText.includes('reportNoPrefix') || blockText.includes('returnBlob')) &&
                              !blockText.includes('const ') &&
                              !blockText.includes('let ') &&
                              !blockText.includes('return ') &&
                              !blockText.includes('await ') &&
                              !blockText.includes('if (') &&
                              !blockText.includes('if ') &&
                              !blockText.includes('for ');

        if (isConfigBlock) {
            // Remove outer braces to get inner content
            let innerText = blockText.trim();
            if (innerText.startsWith('{')) innerText = innerText.substring(1);
            if (innerText.endsWith('}')) innerText = innerText.substring(0, innerText.length - 1);
            
            // Format into a multi-line string by replacing top-level commas with newlines
            let formattedText = '{\n';
            let depth = 0;
            for (let char of innerText) {
                if (char === '{') depth++;
                else if (char === '}') depth--;
                
                if (char === ',' && depth === 0) {
                    formattedText += ',\n';
                } else {
                    formattedText += char;
                }
            }
            formattedText += '\n}';

            let lines = formattedText.split('\n');
            let cleanedLines = [];
            
            // Remove existing signatory/watermark properties to avoid duplicates
            for (let line of lines) {
                let trimmed = line.trim();
                if (trimmed.startsWith('preparedBy:') || 
                    trimmed.startsWith('reviewedBy:') || 
                    trimmed.startsWith('approvedBy:') || 
                    trimmed.startsWith('watermark:') ||
                    trimmed.startsWith('showSignatures:')) {
                    // Skip existing properties
                    continue;
                }
                cleanedLines.push(line);
            }
            
            // Inject the new unified reportConfig properties
            // Since we formatted it, the last line is guaranteed to be '}' on its own line
            if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1].trim() === '}') {
                // Ensure the preceding line has a comma
                let lastPropIdx = cleanedLines.length - 2;
                while (lastPropIdx >= 0 && cleanedLines[lastPropIdx].trim() === '') {
                    lastPropIdx--;
                }
                if (lastPropIdx >= 0) {
                    let lastPropLine = cleanedLines[lastPropIdx];
                    if (!lastPropLine.trim().endsWith(',')) {
                        let match = lastPropLine.match(/^(\s*)/);
                        let indent = match ? match[1] : '';
                        cleanedLines[lastPropIdx] = indent + lastPropLine.trim() + ',';
                    }
                }

                // Determine if we had showSignatures originally
                const blockHadShowSignatures = blockText.includes('showSignatures');
                const sigLine = blockHadShowSignatures 
                    ? '                showSignatures: showSignatures ?? reportConfig.showSignatures,'
                    : '                showSignatures: reportConfig.showSignatures,';

                cleanedLines.splice(cleanedLines.length - 1, 0, 
                    sigLine,
                    '                preparedBy: reportConfig.preparedBy,',
                    '                reviewedBy: reportConfig.reviewedBy,',
                    '                approvedBy: reportConfig.approvedBy,',
                    '                watermark: reportConfig.watermark'
                );
            }
            
            let newBlockText = cleanedLines.join('\n');
            
            // Append " as any" if not already present
            let remainingText = content.substring(j);
            if (!remainingText.trim().startsWith('as any')) {
                if (newBlockText.trim().endsWith('};')) {
                    newBlockText = newBlockText.replace(/\};\s*$/, '} as any;');
                } else if (newBlockText.trim().endsWith('}')) {
                    newBlockText = newBlockText + ' as any';
                }
            }
            
            newContent += newBlockText;
            i = j;
        } else {
            newContent += '{';
            i++;
        }
    } else {
        newContent += content[i];
        i++;
    }
}

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Injected unified reportConfig options and cast to any in all config blocks!');
