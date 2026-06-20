const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/dashboard/inspection-v2/workspace/hooks/useWorkspaceReports.ts');
let content = fs.readFileSync(filePath, 'utf8');

// We want to find the config blocks. They typically have:
// showSignatures: showSignatures ?? reportConfig.showSignatures
// Let's replace the whole showSignatures line or inject the missing properties right after it.

// Let's inspect the matches.
// We can search for `showSignatures: showSignatures ?? reportConfig.showSignatures`
// and replace it with:
// `showSignatures: showSignatures ?? reportConfig.showSignatures,` +
// `preparedBy: reportConfig.preparedBy,` +
// `reviewedBy: reportConfig.reviewedBy,` +
// `approvedBy: reportConfig.approvedBy,` +
// `watermark: reportConfig.watermark`
// AND then we want to make sure the closing brace of that block has `as any`.
// To find the closing brace after our match:
// Since our match is inside a curly braced block, the very next `}` (excluding nested ones) will close the block.
// Let's write a robust parser for this!

let newContent = '';
let i = 0;
while (i < content.length) {
    const targetStr = 'showSignatures: showSignatures ?? reportConfig.showSignatures';
    if (content.substring(i, i + targetStr.length) === targetStr) {
        // We found the target. Let's find the closing brace that finishes this block.
        // We need to trace forward, maintaining a brace count of the outer context.
        // Let's first insert the new fields.
        let insertion = `${targetStr},\n                preparedBy: reportConfig.preparedBy,\n                reviewedBy: reportConfig.reviewedBy,\n                approvedBy: reportConfig.approvedBy,\n                watermark: reportConfig.watermark`;
        
        // Now, let's find the closing brace of the current block.
        // Since we are inside a block, we can look for the next `}` that is at the same nesting level.
        // Let's scan forward from `i + targetStr.length` to find the matching `}`.
        let braceCount = 1; // we assume we are inside at least one brace.
        let j = i + targetStr.length;
        while (j < content.length && braceCount > 0) {
            if (content[j] === '{') braceCount++;
            else if (content[j] === '}') {
                braceCount--;
                if (braceCount === 0) {
                    break;
                }
            }
            j++;
        }
        
        // We will replace the target and append `as any` to the closing brace.
        // The block text from i to j:
        let restOfBlock = content.substring(i + targetStr.length, j);
        let blockEnd = content[j]; // this is '}'
        
        let hasAsAny = content.substring(j + 1).trim().startsWith('as any');
        let suffix = hasAsAny ? '' : ' as any';
        
        newContent += insertion + restOfBlock + blockEnd + suffix;
        i = j + 1;
    } else {
        newContent += content[i];
        i++;
    }
}

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully injected config options and cast to any!');
