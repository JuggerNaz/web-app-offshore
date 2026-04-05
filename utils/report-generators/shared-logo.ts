export const loadLogoWithTransparency = (url: string): Promise<{ data: string; width: number; height: number; } | null> => {
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

                try {
                    const imageData = ctx.getImageData(0, 0, img.width, img.height);
                    const data = imageData.data;
                    const width = img.width;
                    const height = img.height;

                    const isWhite = (i: number) => data[i] > 230 && data[i + 1] > 230 && data[i + 2] > 230 && data[i + 3] > 0;

                    const stack: { x: number, y: number }[] = [];
                    const visited = new Uint8Array(width * height);

                    const pushIfWhite = (x: number, y: number) => {
                        if (x < 0 || x >= width || y < 0 || y >= height) return;
                        const idx = y * width + x;
                        if (!visited[idx]) {
                            const p = idx * 4;
                            if (isWhite(p)) {
                                visited[idx] = 1;
                                stack.push({ x, y });
                            }
                        }
                    };

                    for (let x = 0; x < width; x++) { pushIfWhite(x, 0); pushIfWhite(x, height - 1); }
                    for (let y = 0; y < height; y++) { pushIfWhite(0, y); pushIfWhite(width - 1, y); }

                    while (stack.length > 0) {
                        const pt = stack.pop();
                        if (!pt) continue;
                        const { x, y } = pt;
                        const p = (y * width + x) * 4;
                        data[p + 3] = 0; // make transparent

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
                                    data[((y) * width + x - 1) * 4 + 3] === 0 ||
                                    data[((y) * width + x + 1) * 4 + 3] === 0 ||
                                    data[((y - 1) * width + x) * 4 + 3] === 0 ||
                                    data[((y + 1) * width + x) * 4 + 3] === 0;
                                if (hasTransparentNeighbor) {
                                    const avgColor = (data[p] + data[p + 1] + data[p + 2]) / 3;
                                    if (avgColor > 200) {
                                        data[p + 3] = Math.max(0, 255 - (avgColor - 180) * 3);
                                    }
                                }
                            }
                        }
                    }
                    ctx.putImageData(imageData, 0, 0);
                } catch (e) { console.error("Canvas transparency error", e); }

                resolve({ data: canvas.toDataURL("image/png"), width: img.width, height: img.height });
            } else {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
    });
};

export const drawLogo = (doc: any, logo: any, maxW: number, maxH: number, x: number, y: number, alignX = 'left', alignY = 'center') => {
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
