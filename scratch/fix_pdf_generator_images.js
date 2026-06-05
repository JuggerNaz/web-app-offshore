const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../utils/pdf-generator.ts');

if (!fs.existsSync(targetFile)) {
    console.error(`File not found: ${targetFile}`);
    process.exit(1);
}

let content = fs.readFileSync(targetFile, 'utf8');

// Define replacements
const loadLogoOld = `const loadLogo = (url: string): Promise<{ data: string; width: number; height: number; } | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = url;
    img.onload = () => {`;

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
      clearTimeout(timeout);`;

const loadLogoEndOld = `    };
    img.onerror = () => resolve(null);
  });
};`;

const loadLogoEndNew = `    };
    img.onerror = () => {
      clearTimeout(timeout);
      console.warn(\`Logo loading failed in pdf-generator for URL: \${url}\`);
      resolve(null);
    };
    img.src = url;
  });
};`;

const loadImageOld = `const loadImage = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = url;
    img.onload = () => {`;

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
      clearTimeout(timeout);`;

const loadImageEndOld = `    };
    img.onerror = (e) => reject(e);
  });
};`;

const loadImageEndNew = `    };
    img.onerror = (e) => {
      clearTimeout(timeout);
      reject(e);
    };
    img.src = url;
  });
};`;

// Apply replacements
let updated = content;

// Replace loadLogo start
if (updated.includes(loadLogoOld.replace(/\r\n/g, '\n'))) {
    updated = updated.split(loadLogoOld.replace(/\r\n/g, '\n')).join(loadLogoNew.replace(/\r\n/g, '\n'));
} else if (updated.includes(loadLogoOld)) {
    updated = updated.split(loadLogoOld).join(loadLogoNew);
} else {
    console.error("Could not find loadLogoOld pattern");
}

// Replace loadLogo end
if (updated.includes(loadLogoEndOld.replace(/\r\n/g, '\n'))) {
    updated = updated.split(loadLogoEndOld.replace(/\r\n/g, '\n')).join(loadLogoEndNew.replace(/\r\n/g, '\n'));
} else if (updated.includes(loadLogoEndOld)) {
    updated = updated.split(loadLogoEndOld).join(loadLogoEndNew);
} else {
    console.error("Could not find loadLogoEndOld pattern");
}

// Replace loadImage start
if (updated.includes(loadImageOld.replace(/\r\n/g, '\n'))) {
    updated = updated.split(loadImageOld.replace(/\r\n/g, '\n')).join(loadImageNew.replace(/\r\n/g, '\n'));
} else if (updated.includes(loadImageOld)) {
    updated = updated.split(loadImageOld).join(loadImageNew);
} else {
    console.error("Could not find loadImageOld pattern");
}

// Replace loadImage end
if (updated.includes(loadImageEndOld.replace(/\r\n/g, '\n'))) {
    updated = updated.split(loadImageEndOld.replace(/\r\n/g, '\n')).join(loadImageEndNew.replace(/\r\n/g, '\n'));
} else if (updated.includes(loadImageEndOld)) {
    updated = updated.split(loadImageEndOld).join(loadImageEndNew);
} else {
    console.error("Could not find loadImageEndOld pattern");
}

if (updated !== content) {
    fs.writeFileSync(targetFile, updated, 'utf8');
    console.log(`Successfully updated ${targetFile}`);
} else {
    console.log("No changes made to pdf-generator.ts");
}
