const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../utils/report-generators/defect-anomaly-report.ts');

if (!fs.existsSync(targetFile)) {
    console.error(`File not found: ${targetFile}`);
    process.exit(1);
}

let content = fs.readFileSync(targetFile, 'utf8');

const loadImageOld = `const loadImage = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
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
                resolve(canvas.toDataURL("image/jpeg"));
            } else {
                reject(new Error("Canvas context is null"));
            }
        };
        img.onerror = (e) => resolve("");
    });
};`;

const loadImageNew = `const loadImage = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!url || typeof url !== 'string' || !url.trim()) {
            resolve("");
            return;
        }
        const img = new Image();
        img.crossOrigin = "Anonymous";
        const timeout = setTimeout(() => {
            console.warn(\`Image loading timed out (5s limit) in defect-anomaly-report for URL: \${url}\`);
            img.onload = null;
            img.onerror = null;
            resolve("");
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
            resolve("");
        };
        img.src = url;
    });
};`;

let updated = content;

if (updated.includes(loadImageOld.replace(/\r\n/g, '\n'))) {
    updated = updated.split(loadImageOld.replace(/\r\n/g, '\n')).join(loadImageNew.replace(/\r\n/g, '\n'));
} else if (updated.includes(loadImageOld)) {
    updated = updated.split(loadImageOld).join(loadImageNew);
} else {
    // Regex fallback
    const regex = /const loadImage = \([\s\S]*?img\.onerror = \([s\S]*?\) => resolve\(""\);\r?\n\s*\}\);\r?\n\s*\};/;
    if (regex.test(updated)) {
        updated = updated.replace(regex, loadImageNew);
        console.log("Replaced via regex");
    } else {
        console.error("Could not find patterns for loadImage in defect-anomaly-report.ts");
    }
}

if (updated !== content) {
    fs.writeFileSync(targetFile, updated, 'utf8');
    console.log(`Successfully updated ${targetFile}`);
} else {
    console.log("No changes made to defect-anomaly-report.ts");
}
