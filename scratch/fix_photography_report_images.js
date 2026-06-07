const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../utils/report-generators/rov-photography-report.ts');

if (!fs.existsSync(targetFile)) {
    console.error(`File not found: ${targetFile}`);
    process.exit(1);
}

let content = fs.readFileSync(targetFile, 'utf8');

const loadPhotoDataOld = `const loadPhotoData = async (url: string): Promise<{ data: string; width: number; height: number; } | null> => {
    return new Promise((resolve) => {
        const img = new window.Image();
        img.crossOrigin = "Anonymous";
        img.src = url;
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                resolve({ data: canvas.toDataURL("image/jpeg", 0.8), width: img.width, height: img.height });
            } else {
                resolve(null);
            }
        };
        img.onerror = () => {
            console.warn(\`Failed to load photo: \${url}\`);
            resolve(null);
        };
    });
};`;

const loadPhotoDataNew = `const loadPhotoData = async (url: string): Promise<{ data: string; width: number; height: number; } | null> => {
    return new Promise((resolve) => {
        if (!url || typeof url !== 'string' || !url.trim()) {
            resolve(null);
            return;
        }
        const img = new window.Image();
        img.crossOrigin = "Anonymous";
        const timeout = setTimeout(() => {
            console.warn(\`Photo loading timed out (5s limit) in rov-photography-report for URL: \${url}\`);
            img.onload = null;
            img.onerror = null;
            resolve(null);
        }, 5000);
        img.onload = () => {
            clearTimeout(timeout);
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                resolve({ data: canvas.toDataURL("image/jpeg", 0.8), width: img.width, height: img.height });
            } else {
                resolve(null);
            }
        };
        img.onerror = () => {
            clearTimeout(timeout);
            console.warn(\`Failed to load photo: \${url}\`);
            resolve(null);
        };
        img.src = url;
    });
};`;

let updated = content;

if (updated.includes(loadPhotoDataOld.replace(/\r\n/g, '\n'))) {
    updated = updated.split(loadPhotoDataOld.replace(/\r\n/g, '\n')).join(loadPhotoDataNew.replace(/\r\n/g, '\n'));
} else if (updated.includes(loadPhotoDataOld)) {
    updated = updated.split(loadPhotoDataOld).join(loadPhotoDataNew);
} else {
    // Regex fallback
    const regex = /const loadPhotoData = async \([\s\S]*?img\.onerror = \(\) => \{[\s\S]*?resolve\(null\);\r?\n\s*\}\;\r?\n\s*\}\);\r?\n\s*\};/;
    if (regex.test(updated)) {
        updated = updated.replace(regex, loadPhotoDataNew);
        console.log("Replaced via regex");
    } else {
        console.error("Could not find patterns for loadPhotoData in rov-photography-report.ts");
    }
}

if (updated !== content) {
    fs.writeFileSync(targetFile, updated, 'utf8');
    console.log(`Successfully updated ${targetFile}`);
} else {
    console.log("No changes made to rov-photography-report.ts");
}
