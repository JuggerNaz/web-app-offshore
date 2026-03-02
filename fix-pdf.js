const fs = require('fs');

let content = fs.readFileSync('utils/pdf-generator.ts', 'utf8');

const replacementFuncs = `
const loadLogo = (url: string): Promise<{ data: string; width: number; height: number; } | null> => {
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

if (!content.includes('loadLogo =')) {
    content = content.replace(
        /const loadImage = \(url: string\): Promise<string> => \{/,
        replacementFuncs.trim() + "\n\nconst loadImage = (url: string): Promise<string> => {"
    );
}

// Now replace usages of loadImage(companySettings.logo_url)
content = content.replace(
    /const\s+logoData\s*=\s*await\s+loadImage\(\s*companySettings\.logo_url\s*\);\s*(?:\/\/[^\n]*\n\s*)*doc\.addImage\(\s*logoData,\s*['"]PNG['"],\s*pageWidth\s*-\s*24,\s*5,\s*16,\s*16\s*\);/g,
    "const logoData = await loadLogo(companySettings.logo_url);\n      drawLogo(doc, logoData, 16, 16, pageWidth - 24, 5, 'right', 'center');"
);

fs.writeFileSync('utils/pdf-generator.ts', content);
console.log("Updated pdf-generator.ts");
