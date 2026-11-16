import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import zlib from "zlib";
import { EXECUTIVE_SUMMARY_TOC } from "@/app/dashboard/reports/executive-summary/constants";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface ExtractedBlock {
    id: string;
    type: "heading" | "paragraph" | "table" | "list";
    text: string;
    html: string;
    headingLevel?: number;
    assignedSectionId?: string;
}

interface SmartDetectedSection {
    sectionId: string;
    sectionTitle: string;
    matchedHeading: string;
    confidence: number;
    extractedHtml: string;
    rawText: string;
    blockCount: number;
    hasTable: boolean;
    blocks: ExtractedBlock[];
}

// ─────────────────────────────────────────────────────────────────────────────
// TOC SECTION HEADING PATTERNS
// ─────────────────────────────────────────────────────────────────────────────
// Strict heading matching patterns for all 30 TOC sections
const TOC_HEADING_PATTERNS: { id: string; patterns: RegExp[] }[] = [
    {
        id: "intro",
        patterns: [
            /^(?:introduction|project\s+background|scope\s+of\s+work|general\s+introduction)\b/i,
            /^purpose\s+of\s+inspection\b/i
        ]
    },
    {
        id: "gvi",
        patterns: [
            /^(?:general\s+visual\s+inspection|gvi\s+inspection|jacket\s+gvi|structural\s+gvi|jacket\s+structure|structural\s+findings|jacket\s+members)\b/i,
            /^gvi\b/i
        ]
    },
    {
        id: "cp",
        patterns: [
            /^(?:cathodic\s+potential|cathodic\s+protection|cp\s+survey|potential\s+measurements?|cp\s+logging|drop\s+cell|anode\s+potential)\b/i,
            /^cp\s+(?:inspection|reading|result|data)\b/i
        ]
    },
    {
        id: "fmd",
        patterns: [
            /^(?:flooded\s+member\s+detection|fmd\s+survey|member\s+flooding|ultrasonic\s+fmd|fmd\s+inspection|flooded\s+member)\b/i,
            /^fmd\b/i
        ]
    },
    {
        id: "caisson_top",
        patterns: [
            /^caisson(?:\s+survey|\s+inspection)?\s+topside\b/i,
            /^topside\s+caissons?\b/i
        ]
    },
    {
        id: "caisson_sub",
        patterns: [
            /^(?:sump\s+pipe(?:\/caisson\s+survey)?|caisson\s+survey|caisson\s+inspection|subsea\s+caissons?)\b/i,
            /^caisson(?:\s+survey|\s+inspection)?\s+(?:subsea|underwater)\b/i
        ]
    },
    {
        id: "boatlanding_top",
        patterns: [
            /^boat\s+landing(?:\s+inspection)?\s*:\s*above\s+water\b/i,
            /^boat\s+landing(?:\s+inspection)?\s+topside\b/i,
            /^topside\s+boat\s+landing\b/i
        ]
    },
    {
        id: "boatlanding_sub",
        patterns: [
            /^boat\s+landing(?:\s+inspection)?\s*:\s*underwater\b/i,
            /^boat\s+landing(?:\s+inspection)?\s+(?:subsea|underwater)\b/i,
            /^boat\s+landing\b/i
        ]
    },
    {
        id: "riserguard_top",
        patterns: [
            /^riser\s+guard(?:\s+inspection)?\s*:\s*above\s+water\b/i,
            /^riser\s+guard(?:\s+inspection)?\s+topside\b/i
        ]
    },
    {
        id: "riserguard_sub",
        patterns: [
            /^riser\s+guard(?:\s+inspection)?\s*:\s*underwater\b/i,
            /^riser\s+guard(?:\s+inspection)?\s+(?:subsea|underwater)\b/i,
            /^riser\s+guard\b/i
        ]
    },
    {
        id: "conductor_top",
        patterns: [
            /^conductors?(?:\s+inspection)?\s+topside\b/i,
            /^topside\s+conductors?\b/i
        ]
    },
    {
        id: "conductor_sub",
        patterns: [
            /^conductors?(?:\s+inspection)?\s+(?:subsea|underwater)\b/i,
            /^subsea\s+conductors?\b/i,
            /^conductor\s+guides?\b/i
        ]
    },
    {
        id: "riser",
        patterns: [
            /^(?:subsea\s+risers?|riser\s+inspection|production\s+risers?|gas\s+lift\s+riser|flexible\s+risers?)\b/i
        ]
    },
    {
        id: "splashzone",
        patterns: [
            /^(?:splash\s+zone|splash\s+zone\s+coating|coating\s+inspection|jacket\s+splash\s+zone)\b/i
        ]
    },
    {
        id: "anode_gen",
        patterns: [
            /^(?:general\s+anode|sacrificial\s+anodes?\s+inspection|anode\s+condition|anodes?\s+survey)\b/i
        ]
    },
    {
        id: "anode_sel",
        patterns: [
            /^(?:selected\s+anode|detailed\s+anode|anode\s+dimensions?)\b/i
        ]
    },
    {
        id: "mgi",
        patterns: [
            /^(?:marine\s+growth|mgi|mgi\s+inspection|marine\s+growth\s+fouling|growth\s+thickness|fouling\s+thickness)\b/i
        ]
    },
    {
        id: "scour",
        patterns: [
            /^(?:base\s+level|scour\s+survey|seabed\s+scour|pile\s+exposure|scour\s+inspection|mudline\s+survey)\b/i
        ]
    },
    {
        id: "seabed",
        patterns: [
            /^(?:seabed\s+survey|debris\s+survey|seabed\s+debris|seabed\s+bathymetry|seabed\s+topography)\b/i
        ]
    },
    {
        id: "anode_maint",
        patterns: [
            /^(?:anode\s+maintenance|anode\s+retrofit|anode\s+replacement)\b/i
        ]
    },
    {
        id: "node_cvi",
        patterns: [
            /^(?:selected\s+node.*close\s+visual|node\s+cvi|close\s+visual\s+inspection|cvi\s+inspection)\b/i
        ]
    },
    {
        id: "node_mpi",
        patterns: [
            /^(?:selected\s+node.*magnetic|node\s+mpi|magnetic\s+particle\s+inspection|mpi\s+inspection)\b/i
        ]
    },
    {
        id: "boatbumper_top",
        patterns: [
            /^boat\s+bumper(?:\s+inspection)?\s*:\s*above\s+water\b/i,
            /^boat\s+bumper(?:\s+inspection)?\s+topside\b/i
        ]
    },
    {
        id: "boatbumper_sub",
        patterns: [
            /^boat\s+bumper(?:\s+inspection)?\s*:\s*underwater\b/i,
            /^boat\s+bumper(?:\s+inspection)?\s+subsea\b/i,
            /^boat\s+bumper\b/i
        ]
    },
    {
        id: "conductorguard_sub",
        patterns: [
            /^conductor\s+guard(?:\s+inspection)?\s*:\s*underwater\b/i,
            /^conductor\s+guard(?:\s+inspection)?\s+subsea\b/i,
            /^conductor\s+guard\b/i
        ]
    },
    {
        id: "caissonguard_sub",
        patterns: [
            /^caisson\s+guard(?:\s+inspection)?\s*:\s*underwater\b/i,
            /^caisson\s+guard(?:\s+inspection)?\s+(?:subsea|underwater)\b/i,
            /^caisson\s+guard\b/i
        ]
    },
    {
        id: "conductorguard_top",
        patterns: [
            /^conductor\s+guard(?:\s+inspection)?\s*:\s*above\s+water\b/i,
            /^conductor\s+guard(?:\s+inspection)?\s+topside\b/i
        ]
    },
    {
        id: "caissonguard_top",
        patterns: [
            /^caisson\s+guard(?:\s+inspection)?\s*:\s*above\s+water\b/i,
            /^caisson\s+guard(?:\s+inspection)?\s+topside\b/i,
            /^topside\s+caisson\s+guard\b/i
        ]
    },
    {
        id: "anomaly_finding",
        patterns: [
            /^(?:anomaly|anomalies|findings\s+summary|defect\s+summary|summary\s+of\s+findings|integrity\s+findings)\b/i,
            /^(?:list\s+of\s+anomalies|outstanding\s+anomalies)\b/i
        ]
    },
    {
        id: "incomplete",
        patterns: [
            /^(?:incomplete\s+scope|uncompleted\s+scope|outstanding\s+work|weather\s+delays?|pending\s+scope|limitations?)\b/i
        ]
    }
];

