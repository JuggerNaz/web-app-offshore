const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'utils', 'report-generators');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

const newLoadImage = `
const loadImage = (url: string): Promise<{ data: string; width: number; height: number; } | null> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = url;
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                resolve({ data: canvas.toDataURL("image/png"), width: img.width, height: img.height });
            } else {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
    });
};

const drawLogo = (doc: any, logo: any, maxW: number, maxH: number, x: number, y: number, alignX = 'left', alignY = 'center') => {
    if (!logo || !logo.data) return;
    const ratio = Math.min(maxW / logo.width, maxH / logo.height);
    const w = logo.width * ratio;
    const h = logo.height * ratio;
    let dx = x;
    let dy = y;
    if (alignX === 'right') dx = x + maxW - w;
    if (alignX === 'center') dx = x + (maxW - w) / 2;
    if (alignY === 'center') dy = y + (maxH - h) / 2;
    if (alignY === 'bottom') dy = y + maxH - h;
    doc.addImage(logo.data, 'PNG', dx, dy, w, h);
};
`;

const replaceLoadImageRegex = /const\s+loadImage\s*=\s*\([^)]*\)\s*:\s*Promise<[^>]+>\s*=>\s*\{[\s\S]*?\}\);\s*\};/m;

for (const file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    if (content.includes("drawLogo = (doc: any")) {
        console.log("Skipping " + file + ", already modified.");
        continue;
    }

    if (replaceLoadImageRegex.test(content)) {
        content = content.replace(replaceLoadImageRegex, newLoadImage.trim());
    } else {
        console.log("Could not find loadImage in " + file);
        continue;
    }

    content = content.replace(/doc\.addImage\((logoData), 'PNG',\s*pageWidth - 24,\s*5,\s*16,\s*16\);/g,
        "drawLogo(doc, $1, 16, 16, pageWidth - 24, 5, 'right', 'center');");

    content = content.replace(/doc\.addImage\((contractorLogo),\s*["']JPEG["'],\s*logoX,\s*startY \+ logoPadding,\s*logoSize,\s*logoSize\);/g,
        "drawLogo(doc, $1, logoSize, logoSize, logoX, startY + logoPadding, 'left', 'center');");

    content = content.replace(/d\.addImage\((contractorLogo),\s*["']JPEG["'],\s*sx \+ logoPadding,\s*sy \+ logoPadding,\s*logoSize,\s*logoSize\);/g,
        "drawLogo(d, $1, logoSize, logoSize, sx + logoPadding, sy + logoPadding, 'left', 'center');");

    content = content.replace(/doc\.addImage\((clientLogo),\s*["']JPEG["'],\s*pageWidth - margin - logoSize - logoPadding,\s*startY \+ logoPadding,\s*logoSize,\s*logoSize\);/g,
        "drawLogo(doc, $1, logoSize, logoSize, pageWidth - margin - logoSize - logoPadding, startY + logoPadding, 'right', 'center');");

    content = content.replace(/d\.addImage\((clientLogo),\s*["']JPEG["'],\s*pageWidth - margin - logoSize - logoPadding,\s*sy \+ logoPadding,\s*logoSize,\s*logoSize\);/g,
        "drawLogo(d, $1, logoSize, logoSize, pageWidth - margin - logoSize - logoPadding, sy + logoPadding, 'right', 'center');");

    content = content.replace(/doc\.addImage\(cLogo,\s*'PNG',\s*labelX,\s*addressLabelY \+ 4,\s*lWidth,\s*lHeight\);/g,
        "drawLogo(doc, cLogo, lWidth, lHeight, labelX, addressLabelY + 4, 'left', 'middle');");

    content = content.replace(/doc\.addImage\(cLogo,\s*'PNG',\s*leftColX,\s*contentStart \+ 9,\s*20,\s*20\);/g,
        "drawLogo(doc, cLogo, 20, 20, leftColX, contentStart + 9, 'left', 'middle');");

    content = content.replace(/let\s+(clientLogo|contractorLogo)\s*=\s*["'][^"']*["'];/g, 'let $1: any = null;');
    content = content.replace(/let\s+(logoData|cLogo)\s*=\s*["'][^"']*["'];/g, 'let $1: any = null;');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Updated " + file);
}
