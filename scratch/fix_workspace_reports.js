const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/dashboard/inspection-v2/workspace/hooks/useWorkspaceReports.ts');
const content = fs.readFileSync(filePath, 'utf8');

// A robust parser that finds all curly-braced blocks that contain `watermark: reportConfig.watermark`
// and cleans up the duplicates inside, then appends `as any` at the end of the block.

let newContent = '';
let i = 0;
while (i < content.length) {
    if (content[i] === '{') {
        // Find the matching '}'
        let braceCount = 1;
        let start = i;
        let j = i + 1;
        while (j < content.length && braceCount > 0) {
            if (content[j] === '{') braceCount++;
            else if (content[j] === '}') braceCount--;
            j++;
        }
        
        let blockText = content.substring(start, j);
        if (blockText.includes('watermark: reportConfig.watermark')) {
            // This is a config block! Let's process it.
            let lines = blockText.split('\n');
            let cleanedLines = [];
            
            // To prevent duplicates, we keep track of what keys we have seen.
            // But we specifically want to prioritize the reportConfig variants and discard the static overrides.
            let seenPreparedBy = false;
            let seenReviewedBy = false;
            let seenApprovedBy = false;
            let seenWatermark = false;

            // We do a two-pass approach:
            // First, find if we have the reportConfig versions in the block.
            let hasConfigPrep = blockText.includes('preparedBy: reportConfig.preparedBy');
            let hasConfigRev = blockText.includes('reviewedBy: reportConfig.reviewedBy');
            let hasConfigApp = blockText.includes('approvedBy: reportConfig.approvedBy');
            let hasConfigWater = blockText.includes('watermark: reportConfig.watermark');

            for (let line of lines) {
                let trimmed = line.trim();
                if (trimmed.startsWith('preparedBy:')) {
                    if (trimmed.includes('reportConfig.preparedBy') && !seenPreparedBy) {
                        cleanedLines.push(line);
                        seenPreparedBy = true;
                    } else if (!hasConfigPrep && !seenPreparedBy) {
                        cleanedLines.push(line);
                        seenPreparedBy = true;
                    } else {
                        console.log('Discarding duplicate/static preparedBy line:', trimmed);
                    }
                } else if (trimmed.startsWith('reviewedBy:')) {
                    if (trimmed.includes('reportConfig.reviewedBy') && !seenReviewedBy) {
                        cleanedLines.push(line);
                        seenReviewedBy = true;
                    } else if (!hasConfigRev && !seenReviewedBy) {
                        cleanedLines.push(line);
                        seenReviewedBy = true;
                    } else {
                        console.log('Discarding duplicate/static reviewedBy line:', trimmed);
                    }
                } else if (trimmed.startsWith('approvedBy:')) {
                    if (trimmed.includes('reportConfig.approvedBy') && !seenApprovedBy) {
                        cleanedLines.push(line);
                        seenApprovedBy = true;
                    } else if (!hasConfigApp && !seenApprovedBy) {
                        cleanedLines.push(line);
                        seenApprovedBy = true;
                    } else {
                        console.log('Discarding duplicate/static approvedBy line:', trimmed);
                    }
                } else if (trimmed.startsWith('watermark:')) {
                    if (trimmed.includes('reportConfig.watermark') && !seenWatermark) {
                        cleanedLines.push(line);
                        seenWatermark = true;
                    } else if (!hasConfigWater && !seenWatermark) {
                        cleanedLines.push(line);
                        seenWatermark = true;
                    } else {
                        console.log('Discarding duplicate/static watermark line:', trimmed);
                    }
                } else {
                    cleanedLines.push(line);
                }
            }

            let newBlockText = cleanedLines.join('\n');
            // Check if it already has "as any" after it
            let remainingText = content.substring(j);
            let hasAsAny = remainingText.trim().startsWith('as any');
            if (!hasAsAny) {
                newBlockText = newBlockText + ' as any';
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
console.log('Successfully cleaned up useWorkspaceReports.ts config objects and cast to any!');