// ─────────────────────────────────────────────────────────────────────────────
// MATCH HEADING DIRECTLY TO TOC SECTION
// ─────────────────────────────────────────────────────────────────────────────
function matchHeadingToToc(rawHeadingText: string): { tocId: string; title: string; index: number } | null {
    const raw = rawHeadingText.trim();
    if (!raw || raw.length > 120) return null;

    // Do NOT match status sentences or photo lines as headings
    if (/^no\s+anomalies|^no\s+finding|^no\s+diving|picture\s+title:|description:/i.test(raw)) {
        return null;
    }

    // 1. Direct numbering match: e.g. "1.4", "1.4 +1Flooded Member Detection", "1.29 +1Anomaly & Findings Summary"
    const numberMatch = raw.match(/^(?:section\s+)?(\d+)\.(\d+)(?:\s*\+\d+)?\s*(.*)$/i);
    if (numberMatch) {
        const subSecNum = parseInt(numberMatch[2], 10); // e.g. 29 for 1.29, 4 for 1.4
        const remainder = numberMatch[3]?.trim();

        if (subSecNum >= 1 && subSecNum <= EXECUTIVE_SUMMARY_TOC.length) {
            const toc = EXECUTIVE_SUMMARY_TOC[subSecNum - 1];
            // If remainder has text, verify it matches or is related
            if (!remainder || remainder.length === 0) {
                return { tocId: toc.id, title: toc.title, index: subSecNum - 1 };
            }
            const cleanRem = remainder.replace(/^\+?\d+\s*/, "").trim().toLowerCase();
            const cleanToc = toc.title.toLowerCase();
            // Check if title words overlap
            const tocWords = cleanToc.split(/[\s/()]+/).filter(w => w.length > 2);
            const matchesWords = tocWords.some(w => cleanRem.includes(w));
            if (matchesWords || cleanToc.includes(cleanRem) || cleanRem.includes(cleanToc)) {
                return { tocId: toc.id, title: toc.title, index: subSecNum - 1 };
            }
        }
    }

    // 2. Title matching after stripping numbering and outline artifacts (e.g. "+1")
    const cleanTitle = raw
        .replace(/^(?:section|part|chapter)\s+/i, "")
        .replace(/^\d+(?:\.\d+)*\s*(?:\+\d+)?\s*[-:.)]?\s*/i, "")
        .trim();

    if (cleanTitle.length >= 3) {
        const lower = cleanTitle.toLowerCase();

        // Exact match against TOC title
        for (let i = 0; i < EXECUTIVE_SUMMARY_TOC.length; i++) {
            const toc = EXECUTIVE_SUMMARY_TOC[i];
            const tocLower = toc.title.toLowerCase();
            if (lower === tocLower) {
                return { tocId: toc.id, title: toc.title, index: i };
            }
            const tocSimple = tocLower.replace(/\s*\([^)]*\)/g, "").trim();
            if (lower === tocSimple || lower.startsWith(tocSimple)) {
                return { tocId: toc.id, title: toc.title, index: i };
            }
        }

        // Regex patterns match
        for (let i = 0; i < EXECUTIVE_SUMMARY_TOC.length; i++) {
            const toc = EXECUTIVE_SUMMARY_TOC[i];
            const entry = TOC_HEADING_PATTERNS.find(p => p.id === toc.id);
            if (entry) {
                for (const pat of entry.patterns) {
                    if (pat.test(lower) || pat.test(raw)) {
                        return { tocId: toc.id, title: toc.title, index: i };
                    }
                }
            }
        }
    }

    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSE WORD DOCUMENT (.docx & binary .doc)
