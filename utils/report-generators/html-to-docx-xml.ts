/**
 * HTML to WordprocessingML (OpenXML) Converter
 * Converts rich text HTML (from Tiptap/ProseMirror) into valid WordprocessingML (<w:p>, <w:tbl>).
 * Handles paragraphs, headings, bullet & numbered lists, inline styles (bold, italic, underline, strike, color),
 * and creates Word tables with borders, percentage widths, alignment, cell padding, and header shading.
 */

// Helper to escape special XML characters for <w:t>
export function escapeXml(str: string): string {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

// Helper to clean HTML entities from text before XML escaping
function decodeHtmlEntities(str: string): string {
    if (!str) return "";
    return str
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&ndash;/g, "–")
        .replace(/&mdash;/g, "—")
        .replace(/&bull;/g, "•");
}

// Helper to extract 6-digit hex color from string (e.g. "#3b82f6", "rgb(59, 130, 246)")
function extractHexColor(colorStr: string): string | null {
    if (!colorStr) return null;
    const clean = colorStr.trim();
    const hexMatch = clean.match(/#?([0-9a-fA-F]{6})\b/);
    if (hexMatch) return hexMatch[1].toUpperCase();

    const shortHex = clean.match(/#?([0-9a-fA-F]{3})\b/);
    if (shortHex) {
        const [r, g, b] = shortHex[1].split("");
        return `${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }

    const rgbMatch = clean.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
    if (rgbMatch) {
        const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, "0");
        const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, "0");
        const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, "0");
        return `${r}${g}${b}`.toUpperCase();
    }
    return null;
}

interface InlineFormat {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
    color?: string;
    fontSize?: number;
}

// Renders an inline text run with formatting into <w:r>
function renderRun(text: string, fmt: InlineFormat = {}): string {
    if (!text) return "";
    const clean = decodeHtmlEntities(text);
    const escaped = escapeXml(clean);
    if (!escaped) return "";

    let rPr = '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>';
    if (fmt.bold) rPr += "<w:b/>";
    if (fmt.italic) rPr += "<w:i/>";
    if (fmt.underline) rPr += '<w:u w:val="single"/>';
    if (fmt.strike) rPr += "<w:strike/>";
    if (fmt.color) rPr += `<w:color w:val="${fmt.color}"/>`;
    if (fmt.fontSize) rPr += `<w:sz w:val="${fmt.fontSize}"/>`;
    rPr += "</w:rPr>";

    return `<w:r>${rPr}<w:t xml:space="preserve">${escaped}</w:t></w:r>`;
}

// Parses inline nodes recursively (handling <strong>, <em>, <u>, <s>, <span>, <a>, text)
function parseInlineNodes(node: Node, parentFmt: InlineFormat = {}): string {
    let result = "";
    const currentFmt: InlineFormat = { ...parentFmt };

    if (node.nodeType === 3 /* TEXT_NODE */) {
        const text = node.textContent || "";
        return renderRun(text, currentFmt);
    }

    if (node.nodeType !== 1 /* ELEMENT_NODE */) {
        return "";
    }

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === "strong" || tag === "b") currentFmt.bold = true;
    if (tag === "em" || tag === "i") currentFmt.italic = true;
    if (tag === "u") currentFmt.underline = true;
    if (tag === "s" || tag === "strike" || tag === "del") currentFmt.strike = true;

    // Check color in style attribute
    const styleAttr = el.getAttribute("style") || "";
    if (styleAttr) {
        const colorMatch = styleAttr.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
        if (colorMatch) {
            const hex = extractHexColor(colorMatch[1]);
            if (hex) currentFmt.color = hex;
        }
    }

    // Line break
    if (tag === "br") {
        return "<w:r><w:br/></w:r>";
    }

    for (let i = 0; i < el.childNodes.length; i++) {
        result += parseInlineNodes(el.childNodes[i], currentFmt);
    }

    return result;
}

// Converts an HTML table element into <w:tbl> with explicit borders, sizing, and styling
function convertTableToWordXml(tableEl: HTMLElement): string {
    // 1. Determine table width
    const rawWidthAttr = tableEl.getAttribute("data-width") || tableEl.getAttribute("width") || "";
    const styleAttr = tableEl.getAttribute("style") || "";
    let widthPct = 100;

    const widthMatch = rawWidthAttr.match(/(\d+)\s*%/);
    if (widthMatch) {
        widthPct = parseInt(widthMatch[1], 10);
    } else {
        const styleWidthMatch = styleAttr.match(/width\s*:\s*(\d+)%/i);
        if (styleWidthMatch) {
            widthPct = parseInt(styleWidthMatch[1], 10);
        }
    }

    // Scale to pct units (100% = 5000, 85% = 4250, 75% = 3750, 60% = 3000, 50% = 2500)
    const tblW = Math.round(widthPct * 50);

    // 2. Determine table alignment
    let align = "center";
    const rawAlignAttr = tableEl.getAttribute("data-align") || tableEl.getAttribute("align") || "";
    if (rawAlignAttr === "left" || rawAlignAttr === "right" || rawAlignAttr === "center") {
        align = rawAlignAttr;
    } else if (styleAttr.includes("margin-left: 0") || styleAttr.includes("margin-right: auto") && !styleAttr.includes("margin-left: auto")) {
        align = "left";
    } else if (styleAttr.includes("margin-left: auto") && !styleAttr.includes("margin-right: auto")) {
        align = "right";
    }

    // 3. Extract rows from <thead>, <tbody>, or direct <tr>
    const trElements: HTMLTableRowElement[] = Array.from(tableEl.querySelectorAll("tr"));
    if (trElements.length === 0) return "";

    // Calculate max columns
    let maxCols = 1;
    trElements.forEach(tr => {
        let colsInRow = 0;
        Array.from(tr.children).forEach(cell => {
            const span = parseInt((cell as HTMLElement).getAttribute("colspan") || "1", 10);
            colsInRow += isNaN(span) ? 1 : span;
        });
        if (colsInRow > maxCols) maxCols = colsInRow;
    });

    const colWidthDxa = Math.round(8500 / maxCols);

    // Build Table Grid
    let tblGrid = "<w:tblGrid>";
    for (let i = 0; i < maxCols; i++) {
        tblGrid += `<w:gridCol w:w="${colWidthDxa}"/>`;
    }
    tblGrid += "</w:tblGrid>";

    // Build Table Properties with visible borders and cell padding
    const tblPr = `
    <w:tblPr>
      <w:tblStyle w:val="TableGrid"/>
      <w:tblW w:w="${tblW}" w:type="pct"/>
      <w:jc w:val="${align}"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="6" w:space="0" w:color="94A3B8"/>
        <w:left w:val="single" w:sz="6" w:space="0" w:color="94A3B8"/>
        <w:bottom w:val="single" w:sz="6" w:space="0" w:color="94A3B8"/>
        <w:right w:val="single" w:sz="6" w:space="0" w:color="94A3B8"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
      </w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="120" w:type="dxa"/>
        <w:left w:w="160" w:type="dxa"/>
        <w:bottom w:w="120" w:type="dxa"/>
        <w:right w:w="160" w:type="dxa"/>
      </w:tblCellMar>
      <w:tblLayout w:type="autofit"/>
    </w:tblPr>`;

    // Build Rows
    let rowsXml = "";
    trElements.forEach((tr, rowIdx) => {
        const isTheadRow = tr.parentElement?.tagName.toLowerCase() === "thead" || 
                           (rowIdx === 0 && Array.from(tr.children).every(c => c.tagName.toLowerCase() === "th"));

        let trPr = "<w:trPr><w:cantSplit/>";
        if (isTheadRow) {
            trPr += "<w:tblHeader/>";
        }
        trPr += "</w:trPr>";

        let cellsXml = "";
        const cellElements = Array.from(tr.children) as HTMLElement[];

        cellElements.forEach(cell => {
            const isTh = cell.tagName.toLowerCase() === "th" || isTheadRow;
            const colSpan = parseInt(cell.getAttribute("colspan") || "1", 10);

            // Shading: header is #0F172A (navy/dark slate), alternating body rows #FFFFFF / #F8FAFC
            let fillHex = isTh ? "0F172A" : (rowIdx % 2 === 0 ? "FFFFFF" : "F8FAFC");
            const cellStyle = cell.getAttribute("style") || "";
            const customBgMatch = cellStyle.match(/(?:background-color|background)\s*:\s*([^;]+)/i);
            if (customBgMatch) {
                const hex = extractHexColor(customBgMatch[1]);
                if (hex) fillHex = hex;
            }

            // Cell Properties
            let tcPr = "<w:tcPr>";
            if (!isNaN(colSpan) && colSpan > 1) {
                tcPr += `<w:gridSpan w:val="${colSpan}"/>`;
            }
            tcPr += `<w:shd w:val="clear" w:color="auto" w:fill="${fillHex}"/>`;
            tcPr += `
            <w:tcBorders>
              <w:top w:val="single" w:sz="4" w:color="CBD5E1"/>
              <w:left w:val="single" w:sz="4" w:color="CBD5E1"/>
              <w:bottom w:val="single" w:sz="4" w:color="CBD5E1"/>
              <w:right w:val="single" w:sz="4" w:color="CBD5E1"/>
            </w:tcBorders>
            <w:tcMar>
              <w:top w:w="${isTh ? 140 : 100}" w:type="dxa"/>
              <w:left w:w="160" w:type="dxa"/>
              <w:bottom w:w="${isTh ? 140 : 100}" w:type="dxa"/>
              <w:right w:w="160" w:type="dxa"/>
            </w:tcMar>
            <w:vAlign w:val="center"/>
            </w:tcPr>`;

            // Cell Content Alignment
            let cellAlign = "left";
            if (cellStyle.includes("text-align: center") || cell.getAttribute("align") === "center") {
                cellAlign = "center";
            } else if (cellStyle.includes("text-align: right") || cell.getAttribute("align") === "right") {
                cellAlign = "right";
            }

            // Cell text formatting: headers get bold white text, body gets dark slate
            const defaultCellFmt: InlineFormat = isTh
                ? { bold: true, color: "FFFFFF", fontSize: 20 }
                : { color: "1E293B", fontSize: 19 };

            // Parse cell paragraphs or inline children
            let cellBodyXml = "";
            const pChildren = Array.from(cell.querySelectorAll(":scope > p"));

            if (pChildren.length > 0) {
                pChildren.forEach(p => {
                    const runs = parseInlineNodes(p, defaultCellFmt);
                    cellBodyXml += `
                    <w:p>
                      <w:pPr>
                        <w:jc w:val="${cellAlign}"/>
                        <w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>
                      </w:pPr>
                      ${runs || renderRun(" ", defaultCellFmt)}
                    </w:p>`;
                });
            } else {
                const runs = parseInlineNodes(cell, defaultCellFmt);
                cellBodyXml = `
                <w:p>
                  <w:pPr>
                    <w:jc w:val="${cellAlign}"/>
                    <w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>
                  </w:pPr>
                  ${runs || renderRun(" ", defaultCellFmt)}
                </w:p>`;
            }

            cellsXml += `<w:tc>${tcPr}${cellBodyXml}</w:tc>`;
        });

        rowsXml += `<w:tr>${trPr}${cellsXml}</w:tr>`;
    });

    return `<w:tbl>${tblPr}${tblGrid}${rowsXml}</w:tbl>`;
}

// Converts a paragraph or heading element into <w:p>
function convertParagraphToWordXml(el: HTMLElement): string {
    const tag = el.tagName.toLowerCase();
    const styleAttr = el.getAttribute("style") || "";

    let align = "left";
    if (styleAttr.includes("text-align: center")) align = "center";
    else if (styleAttr.includes("text-align: right")) align = "right";
    else if (styleAttr.includes("text-align: justify")) align = "both";

    let beforeSpacing = 60;
    let afterSpacing = 120;
    let defaultFmt: InlineFormat = { fontSize: 22, color: "1E293B" }; // 11pt

    if (tag === "h1") {
        defaultFmt = { bold: true, fontSize: 32, color: "0F172A" }; // 16pt bold
        beforeSpacing = 240;
        afterSpacing = 120;
    } else if (tag === "h2") {
        defaultFmt = { bold: true, fontSize: 28, color: "0F172A" }; // 14pt bold
        beforeSpacing = 200;
        afterSpacing = 100;
    } else if (tag === "h3") {
        defaultFmt = { bold: true, fontSize: 24, color: "1E293B" }; // 12pt bold
        beforeSpacing = 160;
        afterSpacing = 80;
    } else if (tag === "h4" || tag === "h5" || tag === "h6") {
        defaultFmt = { bold: true, fontSize: 22, color: "334155" }; // 11pt bold
        beforeSpacing = 120;
        afterSpacing = 60;
    }

    const runs = parseInlineNodes(el, defaultFmt);

    // Empty paragraph guard
    if (!runs.trim()) {
        return `<w:p><w:pPr><w:spacing w:before="0" w:after="${afterSpacing}"/></w:pPr></w:p>`;
    }

    return `
    <w:p>
      <w:pPr>
        <w:jc w:val="${align}"/>
        <w:spacing w:before="${beforeSpacing}" w:after="${afterSpacing}" w:line="240" w:lineRule="auto"/>
      </w:pPr>
      ${runs}
    </w:p>`;
}

// Converts <ul> or <ol> list element into sequence of bullet/numbered <w:p> items
function convertListToWordXml(listEl: HTMLElement, isOrdered: boolean = false): string {
    let result = "";
    const items = Array.from(listEl.querySelectorAll(":scope > li"));

    items.forEach((li, idx) => {
        const bulletPrefix = isOrdered ? `${idx + 1}. ` : "• ";
        const defaultFmt: InlineFormat = { fontSize: 22, color: "1E293B" };
        const runs = parseInlineNodes(li, defaultFmt);

        result += `
        <w:p>
          <w:pPr>
            <w:ind w:left="400" w:hanging="240"/>
            <w:spacing w:before="40" w:after="40" w:line="240" w:lineRule="auto"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
              <w:sz w:val="22"/>
              <w:color w:val="1E293B"/>
            </w:rPr>
            <w:t xml:space="preserve">${bulletPrefix}</w:t>
          </w:r>
          ${runs}
        </w:p>`;
    });

    return result;
}

/**
 * Main function: converts HTML string to a sequence of valid WordprocessingML tags (<w:p>, <w:tbl>).
 */
export function htmlToWordXml(html: string): string {
    if (!html || typeof html !== "string") {
        return '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>';
    }

    const cleanInput = html.trim();
    if (!cleanInput) {
        return '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>';
    }

    // Check if input contains HTML markup
    if (!/<[a-z][\s\S]*>/i.test(cleanInput)) {
        // Plain text: split by newlines into paragraphs
        const lines = cleanInput.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length === 0) {
            return '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>';
        }
        return lines.map(line => {
            const escaped = escapeXml(line.trim());
            return `
            <w:p>
              <w:pPr>
                <w:spacing w:before="60" w:after="120" w:line="240" w:lineRule="auto"/>
              </w:pPr>
              <w:r>
                <w:rPr>
                  <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                  <w:sz w:val="22"/>
                  <w:color w:val="1E293B"/>
                </w:rPr>
                <w:t xml:space="preserve">${escaped}</w:t>
              </w:r>
            </w:p>`;
        }).join("");
    }

    // Parse HTML into DOM
    let doc: Document;
    if (typeof DOMParser !== "undefined") {
        doc = new DOMParser().parseFromString(cleanInput, "text/html");
    } else {
        // Fallback for non-browser environment
        return '<w:p><w:r><w:t>' + escapeXml(decodeHtmlEntities(cleanInput.replace(/<[^>]+>/g, " "))) + '</w:t></w:r></w:p>';
    }

    const body = doc.body;
    let xmlOutput = "";
    let lastWasTable = false;

    // Traverse root children
    for (let i = 0; i < body.childNodes.length; i++) {
        const node = body.childNodes[i];

        if (node.nodeType === 3 /* TEXT_NODE */) {
            const text = (node.textContent || "").trim();
            if (text) {
                const escaped = escapeXml(decodeHtmlEntities(text));
                xmlOutput += `
                <w:p>
                  <w:pPr>
                    <w:spacing w:before="60" w:after="120" w:line="240" w:lineRule="auto"/>
                  </w:pPr>
                  <w:r>
                    <w:rPr>
                      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                      <w:sz w:val="22"/>
                      <w:color w:val="1E293B"/>
                    </w:rPr>
                    <w:t xml:space="preserve">${escaped}</w:t>
                  </w:r>
                </w:p>`;
                lastWasTable = false;
            }
            continue;
        }

        if (node.nodeType === 1 /* ELEMENT_NODE */) {
            const el = node as HTMLElement;
            const tag = el.tagName.toLowerCase();

            if (tag === "table") {
                xmlOutput += convertTableToWordXml(el);
                lastWasTable = true;
            } else if (tag === "ul") {
                xmlOutput += convertListToWordXml(el, false);
                lastWasTable = false;
            } else if (tag === "ol") {
                xmlOutput += convertListToWordXml(el, true);
                lastWasTable = false;
            } else if (/^h[1-6]$/.test(tag) || tag === "p" || tag === "div" || tag === "blockquote") {
                // If it's a wrapper div that directly contains a table, convert the table
                const nestedTable = el.querySelector(":scope > table");
                if (nestedTable) {
                    xmlOutput += convertTableToWordXml(nestedTable as HTMLElement);
                    lastWasTable = true;
                } else {
                    xmlOutput += convertParagraphToWordXml(el);
                    lastWasTable = false;
                }
            } else {
                // Generic inline element at root level
                xmlOutput += convertParagraphToWordXml(el);
                lastWasTable = false;
            }
        }
    }

    // Ensure valid non-empty XML
    if (!xmlOutput.trim()) {
        return '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>';
    }

    // OpenXML requirement: if the last element was a table, add a clean trailing paragraph
    // to prevent table collision with subsequent sections or parent table cells
    if (lastWasTable) {
        xmlOutput += '<w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr></w:p>';
    }

    return xmlOutput;
}
