const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../utils/pdf-generator.ts');

if (!fs.existsSync(targetFile)) {
    console.error(`File not found: ${targetFile}`);
    process.exit(1);
}

let content = fs.readFileSync(targetFile, 'utf8');

// We can target specific lines or use a regex to replace loadLogo
// Let's print out what we match first or just do a clean replace using simpler regexes

// For loadLogo:
// find from const loadLogo = to the first resolve(null);\r?\n\s*\}\);\r?\n\};
const loadLogoRegex = /const loadLogo = \([\s\S]*?img\.onerror = \(\) => resolve\(null\);\r?\n\s*\}\);\r?\n\s*\};/;

const loadLogoNew = `const loadLogo = (url: string): Promise<{ data: string; width: number; height: number; } | null> => {
  return new Promise((resolve) => {
    if (!url || typeof url !== 'string' || !url.trim()) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "Anonymous";
    const timeout = setTimeout(() => {
      console.warn(\`Logo loading timed out (3s limit) in pdf-generator for URL: \${url}\`);
      img.onload = null;
      img.onerror = null;
      resolve(null);
    }, 3000);
    img.onload = () => {
      clearTimeout(timeout);
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);

        try {
            const imageData = ctx.getImageData(0, 0, img.width, img.height);
            const data = imageData.data;
            const width = img.width;
            const height = img.height;
            
            const isWhite = (i: number) => data[i] > 230 && data[i+1] > 230 && data[i+2] > 230 && data[i+3] > 0;
            
            const stack: {x: number, y: number}[] = [];
            const visited = new Uint8Array(width * height);
            
            const pushIfWhite = (x: number, y: number) => {
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

        resolve({ data: canvas.toDataURL("image/png"), width: img.width, height: img.height });
      } else {
        resolve(null);
      }
    };
    img.onerror = () => {
      clearTimeout(timeout);
      console.warn(\`Logo loading failed in pdf-generator for URL: \${url}\`);
      resolve(null);
    };
    img.src = url;
  });
};`;

// For loadImage:
const loadImageRegex = /const loadImage = \([\s\S]*?img\.onerror = \([s\S]*?\) => reject\(e\);\r?\n\s*\}\);\r?\n\s*\};/;

const loadImageNew = `const loadImage = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!url || typeof url !== 'string' || !url.trim()) {
      reject(new Error("Empty or invalid image URL"));
      return;
    }
    const img = new Image();
    img.crossOrigin = "Anonymous";
    const timeout = setTimeout(() => {
      console.warn(\`Image loading timed out (5s limit) in pdf-generator for URL: \${url}\`);
      img.onload = null;
      img.onerror = null;
      reject(new Error("Image loading timed out"));
    }, 5000);
    img.onload = () => {
      clearTimeout(timeout);
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg"));
      } else {
        reject(new Error("Canvas context is null"));
      }
    };
    img.onerror = (e) => {
      clearTimeout(timeout);
      reject(e);
    };
    img.src = url;
  });
};`;

let updated = content;

if (loadLogoRegex.test(updated)) {
    updated = updated.replace(loadLogoRegex, loadLogoNew);
    console.log("Matched and replaced loadLogo");
} else {
    console.error("loadLogoRegex did not match");
}

if (loadImageRegex.test(updated)) {
    updated = updated.replace(loadImageRegex, loadImageNew);
    console.log("Matched and replaced loadImage");
} else {
    // Let's try matching with a simpler pattern for loadImage
    const loadImageRegexSimple = /const loadImage = \([\s\S]*?img\.onerror = \(e\) => reject\(e\);\r?\n\s*\}\);\r?\n\s*\};/;
    if (loadImageRegexSimple.test(updated)) {
        updated = updated.replace(loadImageRegexSimple, loadImageNew);
        console.log("Matched and replaced loadImage with simple regex");
    } else {
        console.error("loadImageRegex simple did not match either");
    }
}

if (updated !== content) {
    fs.writeFileSync(targetFile, updated, 'utf8');
    console.log(`Successfully updated ${targetFile}`);
} else {
    console.log("No changes made to pdf-generator.ts");
}