// ─────────────────────────────────────────────────────────────────────────────
async function parseWordFile(fileBuffer: Buffer): Promise<{ blocks: ExtractedBlock[]; rawText: string }> {
    const isZip = fileBuffer.length >= 4 &&
        fileBuffer[0] === 0x50 &&
        fileBuffer[1] === 0x4B &&
        fileBuffer[2] === 0x03 &&
        fileBuffer[3] === 0x04;

    if (isZip) {
        return await parseDocxArchive(fileBuffer);
    } else {
        return parseBinaryDoc(fileBuffer);
    }
}

async function parseDocxArchive(buffer: Buffer): Promise<{ blocks: ExtractedBlock[]; rawText: string }> {
    const zip = await JSZip.loadAsync(buffer);
    const docXmlFile = zip.file("word/document.xml");
    if (!docXmlFile) {
        throw new Error("Invalid DOCX format: word/document.xml missing");
    }

    const xmlText = await docXmlFile.async("string");
    const cleanXml = xmlText.replace(/xmlns:[^=]+="[^"]*"/g, "");

    const blocks: ExtractedBlock[] = [];
    const rawLines: string[] = [];
    let blockIdCounter = 1;

    const elementRegex = /<w:p[\s>][\s\S]*?<\/w:p>|<w:tbl[\s>][\s\S]*?<\/w:tbl>/g;
    let match: RegExpExecArray | null;

    while ((match = elementRegex.exec(cleanXml)) !== null) {
        const chunk = match[0];

        if (chunk.startsWith("<w:tbl")) {
            const rows: string[][] = [];
            const trRegex = /<w:tr[\s>][\s\S]*?<\/w:tr>/g;
            let trMatch: RegExpExecArray | null;

            while ((trMatch = trRegex.exec(chunk)) !== null) {
                const trXml = trMatch[0];
                const cells: string[] = [];
                const tcRegex = /<w:tc[\s>][\s\S]*?<\/w:tc>/g;
                let tcMatch: RegExpExecArray | null;

                while ((tcMatch = tcRegex.exec(trXml)) !== null) {
                    const tcXml = tcMatch[0];
                    const cellTexts: string[] = [];
                    const tRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
                    let tMatch: RegExpExecArray | null;
                    while ((tMatch = tRegex.exec(tcXml)) !== null) {
                        cellTexts.push(tMatch[1]);
                    }
                    cells.push(cellTexts.join(" ").trim());
                }
                if (cells.length > 0) {
                    rows.push(cells);
                }
            }

            if (rows.length > 0) {
                const tableText = rows.map(r => r.join(" | ")).join("\n");
                rawLines.push(tableText);

                let tableHtml = `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 1em auto !important; border-collapse: collapse; font-size: 11px;">`;
                rows.forEach((row, rIdx) => {
                    const isHeader = rIdx === 0;
                    tableHtml += `<tr>`;
                    row.forEach(cell => {
                        if (isHeader) {
                            tableHtml += `<th style="background-color: #0f172a; color: #ffffff; border: 1px solid #334155; padding: 6px 10px; font-weight: bold; text-align: left;">${cell || "&nbsp;"}</th>`;
                        } else {
                            tableHtml += `<td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left;">${cell || "&nbsp;"}</td>`;
                        }
                    });
                    tableHtml += `</tr>`;
                });
                tableHtml += `</table>`;

                blocks.push({
                    id: `block-${blockIdCounter++}`,
                    type: "table",
                    text: tableText,
                    html: tableHtml
                });
            }
        } else {
            const isWordHeadingStyle = /<w:pStyle\s+w:val="Heading(\d)"/i.test(chunk);
            const headingMatch = /<w:pStyle\s+w:val="Heading(\d)"/i.exec(chunk);
            const headingLevel = headingMatch ? parseInt(headingMatch[1], 10) : undefined;
            const isList = /<w:numPr>/i.test(chunk);

            const texts: string[] = [];
            const tRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
            let tMatch: RegExpExecArray | null;
            while ((tMatch = tRegex.exec(chunk)) !== null) {
                texts.push(tMatch[1]);
            }

            const cleanText = texts.join("").trim();
            if (!cleanText) continue;

            rawLines.push(cleanText);

            const isNumberedHeading = cleanText.length < 100 && /^(?:(?:section|part|chapter)\s+)?\d+(?:\.\d+)*\s*(?:\+\d+)?\s+[A-Za-z]/i.test(cleanText);
            const isAllCapsHeading = cleanText.length < 90 && /^[A-Z0-9\s/&,().:–-]{5,}$/.test(cleanText);
            const isHeading = isWordHeadingStyle || isNumberedHeading || isAllCapsHeading;

            if (isHeading) {
                blocks.push({
                    id: `block-${blockIdCounter++}`,
                    type: "heading",
                    text: cleanText,
                    html: `<h3 style="font-weight: bold; margin-top: 1em; color: #0b2c4d;">${cleanText}</h3>`,
                    headingLevel: headingLevel || 2
                });
            } else if (isList) {
                blocks.push({
                    id: `block-${blockIdCounter++}`,
                    type: "list",
                    text: cleanText,
                    html: `<ul><li>${cleanText}</li></ul>`
                });
            } else {
                blocks.push({
                    id: `block-${blockIdCounter++}`,
                    type: "paragraph",
                    text: cleanText,
                    html: `<p style="margin: 0.6em 0; line-height: 1.6;">${cleanText}</p>`
                });
            }
        }
    }

    return { blocks, rawText: rawLines.join("\n\n") };
}

