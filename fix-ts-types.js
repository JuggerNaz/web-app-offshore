const fs = require('fs');
const path = require('path');

function processDir(dirPath) {
    const files = fs.readdirSync(dirPath);
    for (const f of files) {
        if (f.endsWith('.ts')) {
            const filePath = path.join(dirPath, f);
            let content = fs.readFileSync(filePath, 'utf8');

            let original = content;

            content = content.replace(/const isWhite = \(i\) =>/g, "const isWhite = (i: number) =>");
            content = content.replace(/const stack = \[\];/g, "const stack: {x: number, y: number}[] = [];");
            content = content.replace(/const pushIfWhite = \(x, y\) =>/g, "const pushIfWhite = (x: number, y: number) =>");

            if (content !== original) {
                fs.writeFileSync(filePath, content, 'utf8');
                console.log("Fixed types in", f);
            }
        }
    }
}

processDir(path.join(__dirname, 'utils', 'report-generators'));
processDir(path.join(__dirname, 'utils'));
