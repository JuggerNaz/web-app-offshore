const fs = require('fs');
const path = require('path');

const transparencyCode = `
        try {
            const imageData = ctx.getImageData(0, 0, img.width, img.height);
            const data = imageData.data;
            const width = img.width;
            const height = img.height;
            
            const isWhite = (i) => data[i] > 230 && data[i+1] > 230 && data[i+2] > 230 && data[i+3] > 0;
            
            const stack = [];
            const visited = new Uint8Array(width * height);
            
            const pushIfWhite = (x, y) => {
                if (x < 0 || x >= width || y < 0 || y >= height) return;
                const idx = y * width + x;
                if (!visited[idx]) {
                    const p = idx * 4;
                    if (isWhite(p)) {
                        visited[idx] = 1;
                        stack.push({x, y});
                    }
                }
            };
            
            for (let x = 0; x < width; x++) { pushIfWhite(x, 0); pushIfWhite(x, height - 1); }
            for (let y = 0; y < height; y++) { pushIfWhite(0, y); pushIfWhite(width - 1, y); }
            
            while (stack.length > 0) {
                const pt = stack.pop();
                if (!pt) continue;
                const {x, y} = pt;
                const p = (y * width + x) * 4;
                data[p + 3] = 0; 
                
                pushIfWhite(x + 1, y);
                pushIfWhite(x - 1, y);
                pushIfWhite(x, y + 1);
                pushIfWhite(x, y - 1);
            }
            
            // Edge smoothing
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const p = (y * width + x) * 4;
                    if (data[p + 3] !== 0) {
                        const hasTransparentNeighbor = 
                            data[((y)*width + x - 1)*4 + 3] === 0 ||
                            data[((y)*width + x + 1)*4 + 3] === 0 ||
                            data[((y - 1)*width + x)*4 + 3] === 0 ||
                            data[((y + 1)*width + x)*4 + 3] === 0;
                        if (hasTransparentNeighbor) {
                            const avgColor = (data[p] + data[p+1] + data[p+2]) / 3;
                            if (avgColor > 200) {
                                data[p+3] = Math.max(0, 255 - (avgColor - 180) * 3); 
                            }
                        }
                    }
                }
            }
            ctx.putImageData(imageData, 0, 0);
        } catch(e) { console.error("Canvas transparency error", e); }
`;

function processDir(dirPath) {
    const files = fs.readdirSync(dirPath);
    for (const f of files) {
        if (f.endsWith('.ts')) {
            const filePath = path.join(dirPath, f);
            let content = fs.readFileSync(filePath, 'utf8');

            if (content.includes('getImageData')) {
                continue;
            }
            // In pdf-generator we have loadLogo and loadImage.
            // Let's target ONLY 'loadLogo' or 'loadImage' if it returns image/png
            // Actually, we can check if it returns canvas.toDataURL("image/png")
            // Because only logos use png. Photos use jpeg (defect photos, inspection photos).
            // This is perfect!

            if (content.includes('ctx.drawImage(img, 0, 0)')) {
                // If the function returns image/png, inject transparency
                // Let's do a precise string replacement.
                // Because some files have multiple drawImage calls.
                // We'll replace it inside functions where it's image/png.

                // Let's split by 'ctx.drawImage(img, 0, 0);'
                const parts = content.split('ctx.drawImage(img, 0, 0);');
                let newContent = parts[0];
                let modified = false;

                for (let i = 1; i < parts.length; i++) {
                    const afterText = parts[i];
                    // check if the block uses 'image/png' within a few lines
                    if (afterText.substring(0, 300).includes('image/png')) {
                        newContent += 'ctx.drawImage(img, 0, 0);\n' + transparencyCode + afterText;
                        modified = true;
                    } else {
                        // don't apply to image/jpeg (which doesn't support transparency anyway, and we don't want to corrupt real photos)
                        newContent += 'ctx.drawImage(img, 0, 0);' + afterText;
                    }
                }

                if (modified) {
                    fs.writeFileSync(filePath, newContent, 'utf8');
                    console.log("Updated", f);
                }
            }
        }
    }
}

processDir(path.join(__dirname, 'utils', 'report-generators'));
processDir(path.join(__dirname, 'utils'));