function parseBinaryDoc(buffer: Buffer): { blocks: ExtractedBlock[]; rawText: string } {
    const blocks: ExtractedBlock[] = [];
    const rawLines: string[] = [];
    let blockIdCounter = 1;

    const utf16Str = buffer.toString("utf16le");
    const utf16Matches = utf16Str.match(/[\x20-\x7E\r\n\t]{6,}/g) || [];

    const latin1Str = buffer.toString("latin1");
    const latin1Matches = latin1Str.match(/[\x20-\x7E\r\n\t]{6,}/g) || [];

    const candidatePool = utf16Matches.length >= latin1Matches.length ? utf16Matches : latin1Matches;

    for (const chunk of candidatePool) {
        const lines = chunk.split(/\r?\n/).map(l => l.trim()).filter(l => {
            return l.length > 5 && /[a-zA-Z]{3,}/.test(l) && !/^[0-9\W]+$/.test(l);
        });

        for (const line of lines) {
            rawLines.push(line);
            const isHeading = line.length < 90 && (
                /^(?:(?:section|part|chapter)\s+)?\d+(?:\.\d+)*\s*(?:\+\d+)?\s+[A-Za-z]/i.test(line) ||
                /^[A-Z0-9\s/&,().:–-]{5,}$/.test(line)
            );

            if (isHeading) {
                blocks.push({
                    id: `block-${blockIdCounter++}`,
                    type: "heading",
                    text: line,
                    html: `<h3 style="font-weight: bold; margin-top: 1em; color: #0b2c4d;">${line}</h3>`
                });
            } else {
                blocks.push({
                    id: `block-${blockIdCounter++}`,
                    type: "paragraph",
                    text: line,
                    html: `<p style="margin: 0.6em 0; line-height: 1.6;">${line}</p>`
                });
            }
        }
    }

    return { blocks, rawText: rawLines.join("\n\n") };
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSE PDF
// ─────────────────────────────────────────────────────────────────────────────
function parsePdfDocument(buffer: Buffer): { blocks: ExtractedBlock[]; rawText: string } {
    const rawLines: string[] = [];
    const blocks: ExtractedBlock[] = [];
    let blockIdCounter = 1;

    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    const latin1String = buffer.toString("binary");

    let streamMatch: RegExpExecArray | null;
    const extractedLines: string[] = [];

    while ((streamMatch = streamRegex.exec(latin1String)) !== null) {
        const streamData = Buffer.from(streamMatch[1], "binary");
        let decompressed: Buffer | null = null;
        try {
            decompressed = zlib.inflateSync(streamData);
        } catch {
            try {
                decompressed = zlib.unzipSync(streamData);
            } catch {
                decompressed = streamData;
            }
        }

        if (decompressed && decompressed.length > 0) {
            const content = decompressed.toString("latin1");
            const btRegex = /BT[\s\S]*?ET/g;
            let btMatch: RegExpExecArray | null;

            while ((btMatch = btRegex.exec(content)) !== null) {
                const btChunk = btMatch[0];
                const tjRegex = /\(([\s\S]*?)\)\s*Tj/g;
                let tjMatch: RegExpExecArray | null;
                const chunkStrings: string[] = [];

                while ((tjMatch = tjRegex.exec(btChunk)) !== null) {
                    const decoded = tjMatch[1].replace(/\\([()\\])/g, "$1").trim();
                    if (decoded) chunkStrings.push(decoded);
                }

                const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
                let tjArrMatch: RegExpExecArray | null;

                while ((tjArrMatch = tjArrayRegex.exec(btChunk)) !== null) {
                    const innerArray = tjArrMatch[1];
                    const strPartRegex = /\(([\s\S]*?)\)/g;
                    let strPart: RegExpExecArray | null;
                    const parts: string[] = [];
                    while ((strPart = strPartRegex.exec(innerArray)) !== null) {
                        parts.push(strPart[1].replace(/\\([()\\])/g, "$1"));
                    }
                    const combined = parts.join("").trim();
                    if (combined) chunkStrings.push(combined);
                }

                if (chunkStrings.length > 0) {
                    const line = chunkStrings.join(" ");
                    if (line.length > 1) {
                        extractedLines.push(line);
                    }
                }
            }
        }
    }

    if (extractedLines.length === 0) {
        const asciiMatches = latin1String.match(/[A-Za-z0-9\s.,;:()/%#\-–—]{5,}/g) || [];
        extractedLines.push(...asciiMatches.filter(s => s.trim().length > 6 && !s.includes("obj") && !s.includes("endobj")));
    }

    let currentParagraph: string[] = [];
    const flushParagraph = () => {
        if (currentParagraph.length > 0) {
            const text = currentParagraph.join(" ").trim();
            if (text) {
                rawLines.push(text);
                const isHeading = text.length < 90 && (
                    /^(?:\d+(?:\.\d+)*\s+)?[A-Z\s/-]{4,}$/.test(text) ||
                    /^(?:SECTION|PART|SCOPE|INSPECTION)\b/i.test(text)
                );

                if (isHeading) {
                    blocks.push({
                        id: `block-${blockIdCounter++}`,
                        type: "heading",
                        text,
                        html: `<h3 style="font-weight: bold; margin-top: 1em; color: #0b2c4d;">${text}</h3>`
                    });
                } else {
                    blocks.push({
                        id: `block-${blockIdCounter++}`,
                        type: "paragraph",
                        text,
                        html: `<p style="margin: 0.6em 0; line-height: 1.6;">${text}</p>`
                    });
                }
            }
            currentParagraph = [];
        }
    };

    for (const line of extractedLines) {
        const trimmed = line.trim();
        if (!trimmed) {
            flushParagraph();
            continue;
        }

        const isHeadingLike = trimmed.length < 90 && (
            /^(?:\d+(?:\.\d+)*\s+)?[A-Z\s/-]{4,}$/.test(trimmed) ||
            /^(?:\d+\.0?\s+)[A-Z]/i.test(trimmed)
        );

        if (isHeadingLike) {
            flushParagraph();
            blocks.push({
                id: `block-${blockIdCounter++}`,
                type: "heading",
                text: trimmed,
                html: `<h3 style="font-weight: bold; margin-top: 1em; color: #0b2c4d;">${trimmed}</h3>`
            });
            rawLines.push(trimmed);
        } else {
            currentParagraph.push(trimmed);
        }
    }
    flushParagraph();

    return { blocks, rawText: rawLines.join("\n\n") };
}

// ─────────────────────────────────────────────────────────────────────────────
// STRICT EXECUTIVE SUMMARY CHAPTER BOUNDARY
// ─────────────────────────────────────────────────────────────────────────────
function extractExecutiveSummaryScopeOnly(blocks: ExtractedBlock[]): ExtractedBlock[] {
    let startIdx = -1;
    let endIdx = -1;
    let execChapterNum: number | null = null;

    for (let i = 0; i < blocks.length; i++) {
        const t = blocks[i].text.trim();

        // Skip Table of Contents
        if (/table\s+of\s+contents|contents\s*$/i.test(t)) continue;
        if (/\.{3,}|\bpage\s+\d+|\b\d+\s*$/i.test(t) && t.length < 60) continue;

        // "1.0 EXECUTIVE SUMMARY", "SECTION 1.0 EXECUTIVE SUMMARY", "EXECUTIVE SUMMARY"
        const execMatch = t.match(/^(?:section\s+)?(\d+)(?:\.0)?\s*[-:–—]?\s*(?:executive\s+summary|summary\s+of\s+findings|summary\s+report)\b/i) ||
            t.match(/^(?:executive\s+summary|executive\s+summary\s+report)\b/i);

        if (execMatch) {
            startIdx = i;
            if (execMatch[1]) {
                execChapterNum = parseInt(execMatch[1], 10);
            }
            break;
        }
    }

    if (startIdx === -1) {
        for (let i = 0; i < blocks.length; i++) {
            if (/executive\s+summary/i.test(blocks[i].text.trim()) && blocks[i].type === "heading") {
                startIdx = i;
                break;
            }
        }
    }

    if (startIdx === -1) {
        startIdx = 0;
    }

    for (let i = startIdx + 1; i < blocks.length; i++) {
        const t = blocks[i].text.trim();
        const isHeading = blocks[i].type === "heading" || t.length < 80;

        if (isHeading) {
            // Next major chapter e.g. 2.0 or 3.0
            if (execChapterNum !== null) {
                const nextChapter = execChapterNum + 1;
                const nextChapRegex = new RegExp(`^(?:section\\s+)?${nextChapter}(?:\\.0)?\\s+`, "i");
                if (nextChapRegex.test(t)) {
                    endIdx = i;
                    break;
                }
            }

            if (/^(?:section\s+\d|chapter\s+\d|\d+\.0\s+)?(?:scope\s+of\s+work|inspection\s+methodology|platform\s+details|general\s+information|detailed\s+inspection|inspection\s+results|appendi|attachment|photo\s+log|photographic\s+record)\b/i.test(t)) {
                if (!/^(?:1\.\d|2\.\d)/.test(t) || (execChapterNum !== null && !t.startsWith(execChapterNum + "."))) {
                    endIdx = i;
                    break;
                }
            }
        }

        if (/^picture\s+title:|^photo(?:graph)?\s+(?:no|title):|^description:\s+[A-Za-z0-9_-]+\s+face/i.test(t)) {
            endIdx = i;
            break;
        }
    }

    if (endIdx === -1) {
        endIdx = blocks.length;
    }

    const scoped = blocks.slice(startIdx, endIdx);

    // Filter out photo plate captions and titles
    return scoped.filter(b => {
        const t = b.text.trim();
        if (/^picture\s+title:/i.test(t)) return false;
        if (/^description:\s+[A-Za-z0-9_-]+\s+face/i.test(t)) return false;
        if (/^photo(?:graph)?\s+(?:no|title|\d+):/i.test(t)) return false;
        if (/^photographic\s+record\b/i.test(t)) return false;
        if (/^figure\s+\d+[-:]/i.test(t)) return false;
        return true;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// STRICT HEADING-BASED SECTION SEGMENTATION
// (Only copies content physically under each section's heading)
// ─────────────────────────────────────────────────────────────────────────────
function segmentStrictlyByHeadings(blocks: ExtractedBlock[]): {
    detected: SmartDetectedSection[];
    allBlocksWithAssignment: ExtractedBlock[];
} {
    // 1. Isolate the Executive Summary chapter
    const execBlocks = extractExecutiveSummaryScopeOnly(blocks);

    // 2. Track each section's boundaries based strictly on headings
    const sectionBlocksMap = new Map<string, ExtractedBlock[]>();
    const sectionHeadingMap = new Map<string, string>();

    let currentSectionId: string | null = null;

    for (const block of execBlocks) {
        const text = block.text.trim();

        // Check if this block is a section heading
        const matchedToc = matchHeadingToToc(text);

        if (matchedToc) {
            // New section begins!
            currentSectionId = matchedToc.tocId;
            sectionHeadingMap.set(currentSectionId, text);

            if (!sectionBlocksMap.has(currentSectionId)) {
                sectionBlocksMap.set(currentSectionId, []);
            }
            // The heading marks the start of the section; continue to next block for its body content
            continue;
        }

        // If we are currently inside a section, ALL content belongs strictly to this section!
        // We DO NOT inspect words inside the paragraph to move it to other sections!
        if (currentSectionId) {
            block.assignedSectionId = currentSectionId;
            sectionBlocksMap.get(currentSectionId)!.push(block);
        }
    }

    // 3. Assemble detected sections in canonical TOC order
    const detected: SmartDetectedSection[] = [];

    for (const toc of EXECUTIVE_SUMMARY_TOC) {
        const secBlocks = sectionBlocksMap.get(toc.id);
        if (secBlocks && secBlocks.length > 0) {
            const html = secBlocks.map(b => b.html).join("\n");
            const raw = secBlocks.map(b => b.text).join("\n\n");
            const hasTable = secBlocks.some(b => b.type === "table");

            detected.push({
                sectionId: toc.id,
                sectionTitle: toc.title,
                matchedHeading: sectionHeadingMap.get(toc.id) || toc.title,
                confidence: 99,
                extractedHtml: html,
                rawText: raw,
                blockCount: secBlocks.length,
                hasTable,
                blocks: secBlocks
            });
        }
    }

    return { detected, allBlocksWithAssignment: execBlocks };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST API HANDLER
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided in form-data" }, { status: 400 });
        }

        const fileName = file.name;
        const fileExt = fileName.split(".").pop()?.toLowerCase() || "";
        const fileBuffer = Buffer.from(await file.arrayBuffer());

        if (fileBuffer.length === 0) {
            return NextResponse.json({ error: "The uploaded file is empty" }, { status: 400 });
        }

        let blocks: ExtractedBlock[] = [];
        let fullRawText = "";

        if (fileExt === "docx" || fileExt === "doc") {
            const parsed = await parseWordFile(fileBuffer);
            blocks = parsed.blocks;
            fullRawText = parsed.rawText;
        } else if (fileExt === "pdf") {
            const parsed = parsePdfDocument(fileBuffer);
            blocks = parsed.blocks;
            fullRawText = parsed.rawText;
        } else {
            const text = fileBuffer.toString("utf-8");
            const lines = text.split(/\r?\n\r?\n/).map(l => l.trim()).filter(Boolean);
            let bId = 1;
            blocks = lines.map(l => {
                const isHeading = l.length < 80 && (l.startsWith("#") || /^[A-Z0-9\s.-]+$/.test(l));
                return {
                    id: `block-${bId++}`,
                    type: isHeading ? "heading" : "paragraph",
                    text: l.replace(/^#+\s*/, ""),
                    html: isHeading ? `<h3><strong>${l.replace(/^#+\s*/, "")}</strong></h3>` : `<p>${l}</p>`
                };
            });
            fullRawText = text;
        }

        if (blocks.length === 0) {
            return NextResponse.json({ error: "Could not extract any readable text or tables from this document." }, { status: 400 });
        }

        // Apply strict section-by-section segmentation based solely on document headings
        const { detected, allBlocksWithAssignment } = segmentStrictlyByHeadings(blocks);

        return NextResponse.json({
            success: true,
            fileName,
            fileSize: file.size,
            fileType: fileExt.toUpperCase(),
            totalBlocksFound: blocks.length,
            detectedCount: detected.length,
            detectedSections: detected,
            allBlocks: allBlocksWithAssignment.map(b => ({
                id: b.id,
                type: b.type,
                textSnippet: b.text.slice(0, 120),
                assignedSectionId: b.assignedSectionId
            }))
        });

    } catch (error: any) {
        console.error("Executive Summary import error:", error);
        return NextResponse.json({ error: error.message || "Failed to parse document" }, { status: 500 });
    }
}
