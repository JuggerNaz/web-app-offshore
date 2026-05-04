const fs = require('fs');
const content = fs.readFileSync('app/dashboard/inspection-v2/workspace/page.tsx', 'utf8');

const stack = [];
const tagRegex = /<(\/?[a-zA-Z0-9]+)(\s[^>]*?)?(\/?)>/g;
let match;

while ((match = tagRegex.exec(content)) !== null) {
    const fullTag = match[0];
    const tagName = match[1];
    const selfClosing = match[3] === '/';

    if (selfClosing || ['img', 'br', 'hr', 'input', 'link', 'meta'].includes(tagName.toLowerCase())) {
        continue;
    }

    if (tagName.startsWith('/')) {
        const openingTag = tagName.substring(1);
        if (stack.length === 0) {
            console.log(`Closing tag </${openingTag}> found with no opening tag at index ${match.index}`);
        } else {
            const last = stack.pop();
            if (last.name !== openingTag) {
                console.log(`Tag mismatch: opened <${last.name}> (index ${last.index}), closed </${openingTag}> (index ${match.index})`);
            }
        }
    } else {
        stack.push({ name: tagName, index: match.index });
    }
}

while (stack.length > 0) {
    const tag = stack.pop();
    console.log(`Unclosed tag <${tag.name}> at index ${tag.index}`);
}
