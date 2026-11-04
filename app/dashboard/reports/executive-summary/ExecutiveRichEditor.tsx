"use client";

import React, { useState, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, FontFamily, FontSize } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Link from "@tiptap/extension-link";

import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    Strikethrough,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    List,
    ListOrdered,
    Quote,
    Table as TableIcon,
    Plus,
    Trash2,
    Link as LinkIcon,
    Unlink,
    Baseline,
    Highlighter,
    Check,
    RotateCcw,
    Mic,
    MicOff,
    PenTool,
    BarChart3,
    ChevronDown,
    Maximize2,
    Minimize2,
    FileSpreadsheet,
    Grid,
    Eraser,
    Sparkles,
    ArrowUp,
    ArrowDown,
    MoveVertical,
    Eye,
    Edit3,
    Move,
    Maximize,
    CheckCircle2,
    Zap,
    FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
    getAnomalyZonePriorityTableTemplate,
    getIncompleteScopeTableTemplate,
    getCompletedScopeTableTemplate,
    getAnodeDepletionTableTemplate,
    getAnomalyDefectTypeTableTemplate
} from "./template-utils";

// Custom Table with Width and Alignment Attributes
const CustomTable = Table.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            tableWidth: {
                default: "100%",
                parseHTML: (element) => element.getAttribute("data-width") || element.style.width || "100%",
                renderHTML: (attributes) => {
                    const width = attributes.tableWidth || "100%";
                    const align = attributes.tableAlign || "center";
                    let margin = "1em 0";
                    if (align === "center") margin = "1em auto";
                    else if (align === "right") margin = "1em 0 1em auto";
                    else if (align === "left") margin = "1em auto 1em 0";
                    return {
                        "data-width": width,
                        "data-align": align,
                        style: `width: ${width} !important; margin: ${margin} !important; max-width: 100% !important;`,
                    };
                },
            },
            tableAlign: {
                default: "center",
                parseHTML: (element) => element.getAttribute("data-align") || "center",
                renderHTML: (attributes) => ({
                    "data-align": attributes.tableAlign || "center",
                }),
            },
        };
    },
});

// Custom TableCell with Background Shading
const CustomTableCell = TableCell.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            backgroundColor: {
                default: null,
                parseHTML: (element) => element.style.backgroundColor || null,
                renderHTML: (attributes) => {
                    if (!attributes.backgroundColor) return {};
                    return { style: `background-color: ${attributes.backgroundColor}` };
                },
            },
        };
    },
});

// Color Palettes
const FONT_COLORS = [
    { label: "Default", color: "inherit" },
    { label: "Brand Navy", color: "#074e88" },
    { label: "Dark Slate", color: "#1e293b" },
    { label: "P1 Red (Critical)", color: "#dc2626" },
    { label: "P2 Orange (Major)", color: "#ea580c" },
    { label: "P3 Yellow (Moderate)", color: "#ca8a04" },
    { label: "Closed Green", color: "#16a34a" },
    { label: "Info Blue", color: "#2563eb" },
    { label: "Black", color: "#000000" },
];

const HIGHLIGHT_COLORS = [
    { label: "Yellow Caution", color: "#fef08a" },
    { label: "Red Warning", color: "#fecaca" },
    { label: "Orange Alert", color: "#fed7aa" },
    { label: "Green Closed", color: "#bbf7d0" },
    { label: "Blue Info", color: "#bfdbfe" },
    { label: "Purple Note", color: "#e9d5ff" },
    { label: "Light Slate", color: "#f1f5f9" },
];

const CELL_BG_COLORS = [
    { label: "None", color: "" },
    { label: "Light Slate", color: "#f8fafc" },
    { label: "P1 Red Tint", color: "#fee2e2" },
    { label: "P2 Orange Tint", color: "#ffedd5" },
    { label: "P3 Yellow Tint", color: "#fef3c7" },
    { label: "Green Tint", color: "#dcfce7" },
    { label: "Blue Tint", color: "#e0f2fe" },
];

const FONT_FAMILIES = [
    { label: "Default Font", value: "" },
    { label: "Arial", value: "Arial, Helvetica, sans-serif" },
    { label: "Calibri", value: "Calibri, Candara, Segoe, sans-serif" },
    { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
    { label: "Inter", value: "Inter, system-ui, sans-serif" },
    { label: "Courier New", value: "'Courier New', Courier, monospace" },
];

const FONT_SIZES = [
    { label: "11px", value: "11px" },
    { label: "12px", value: "12px" },
    { label: "14px (Normal)", value: "14px" },
    { label: "16px (Medium)", value: "16px" },
    { label: "18px (Large)", value: "18px" },
    { label: "20px (Title)", value: "20px" },
    { label: "24px (Header)", value: "24px" },
];

// Dynamic Variables Registry for Dynamic Data Auto-update
const DYNAMIC_VARIABLES = [
    {
        category: "Structure & Location",
        items: [
            { tag: "{{PLATFORM_NAME}}", label: "Platform Name (e.g. Bokor-A Drilling)" },
            { tag: "{{FIELD_NAME}}", label: "Field Name (e.g. Bokor Field)" },
            { tag: "{{LOCATION}}", label: "Offshore Region / Location (e.g. Sarawak)" },
            { tag: "{{JOB_PACK_NAME}}", label: "Job Pack Name / Code" },
            { tag: "{{REPORT_NO}}", label: "SOW Report Number" },
            { tag: "{{CONTRACT_NO}}", label: "Contract Reference Number" },
        ]
    },
    {
        category: "Operations & Dates",
        items: [
            { tag: "{{START_DATE}}", label: "Inspection Start Date" },
            { tag: "{{END_DATE}}", label: "Inspection End Date" },
            { tag: "{{VESSEL_NAME}}", label: "Vessel Name (e.g. DSV Resolution)" },
            { tag: "{{VESSELS_INVOLVED}}", label: "All Mobilized Vessels" },
            { tag: "{{TODAY_SHORT}}", label: "Current Date (e.g. 04-Nov-2026)" },
            { tag: "{{INSPECTION_YEAR}}", label: "Campaign Year (e.g. 2026)" },
        ]
    },
    {
        category: "Companies & Personnel",
        items: [
            { tag: "{{CLIENT_NAME}}", label: "Client Operator (e.g. PETRONAS Carigali)" },
            { tag: "{{CLIENT_SHORT}}", label: "Client Code (e.g. PCSB)" },
            { tag: "{{CONTRACTOR}}", label: "Contractor Name (e.g. Alam Maritim)" },
            { tag: "{{COMPANY_REP}}", label: "Client Representative" },
        ]
    },
    {
        category: "Inspection Integrity Metrics",
        items: [
            { tag: "{{TOTAL_ANOMALIES}}", label: "Total Anomalies Found" },
            { tag: "{{P1_ANOMALIES}}", label: "Priority 1 (Critical) Count" },
            { tag: "{{P2_ANOMALIES}}", label: "Priority 2 (Major) Count" },
            { tag: "{{P3_ANOMALIES}}", label: "Priority 3 (Moderate) Count" },
            { tag: "{{OPEN_ANOMALIES}}", label: "Outstanding / Open Anomalies" },
            { tag: "{{RECTIFIED_ANOMALIES}}", label: "Rectified / Closed Anomalies" },
            { tag: "{{SOW_COMPLETION}}", label: "SOW Scope Completion %" },
            { tag: "{{TOTAL_RECORDS}}", label: "Total Inspection Tasks" },
            { tag: "{{CP_MIN}}", label: "Minimum CP Reading (mV)" },
            { tag: "{{CP_MAX}}", label: "Maximum CP Reading (mV)" },
            { tag: "{{MGI_MAX}}", label: "Maximum Marine Growth (mm)" },
            { tag: "{{MGI_AVG}}", label: "Average Marine Growth (mm)" },
            { tag: "{{SCOUR_EXPOSED}}", label: "Exposed Piles Count" },
        ]
    },
    {
        category: "Smart Inspection Tables (Live Auto-Generated)",
        items: [
            { tag: "{{TABLE_ANOMALY_ZONE_PRIORITY}}", label: "1. Anomaly Breakdown Table (Zone, Component, P1-P3)" },
            { tag: "{{TABLE_INCOMPLETE_SCOPE}}", label: "2. Incomplete Tasks Status Table (Counts & Types)" },
            { tag: "{{TABLE_COMPLETED_SCOPE}}", label: "3. Completed Scope Summary Table (100% Status)" },
            { tag: "{{TABLE_ANODE_DEPLETION}}", label: "4. Anode Depletion Status Table (<25%, 26-50%, etc.)" },
            { tag: "{{TABLE_ANOMALY_BY_DEFECT_TYPE}}", label: "5. Anomaly Defect Type Matrix Table" },
        ]
    }
];

interface ExecutiveRichEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    sectionTitle?: string;
    readOnly?: boolean;
    statsContext?: any;
    showDynamicFields?: boolean;
    minHeight?: string;
    className?: string;
}

export function ExecutiveRichEditor({
    value,
    onChange,
    placeholder = "Enter executive summary findings...",
    sectionTitle = "",
    readOnly = false,
    statsContext,
    showDynamicFields = true,
    minHeight = "240px",
    className = "",
}: ExecutiveRichEditorProps) {
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isPreviewMode, setIsPreviewMode] = useState(false);

    // Hyperlink modal state
    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState("");

    // Digital signature modal state
    const [sigModalOpen, setSigModalOpen] = useState(false);
    const [signerName, setSignerName] = useState("");
    const [signerRole, setSignerRole] = useState("Offshore Inspection Engineer");
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // Chart insert modal state
    const [chartModalOpen, setChartModalOpen] = useState(false);
    const [chartType, setChartType] = useState<"priority" | "status" | "metrics">("priority");

    // Speech-to-text state
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    // Color picker custom states
    const [customFontColor, setCustomFontColor] = useState("#074e88");
    const [customHighlightColor, setCustomHighlightColor] = useState("#fef08a");

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3],
                },
            }),
            Underline,
            TextAlign.configure({
                types: ["heading", "paragraph"],
            }),
            TextStyle,
            FontFamily,
            FontSize,
            Color,
            Highlight.configure({
                multicolor: true,
            }),
            CustomTable.configure({
                resizable: true,
            }),
            TableRow,
            CustomTableCell,
            TableHeader,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    target: "_blank",
                    rel: "noopener noreferrer",
                    class: "text-blue-600 underline font-medium hover:text-blue-800",
                },
            }),
        ],
        content: value || "",
        editable: !readOnly,
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            onChange(html);
        },
    });

    // Synchronize content when external value changes
    useEffect(() => {
        if (!editor) return;
        const currentHtml = editor.getHTML();
        if (value !== currentHtml && (value || "") !== (currentHtml === "<p></p>" ? "" : currentHtml)) {
            const formatted = value && !value.includes("<") && !value.includes(">")
                ? value.split("\n\n").map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("")
                : value || "";
            editor.commands.setContent(formatted, { emitUpdate: false });
        }
    }, [value, editor]);

    // Cleanup speech recognition on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort();
                } catch {}
                recognitionRef.current = null;
            }
        };
    }, []);

    const toggleListening = () => {
        if (isListening) {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch {}
            }
            setIsListening(false);
            toast.info("Voice dictation stopped");
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast.error("Voice recognition is not supported in this browser. Please use Chrome or Edge.");
            return;
        }

        try {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = false;
            recognition.lang = "en-US";

            recognition.onresult = (event: any) => {
                const transcript = Array.from(event.results)
                    .slice(event.resultIndex)
                    .map((result: any) => result[0].transcript)
                    .join(" ");

                if (transcript && editor) {
                    editor.chain().focus().insertContent(` ${transcript} `).run();
                }
            };

            recognition.onerror = (event: any) => {
                // Use warn instead of error to avoid Next.js dev error overlay
                console.warn("[SpeechRecognition] event status:", event.error);
                setIsListening(false);
                if (event.error === "not-allowed") {
                    toast.error("Microphone access denied. Please allow microphone permissions in your browser.");
                } else if (event.error !== "no-speech" && event.error !== "aborted") {
                    toast.info(`Voice dictation status: ${event.error}`);
                }
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current = recognition;
            recognition.start();
            setIsListening(true);
            toast.success("Listening... Speak clearly into your microphone.");
        } catch (e: any) {
            console.warn("[SpeechRecognition] Initialization error:", e);
            setIsListening(false);
            toast.error("Could not start voice recognition. Please verify microphone access.");
        }
    };

    // Table helper functions
    const insertTable = (rows = 3, cols = 3) => {
        if (!editor) return;
        editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    };

    // Table Width Presets (100%, 85%, 75%, 60%, 50%) & Alignment
    const setTableWidth = (width: string, align?: string, resetCols: boolean = true) => {
        if (!editor) return;
        editor.chain().focus().command(({ tr, state, dispatch }) => {
            const { $from } = state.selection;
            for (let d = $from.depth; d > 0; d--) {
                if ($from.node(d).type.name === "table") {
                    const tablePos = $from.before(d);
                    const tableNode = $from.node(d);
                    const currentAttrs = tableNode.attrs;
                    const newAlign = align || currentAttrs.tableAlign || "center";
                    if (dispatch) {
                        tr.setNodeMarkup(tablePos, undefined, {
                            ...currentAttrs,
                            tableWidth: width,
                            tableAlign: newAlign,
                        });

                        // Clear fixed pixel colwidth on cells so columns adapt smoothly to new table width
                        if (resetCols) {
                            tableNode.descendants((node, pos) => {
                                if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
                                    if (node.attrs.colwidth) {
                                        tr.setNodeMarkup(tablePos + 1 + pos, undefined, {
                                            ...node.attrs,
                                            colwidth: null,
                                        });
                                    }
                                }
                            });
                        }
                    }
                    return true;
                }
            }
            return false;
        }).run();
        toast.info(`Table width set to ${width}`);
    };

    // Move Table Up / Down in document
    const moveTable = (direction: "up" | "down") => {
        if (!editor) return;
        const success = editor.chain().focus().command(({ tr, state, dispatch }) => {
            const { $from } = state.selection;
            let tableDepth = -1;
            for (let d = $from.depth; d > 0; d--) {
                if ($from.node(d).type.name === "table") {
                    tableDepth = d;
                    break;
                }
            }
            if (tableDepth === -1) return false;

            const tableNode = $from.node(tableDepth);
            const tableStart = $from.before(tableDepth);
            const tableEnd = $from.after(tableDepth);

            const indexInParent = $from.index(tableDepth - 1);
            const parent = $from.node(tableDepth - 1);

            if (direction === "up") {
                if (indexInParent === 0) {
                    toast.info("Table is already at the top");
                    return false;
                }
                const prevNode = parent.child(indexInParent - 1);
                const prevSize = prevNode.nodeSize;
                const targetPos = tableStart - prevSize;

                if (dispatch) {
                    tr.delete(tableStart, tableEnd);
                    tr.insert(targetPos, tableNode);
                }
                return true;
            } else {
                if (indexInParent >= parent.childCount - 1) {
                    toast.info("Table is already at the bottom");
                    return false;
                }
                const nextNode = parent.child(indexInParent + 1);
                const nextSize = nextNode.nodeSize;
                const targetPos = tableStart + nextSize;

                if (dispatch) {
                    tr.delete(tableStart, tableEnd);
                    tr.insert(targetPos, tableNode);
                }
                return true;
            }
        }).run();

        if (success) {
            toast.success(`Table moved ${direction}`);
        }
    };

    // Helper to evaluate dynamic tags in HTML string for live preview
    const evaluateDynamicTags = (htmlContent: string, context: any): string => {
        if (!htmlContent) return '<p class="text-slate-400 italic">No content written yet.</p>';
        return htmlContent.replace(/\{\{?([A-Za-z0-9_]+)\}?\}/g, (match, tag) => {
            const upper = tag.toUpperCase();
            if (context && context[upper] !== undefined && context[upper] !== null && context[upper] !== "") {
                return `<span class="inline-flex items-center px-1.5 py-0.5 rounded font-semibold text-xs bg-blue-100 text-blue-900 dark:bg-blue-900/80 dark:text-blue-100 border border-blue-300 dark:border-blue-700 mx-0.5 shadow-2xs" title="Dynamic Field: ${tag}">${context[upper]}</span>`;
            }
            if (context && context[tag] !== undefined && context[tag] !== null && context[tag] !== "") {
                return `<span class="inline-flex items-center px-1.5 py-0.5 rounded font-semibold text-xs bg-blue-100 text-blue-900 dark:bg-blue-900/80 dark:text-blue-100 border border-blue-300 dark:border-blue-700 mx-0.5 shadow-2xs" title="Dynamic Field: ${tag}">${context[tag]}</span>`;
            }
            return `<span class="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-xs bg-amber-50 text-amber-800 border border-amber-300 mx-0.5" title="Tag not yet assigned in database">${match}</span>`;
        });
    };

    // Hyperlink functions
    const openLinkModal = () => {
        if (!editor) return;
        const prevUrl = editor.getAttributes("link").href || "";
        setLinkUrl(prevUrl);
        setLinkModalOpen(true);
    };

    const applyLink = () => {
        if (!editor) return;
        if (linkUrl.trim() === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
        } else {
            const formatted = linkUrl.startsWith("http://") || linkUrl.startsWith("https://") || linkUrl.startsWith("mailto:")
                ? linkUrl
                : `https://${linkUrl}`;
            editor.chain().focus().extendMarkRange("link").setLink({ href: formatted }).run();
        }
        setLinkModalOpen(false);
    };

    // Canvas Drawing for Digital Signature
    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
        setIsDrawing(true);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.strokeStyle = "#0b2c4d";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const insertDigitalSignature = () => {
        if (!editor) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const sigDataUrl = canvas.toDataURL("image/png");
        const dateStr = new Date().toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });

        const sigHtml = `
            <table style="border: 1px solid #cbd5e1; border-radius: 8px; margin: 12px 0; background-color: #f8fafc; width: 340px; border-collapse: separate; padding: 8px 12px;">
                <tr>
                    <td style="border: none; padding: 4px 0;">
                        <img src="${sigDataUrl}" alt="Digital Signature" style="height: 48px; max-width: 280px; object-fit: contain; display: block;" />
                    </td>
                </tr>
                <tr>
                    <td style="border: none; border-top: 1px solid #e2e8f0; padding-top: 6px;">
                        <div style="font-size: 12px; font-weight: bold; color: #0f172a;">${signerName || "Authorized Inspector"}</div>
                        <div style="font-size: 11px; color: #64748b;">${signerRole} &bull; ${dateStr}</div>
                        <div style="font-size: 9px; color: #94a3b8; font-family: monospace;">DIGITAL VERIFIED OFFSHORE ENTRY</div>
                    </td>
                </tr>
            </table>
            <p></p>
        `;

        editor.chain().focus().insertContent(sigHtml).run();
        setSigModalOpen(false);
        clearSignature();
    };

    // Insert Chart Visuals
    const insertChartBlock = () => {
        if (!editor) return;

        let chartHtml = "";
        const now = new Date().toLocaleDateString("en-GB");

        if (chartType === "priority") {
            chartHtml = `
                <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin: 16px 0; background-color: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="font-size: 13px; font-weight: bold; color: #0b2c4d; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                        <span>ANOMALY PRIORITY BREAKDOWN</span>
                        <span style="font-size: 10px; color: #64748b; font-weight: normal;">As of ${now}</span>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                        <thead>
                            <tr style="background-color: #f1f5f9; text-align: left;">
                                <th style="border: 1px solid #cbd5e1; padding: 6px 10px;">Classification</th>
                                <th style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 80px; text-align: center;">Total</th>
                                <th style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 90px; text-align: center;">Open</th>
                                <th style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 90px; text-align: center;">Rectified</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: bold; color: #dc2626;"><span style="display:inline-block;width:8px;height:8px;background:#dc2626;border-radius:2px;margin-right:6px;"></span>Priority 1 (Critical)</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; font-weight: bold;">0</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; color: #dc2626;">0</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; color: #16a34a;">0</td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: bold; color: #ea580c;"><span style="display:inline-block;width:8px;height:8px;background:#ea580c;border-radius:2px;margin-right:6px;"></span>Priority 2 (Major)</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; font-weight: bold;">0</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; color: #ea580c;">0</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; color: #16a34a;">0</td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: bold; color: #ca8a04;"><span style="display:inline-block;width:8px;height:8px;background:#ca8a04;border-radius:2px;margin-right:6px;"></span>Priority 3 (Moderate)</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; font-weight: bold;">0</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; color: #ca8a04;">0</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; color: #16a34a;">0</td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: bold; color: #16a34a;"><span style="display:inline-block;width:8px;height:8px;background:#16a34a;border-radius:2px;margin-right:6px;"></span>Observations</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; font-weight: bold;">0</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; color: #64748b;">-</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; color: #16a34a;">-</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p></p>
            `;
        } else if (chartType === "status") {
            chartHtml = `
                <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin: 16px 0; background-color: #f8fafc;">
                    <div style="font-size: 13px; font-weight: bold; color: #0b2c4d; margin-bottom: 8px;">INSPECTION COMPLETION PROGRESS</div>
                    <div style="display: flex; gap: 12px; margin-bottom: 8px;">
                        <div style="flex: 1; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; text-align: center;">
                            <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Planned Tasks</div>
                            <div style="font-size: 18px; font-weight: bold; color: #074e88;">100%</div>
                        </div>
                        <div style="flex: 1; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; text-align: center;">
                            <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Completed</div>
                            <div style="font-size: 18px; font-weight: bold; color: #16a34a;">100%</div>
                        </div>
                        <div style="flex: 1; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; text-align: center;">
                            <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Outstanding</div>
                            <div style="font-size: 18px; font-weight: bold; color: #ea580c;">0</div>
                        </div>
                    </div>
                </div>
                <p></p>
            `;
        } else {
            chartHtml = `
                <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin: 16px 0; background-color: #ffffff;">
                    <div style="font-size: 12px; font-weight: bold; color: #074e88; margin-bottom: 6px;">CATHODIC PROTECTION (CP) INTEGRITY METRIC</div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        <tr style="background: #f8fafc;">
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">Criteria</td>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px;">-800 mV to -1050 mV (Ag/AgCl)</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">Overall Status</td>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px; color: #16a34a; font-weight: bold;">SATISFACTORY CATHODIC PROTECTION</td>
                        </tr>
                    </table>
                </div>
                <p></p>
            `;
        }

        editor.chain().focus().insertContent(chartHtml).run();
        setChartModalOpen(false);
    };

    if (!editor) return null;

    const currentFontColor = editor.getAttributes("textStyle").color;
    const currentHighlight = editor.getAttributes("highlight").color;
    const currentFamily = editor.getAttributes("textStyle").fontFamily;
    const currentSize = editor.getAttributes("textStyle").fontSize;

    return (
        <div
            className={`
                flex flex-col border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 overflow-hidden transition-all
                ${isFullScreen ? "fixed inset-4 z-50 shadow-2xl" : "h-full grow"}
                ${className}
            `}
        >
            {/* ══════════ TOP FORMATTING TOOLBAR ══════════ */}
            <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 select-none">
                {/* 1. Heading Selector */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-semibold gap-1 hover:bg-slate-200/60 dark:hover:bg-slate-800">
                            {editor.isActive("heading", { level: 1 })
                                ? "Heading 1"
                                : editor.isActive("heading", { level: 2 })
                                ? "Heading 2"
                                : editor.isActive("heading", { level: 3 })
                                ? "Heading 3"
                                : "Paragraph"}
                            <ChevronDown className="h-3 w-3 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-36">
                        <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()}>
                            Paragraph
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className="font-bold text-base">
                            Heading 1
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className="font-semibold text-sm">
                            Heading 2
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className="font-medium text-xs">
                            Heading 3
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* 2. Font Family Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1 hover:bg-slate-200/60 dark:hover:bg-slate-800">
                            <span className="truncate max-w-[80px]">
                                {FONT_FAMILIES.find((f) => f.value === currentFamily)?.label || "Font"}
                            </span>
                            <ChevronDown className="h-3 w-3 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-44">
                        {FONT_FAMILIES.map((font) => (
                            <DropdownMenuItem
                                key={font.label}
                                onClick={() => {
                                    if (font.value) {
                                        (editor.chain().focus() as any).setFontFamily(font.value).run();
                                    } else {
                                        (editor.chain().focus() as any).unsetFontFamily().run();
                                    }
                                }}
                                style={{ fontFamily: font.value || undefined }}
                                className="text-xs"
                            >
                                {font.label}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* 3. Font Size Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1 hover:bg-slate-200/60 dark:hover:bg-slate-800">
                            <span className="truncate max-w-[60px]">
                                {FONT_SIZES.find((s) => s.value === currentSize)?.label || "Size"}
                            </span>
                            <ChevronDown className="h-3 w-3 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-32">
                        {FONT_SIZES.map((size) => (
                            <DropdownMenuItem
                                key={size.value}
                                onClick={() => (editor.chain().focus() as any).setFontSize(size.value).run()}
                                className="text-xs"
                            >
                                {size.label}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                <Separator orientation="vertical" className="h-5 mx-1" />

                {/* 4. Bold, Italic, Underline, Strike */}
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${editor.isActive("bold") ? "bg-slate-200 dark:bg-slate-800 text-blue-600 font-bold" : ""}`}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    title="Bold (Ctrl+B)"
                >
                    <Bold className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${editor.isActive("italic") ? "bg-slate-200 dark:bg-slate-800 text-blue-600" : ""}`}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    title="Italic (Ctrl+I)"
                >
                    <Italic className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${editor.isActive("underline") ? "bg-slate-200 dark:bg-slate-800 text-blue-600" : ""}`}
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    title="Underline (Ctrl+U)"
                >
                    <UnderlineIcon className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${editor.isActive("strike") ? "bg-slate-200 dark:bg-slate-800 text-blue-600" : ""}`}
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    title="Strikethrough"
                >
                    <Strikethrough className="h-4 w-4" />
                </Button>

                <Separator orientation="vertical" className="h-5 mx-1" />

                {/* 5. Font Color Popover */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 px-2 gap-1" title="Font Color">
                            <Baseline className="h-4 w-4" style={{ color: currentFontColor || "#0f172a" }} />
                            <div
                                className="w-3.5 h-1 rounded-sm border border-slate-300"
                                style={{ backgroundColor: currentFontColor || "#0f172a" }}
                            />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-3 space-y-3" align="start">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Text Color</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().unsetColor().run()}
                                className="h-6 text-xs px-2 text-slate-400 hover:text-slate-700 gap-1"
                            >
                                <RotateCcw className="h-3 w-3" /> Reset
                            </Button>
                        </div>
                        <div className="grid grid-cols-5 gap-1.5">
                            {FONT_COLORS.map(({ label, color }) => (
                                <button
                                    key={color}
                                    type="button"
                                    title={label}
                                    onClick={() => editor.chain().focus().setColor(color === "inherit" ? "" : color).run()}
                                    className="w-8 h-7 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-transform hover:scale-110 shadow-xs"
                                    style={{ backgroundColor: color === "inherit" ? "#ffffff" : color }}
                                >
                                    {currentFontColor === color && (
                                        <Check className={`h-3 w-3 ${color === "#ffffff" || color === "inherit" ? "text-slate-800" : "text-white"}`} />
                                    )}
                                </button>
                            ))}
                        </div>
                        <Separator />
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={customFontColor}
                                onChange={(e) => {
                                    setCustomFontColor(e.target.value);
                                    editor.chain().focus().setColor(e.target.value).run();
                                }}
                                className="w-7 h-7 rounded border p-0 cursor-pointer"
                            />
                            <span className="text-xs text-slate-500">Custom Color</span>
                        </div>
                    </PopoverContent>
                </Popover>

                {/* 6. Background Highlight Popover */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 px-2 gap-1" title="Text Highlight">
                            <Highlighter className="h-4 w-4" style={{ color: currentHighlight || "#ca8a04" }} />
                            <div
                                className="w-3.5 h-1 rounded-sm border border-slate-300"
                                style={{ backgroundColor: currentHighlight || "transparent" }}
                            />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-3 space-y-3" align="start">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Highlight Tint</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().unsetHighlight().run()}
                                className="h-6 text-xs px-2 text-slate-400 hover:text-slate-700 gap-1"
                            >
                                <RotateCcw className="h-3 w-3" /> None
                            </Button>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                            {HIGHLIGHT_COLORS.map(({ label, color }) => (
                                <button
                                    key={color}
                                    type="button"
                                    title={label}
                                    onClick={() => editor.chain().focus().setHighlight({ color }).run()}
                                    className="w-10 h-7 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-transform hover:scale-110 shadow-xs"
                                    style={{ backgroundColor: color }}
                                >
                                    {currentHighlight === color && <Check className="h-3 w-3 text-slate-800" />}
                                </button>
                            ))}
                        </div>
                        <Separator />
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={customHighlightColor}
                                onChange={(e) => {
                                    setCustomHighlightColor(e.target.value);
                                    editor.chain().focus().setHighlight({ color: e.target.value }).run();
                                }}
                                className="w-7 h-7 rounded border p-0 cursor-pointer"
                            />
                            <span className="text-xs text-slate-500">Custom Tint</span>
                        </div>
                    </PopoverContent>
                </Popover>

                <Separator orientation="vertical" className="h-5 mx-1" />

                {/* 7. Paragraph Alignment */}
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${editor.isActive({ textAlign: "left" }) ? "bg-slate-200 dark:bg-slate-800 text-blue-600" : ""}`}
                    onClick={() => editor.chain().focus().setTextAlign("left").run()}
                    title="Align Left"
                >
                    <AlignLeft className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${editor.isActive({ textAlign: "center" }) ? "bg-slate-200 dark:bg-slate-800 text-blue-600" : ""}`}
                    onClick={() => editor.chain().focus().setTextAlign("center").run()}
                    title="Align Center"
                >
                    <AlignCenter className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${editor.isActive({ textAlign: "right" }) ? "bg-slate-200 dark:bg-slate-800 text-blue-600" : ""}`}
                    onClick={() => editor.chain().focus().setTextAlign("right").run()}
                    title="Align Right"
                >
                    <AlignRight className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${editor.isActive({ textAlign: "justify" }) ? "bg-slate-200 dark:bg-slate-800 text-blue-600" : ""}`}
                    onClick={() => editor.chain().focus().setTextAlign("justify").run()}
                    title="Justify"
                >
                    <AlignJustify className="h-4 w-4" />
                </Button>

                <Separator orientation="vertical" className="h-5 mx-1" />

                {/* 8. Lists & Quote */}
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${editor.isActive("bulletList") ? "bg-slate-200 dark:bg-slate-800 text-blue-600" : ""}`}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    title="Bullet List"
                >
                    <List className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${editor.isActive("orderedList") ? "bg-slate-200 dark:bg-slate-800 text-blue-600" : ""}`}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    title="Numbered List"
                >
                    <ListOrdered className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${editor.isActive("blockquote") ? "bg-slate-200 dark:bg-slate-800 text-blue-600" : ""}`}
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    title="Quote"
                >
                    <Quote className="h-4 w-4" />
                </Button>

                <Separator orientation="vertical" className="h-5 mx-1" />

                {/* 9. Table Controls Dropdown (With Column Resizing & Move/Width Helpers) */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={`h-8 px-2 gap-1 ${editor.isActive("table") ? "bg-blue-50 dark:bg-blue-900/40 text-blue-600" : ""}`}
                            title="Table Options"
                        >
                            <TableIcon className="h-4 w-4" />
                            <span className="text-xs">Table</span>
                            <ChevronDown className="h-3 w-3 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-72 max-h-[480px] overflow-y-auto">
                        {!editor.isActive("table") ? (
                            <>
                                <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Standard Tables
                                </DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => insertTable(3, 3)}>
                                    <Grid className="h-4 w-4 mr-2 text-blue-600" /> Insert 3 × 3 Table
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => insertTable(4, 4)}>
                                    <Grid className="h-4 w-4 mr-2 text-indigo-600" /> Insert 4 × 4 Table
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => insertTable(2, 2)}>
                                    <Grid className="h-4 w-4 mr-2 text-slate-600" /> Insert 2 × 2 Table
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-blue-600" /> Smart Inspection Tables
                                </DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => {
                                    editor.chain().focus().insertContent(getAnomalyZonePriorityTableTemplate()).run();
                                    toast.success("Inserted Table 1: Anomaly Breakdown by Zone & Priority");
                                }} className="cursor-pointer py-1.5">
                                    <BarChart3 className="h-4 w-4 mr-2 text-rose-500 shrink-0 mt-0.5" />
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">1. Anomaly Breakdown</span>
                                        <span className="text-[10px] text-slate-400">Zone, Component, P1-P3 Counts</span>
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                    editor.chain().focus().insertContent(getIncompleteScopeTableTemplate()).run();
                                    toast.success("Inserted Table 2: Incomplete Scope Status");
                                }} className="cursor-pointer py-1.5">
                                    <FileText className="h-4 w-4 mr-2 text-amber-500 shrink-0 mt-0.5" />
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">2. Incomplete Scope Status</span>
                                        <span className="text-[10px] text-slate-400">Inspection types, counts & reasons</span>
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                    editor.chain().focus().insertContent(getCompletedScopeTableTemplate()).run();
                                    toast.success("Inserted Table 3: Completed Scope Status");
                                }} className="cursor-pointer py-1.5">
                                    <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500 shrink-0 mt-0.5" />
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">3. Completed Scope Status</span>
                                        <span className="text-[10px] text-slate-400">Inspection types, 100% completion</span>
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                    editor.chain().focus().insertContent(getAnodeDepletionTableTemplate()).run();
                                    toast.success("Inserted Table 4: Anode Depletion Breakdown");
                                }} className="cursor-pointer py-1.5">
                                    <Zap className="h-4 w-4 mr-2 text-blue-500 shrink-0 mt-0.5" />
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">4. Anode Depletion Status</span>
                                        <span className="text-[10px] text-slate-400">Brackets: 0-25%, 26-50%, 51-75%, 76%+</span>
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                    editor.chain().focus().insertContent(getAnomalyDefectTypeTableTemplate()).run();
                                    toast.success("Inserted Table 5: Anomaly Defect Type Matrix");
                                }} className="cursor-pointer py-1.5">
                                    <Grid className="h-4 w-4 mr-2 text-indigo-500 shrink-0 mt-0.5" />
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">5. Anomaly Defect Matrix</span>
                                        <span className="text-[10px] text-slate-400">Defect type vs components & priorities</span>
                                    </div>
                                </DropdownMenuItem>
                            </>
                        ) : (
                            <>
                                <DropdownMenuItem onClick={() => editor.chain().focus().addRowBefore().run()}>
                                    <Plus className="h-3.5 w-3.5 mr-2" /> Add Row Above
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => editor.chain().focus().addRowAfter().run()}>
                                    <Plus className="h-3.5 w-3.5 mr-2" /> Add Row Below
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => editor.chain().focus().deleteRow().run()} className="text-red-600">
                                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Row
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => editor.chain().focus().addColumnBefore().run()}>
                                    <Plus className="h-3.5 w-3.5 mr-2" /> Add Column Before
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => editor.chain().focus().addColumnAfter().run()}>
                                    <Plus className="h-3.5 w-3.5 mr-2" /> Add Column After
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => editor.chain().focus().deleteColumn().run()} className="text-red-600">
                                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Column
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
                                    <FileSpreadsheet className="h-3.5 w-3.5 mr-2" /> Toggle Header Row
                                </DropdownMenuItem>

                                {/* Table Width & Alignment Options */}
                                <DropdownMenuSeparator />
                                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Table Width (Resize)
                                </div>
                                <div className="grid grid-cols-4 gap-1 px-2 pb-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setTableWidth("100%", "center", true)}
                                        className="h-6 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center font-medium"
                                        title="Full Width 100%"
                                    >
                                        100%
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTableWidth("85%", "center", true)}
                                        className="h-6 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center font-medium"
                                        title="Width 85%"
                                    >
                                        85%
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTableWidth("75%", "center", true)}
                                        className="h-6 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center font-medium"
                                        title="Centered Width 75%"
                                    >
                                        75%
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTableWidth("50%", "center", true)}
                                        className="h-6 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center font-medium"
                                        title="Compact Width 50%"
                                    >
                                        50%
                                    </button>
                                </div>

                                {/* Table Movement (Move Up / Down) */}
                                <DropdownMenuSeparator />
                                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Table Position (Move)
                                </div>
                                <DropdownMenuItem onClick={() => moveTable("up")}>
                                    <ArrowUp className="h-3.5 w-3.5 mr-2 text-blue-600" /> Move Table Up
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => moveTable("down")}>
                                    <ArrowDown className="h-3.5 w-3.5 mr-2 text-blue-600" /> Move Table Down
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                    editor.chain().focus().command(({ tr, state, dispatch }) => {
                                        const { $from } = state.selection;
                                        for (let d = $from.depth; d > 0; d--) {
                                            if ($from.node(d).type.name === 'table') {
                                                const pos = $from.before(d);
                                                if (dispatch) tr.insert(pos, state.schema.nodes.paragraph.create());
                                                return true;
                                            }
                                        }
                                        return false;
                                    }).run();
                                }}>
                                    <MoveVertical className="h-3.5 w-3.5 mr-2 text-slate-500" /> Insert Space Above Table
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                    editor.chain().focus().command(({ tr, state, dispatch }) => {
                                        const { $from } = state.selection;
                                        for (let d = $from.depth; d > 0; d--) {
                                            if ($from.node(d).type.name === 'table') {
                                                const pos = $from.after(d);
                                                if (dispatch) tr.insert(pos, state.schema.nodes.paragraph.create());
                                                return true;
                                            }
                                        }
                                        return false;
                                    }).run();
                                }}>
                                    <MoveVertical className="h-3.5 w-3.5 mr-2 text-slate-500" /> Insert Space Below Table
                                </DropdownMenuItem>
                                
                                {/* Cell Shading Submenu */}
                                <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                                    <span className="text-[11px] font-semibold text-slate-500 uppercase block mb-1.5">Cell Shading</span>
                                    <div className="grid grid-cols-4 gap-1">
                                        {CELL_BG_COLORS.map(({ label, color }) => (
                                            <button
                                                key={label}
                                                type="button"
                                                title={label}
                                                onClick={() => editor.chain().focus().setCellAttribute("backgroundColor", color).run()}
                                                className="h-6 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[9px]"
                                                style={{ backgroundColor: color || "#ffffff" }}
                                            >
                                                {!color ? "None" : ""}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => editor.chain().focus().deleteTable().run()} className="text-red-600 font-semibold">
                                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Entire Table
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

                <Separator orientation="vertical" className="h-5 mx-1" />

                {/* 10. Dynamic Fields Dropdown (Auto-updates when printing/exporting) */}
                {showDynamicFields && (
                    <>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 px-2 gap-1.5 text-xs text-blue-700 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100 font-semibold border border-blue-200/60 dark:border-blue-900" 
                                    title="Insert Dynamic Field Tag (Auto-updates with live data when printing)"
                                >
                                    <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                    <span>{"{x}"} Dynamic Field</span>
                                    <ChevronDown className="h-3 w-3 opacity-60" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-80 max-h-96 overflow-y-auto">
                                <div className="p-2 border-b bg-slate-50 dark:bg-slate-900 text-[11px] text-slate-600 dark:text-slate-300">
                                    <strong>Dynamic Data Variables:</strong>
                                    <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                                        These tags automatically pull live data from the database when generating or printing the report.
                                    </p>
                                </div>
                                {DYNAMIC_VARIABLES.map((cat) => (
                                    <div key={cat.category} className="py-1">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 bg-slate-50/50 dark:bg-slate-900/50">
                                            {cat.category}
                                        </div>
                                        {cat.items.map((item) => (
                                            <DropdownMenuItem
                                                key={item.tag}
                                                onClick={() => {
                                                    editor.chain().focus().insertContent(` ${item.tag} `).run();
                                                    toast.info(`Inserted dynamic field ${item.tag}`);
                                                }}
                                                className="flex flex-col items-start gap-0.5 cursor-pointer text-xs py-1.5"
                                            >
                                                <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{item.tag}</span>
                                                <span className="text-[10px] text-slate-500">{item.label}</span>
                                            </DropdownMenuItem>
                                        ))}
                                    </div>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Separator orientation="vertical" className="h-5 mx-1" />
                    </>
                )}

                {/* 11. Hyperlink Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${editor.isActive("link") ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50" : ""}`}
                    onClick={openLinkModal}
                    title="Insert Link"
                >
                    <LinkIcon className="h-4 w-4" />
                </Button>

                {/* 12. Chart Visual Block Button */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 gap-1.5 text-xs text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                    onClick={() => setChartModalOpen(true)}
                    title="Insert Inspection Chart / Summary Card"
                >
                    <BarChart3 className="h-4 w-4" />
                    <span>Chart</span>
                </Button>

                {/* 13. Digital Signature Button */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 gap-1.5 text-xs text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                    onClick={() => setSigModalOpen(true)}
                    title="Insert Digital Signature"
                >
                    <PenTool className="h-4 w-4" />
                    <span>Signature</span>
                </Button>

                {/* 14. Voice Dictation Button */}
                <Button
                    variant="ghost"
                    size="sm"
                    className={`h-8 px-2 gap-1.5 text-xs transition-colors ${
                        isListening
                            ? "bg-red-500 text-white animate-pulse hover:bg-red-600"
                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/60"
                    }`}
                    onClick={toggleListening}
                    title={isListening ? "Stop Voice Recognition" : "Start Voice Recognition"}
                >
                    {isListening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-slate-400" />}
                    <span>{isListening ? "Listening..." : "Dictate"}</span>
                </Button>

                {/* 14b. Live Tag Preview Toggle */}
                <Button
                    variant={isPreviewMode ? "default" : "outline"}
                    size="sm"
                    className={`h-8 px-2.5 gap-1.5 text-xs font-semibold transition-all ${
                        isPreviewMode
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                            : "text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/40 hover:bg-blue-100"
                    }`}
                    onClick={() => setIsPreviewMode(!isPreviewMode)}
                    title={isPreviewMode ? "Return to editor" : "Preview how dynamic tags resolve with live data"}
                >
                    {isPreviewMode ? <Edit3 className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    <span>{isPreviewMode ? "Edit Mode" : "Preview Tags"}</span>
                </Button>

                {/* 15. Clear Formatting */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 ml-auto"
                    onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
                    title="Clear Formatting"
                >
                    <Eraser className="h-4 w-4 text-slate-400 hover:text-slate-700" />
                </Button>

                {/* 16. Fullscreen Toggle */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setIsFullScreen(!isFullScreen)}
                    title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                    {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
            </div>

            {/* ══════════ ACTIVE TABLE MANAGEMENT STRIP ══════════ */}
            {editor.isActive("table") && (
                <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-blue-50/90 dark:bg-blue-950/60 border-b border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 animate-in fade-in slide-in-from-top-1 duration-150">
                    <span className="font-semibold flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
                        <TableIcon className="h-3.5 w-3.5" /> Full Table Size:
                    </span>
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded border border-blue-200 dark:border-blue-800 shadow-2xs">
                        {[
                            { label: "100% (Full)", width: "100%" },
                            { label: "85%", width: "85%" },
                            { label: "75% (Wide)", width: "75%" },
                            { label: "60%", width: "60%" },
                            { label: "50% (Half)", width: "50%" },
                        ].map(({ label, width }) => (
                            <button
                                key={width}
                                type="button"
                                onClick={() => setTableWidth(width, undefined, true)}
                                className={`px-2 py-0.5 text-[11px] rounded transition-colors font-medium ${
                                    (editor.getAttributes("table").tableWidth || "100%") === width
                                        ? "bg-blue-600 text-white font-bold"
                                        : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                                }`}
                                title={`Set table width to ${width}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <Separator orientation="vertical" className="h-4 mx-1 bg-blue-200 dark:bg-blue-800" />

                    <span className="font-semibold text-slate-600 dark:text-slate-400">Align:</span>
                    <div className="flex items-center gap-0.5 bg-white dark:bg-slate-900 p-0.5 rounded border border-blue-200 dark:border-blue-800 shadow-2xs">
                        <button
                            type="button"
                            onClick={() => setTableWidth(editor.getAttributes("table").tableWidth || "100%", "left", false)}
                            className={`p-1 rounded text-[11px] ${
                                (editor.getAttributes("table").tableAlign || "center") === "left"
                                    ? "bg-blue-600 text-white"
                                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                            }`}
                            title="Align Table Left"
                        >
                            <AlignLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setTableWidth(editor.getAttributes("table").tableWidth || "100%", "center", false)}
                            className={`p-1 rounded text-[11px] ${
                                (editor.getAttributes("table").tableAlign || "center") === "center"
                                    ? "bg-blue-600 text-white"
                                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                            }`}
                            title="Align Table Center"
                        >
                            <AlignCenter className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setTableWidth(editor.getAttributes("table").tableWidth || "100%", "right", false)}
                            className={`p-1 rounded text-[11px] ${
                                (editor.getAttributes("table").tableAlign || "center") === "right"
                                    ? "bg-blue-600 text-white"
                                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                            }`}
                            title="Align Table Right"
                        >
                            <AlignRight className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    <Separator orientation="vertical" className="h-4 mx-1 bg-blue-200 dark:bg-blue-800" />

                    <div className="flex items-center gap-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[11px] text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900 gap-1 font-medium"
                            onClick={() => moveTable("up")}
                            title="Move table above preceding paragraph"
                        >
                            <ArrowUp className="h-3 w-3" /> Move Up
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[11px] text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900 gap-1 font-medium"
                            onClick={() => moveTable("down")}
                            title="Move table below following paragraph"
                        >
                            <ArrowDown className="h-3 w-3" /> Move Down
                        </Button>
                    </div>

                    <div className="ml-auto text-[11px] text-blue-600/80 dark:text-blue-400 flex items-center gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[11px] text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900 font-medium"
                            onClick={() => setTableWidth(editor.getAttributes("table").tableWidth || "100%", undefined, true)}
                            title="Reset column widths to fit evenly"
                        >
                            Equalize Columns
                        </Button>
                        <span className="hidden sm:inline">• Columns drag-resizable</span>
                    </div>
                </div>
            )}

            {/* ══════════ MAIN CONTENT CANVAS ══════════ */}
            <div className="grow overflow-y-auto p-6 focus-within:ring-1 focus-within:ring-blue-500/20 cursor-text">
                <style jsx global>{`
                    .ProseMirror {
                        outline: none;
                        min-height: ${minHeight || "240px"};
                        font-family: inherit;
                        color: inherit;
                    }
                    .ProseMirror p {
                        margin-bottom: 0.75em;
                        line-height: 1.6;
                    }
                    .ProseMirror h1 {
                        font-size: 1.5rem;
                        font-weight: 700;
                        margin-top: 1.25em;
                        margin-bottom: 0.5em;
                        color: #0b2c4d;
                    }
                    .ProseMirror h2 {
                        font-size: 1.25rem;
                        font-weight: 600;
                        margin-top: 1em;
                        margin-bottom: 0.5em;
                        color: #074e88;
                    }
                    .ProseMirror h3 {
                        font-size: 1.1rem;
                        font-weight: 600;
                        margin-top: 0.75em;
                        margin-bottom: 0.25em;
                    }
                    .ProseMirror ul {
                        list-style-type: disc;
                        padding-left: 1.5rem;
                        margin-bottom: 0.75em;
                    }
                    .ProseMirror ol {
                        list-style-type: decimal;
                        padding-left: 1.5rem;
                        margin-bottom: 0.75em;
                    }
                    .ProseMirror blockquote {
                        border-left: 4px solid #3b82f6;
                        padding-left: 1rem;
                        margin-left: 0;
                        margin-right: 0;
                        font-style: italic;
                        color: #64748b;
                    }
                    .ProseMirror table {
                        border-collapse: collapse;
                        table-layout: fixed;
                        margin: 1.25em 0;
                        overflow: visible;
                        box-sizing: border-box;
                    }
                    .ProseMirror table:not([data-width]):not([style*="width"]) {
                        width: 100%;
                    }
                    .ProseMirror table[data-align="center"] {
                        margin-left: auto !important;
                        margin-right: auto !important;
                    }
                    .ProseMirror table[data-align="left"] {
                        margin-left: 0 !important;
                        margin-right: auto !important;
                    }
                    .ProseMirror table[data-align="right"] {
                        margin-left: auto !important;
                        margin-right: 0 !important;
                    }
                    .ProseMirror table td,
                    .ProseMirror table th {
                        min-width: 2em;
                        border: 1px solid #cbd5e1;
                        padding: 6px 10px;
                        vertical-align: top;
                        box-sizing: border-box;
                        position: relative;
                    }
                    .ProseMirror table th {
                        font-weight: bold;
                        text-align: left;
                        background-color: #f1f5f9;
                    }
                    .ProseMirror table .selectedCell:after {
                        z-index: 2;
                        position: absolute;
                        content: "";
                        left: 0; right: 0; top: 0; bottom: 0;
                        background: rgba(59, 130, 246, 0.15);
                        pointer-events: none;
                    }
                    .ProseMirror table .column-resize-handle {
                        position: absolute;
                        right: -2px;
                        top: 0;
                        bottom: -2px;
                        width: 4px;
                        background-color: #2563eb;
                        pointer-events: none;
                        z-index: 20;
                    }
                    .ProseMirror.resize-cursor {
                        cursor: col-resize;
                    }
                    .ProseMirror mark {
                        border-radius: 2px;
                        padding: 0.1em 0.2em;
                    }
                `}</style>

                {isPreviewMode ? (
                    <div className="space-y-4">
                        <div className="p-3 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
                                <div>
                                    <strong>Live Dynamic Tag Preview:</strong>
                                    <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400 mt-0.5">
                                        All tags (highlighted in blue) are dynamically evaluated with live database values. When printing or exporting, they will automatically populate.
                                    </p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setIsPreviewMode(false)}
                                className="h-7 text-xs bg-white dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-slate-700 shrink-0"
                            >
                                <Edit3 className="h-3.5 w-3.5 mr-1" /> Back to Editor
                            </Button>
                        </div>
                        <div
                            className="leading-relaxed text-slate-800 dark:text-slate-200"
                            dangerouslySetInnerHTML={{
                                __html: evaluateDynamicTags(editor.getHTML(), statsContext)
                            }}
                        />
                    </div>
                ) : (
                    <EditorContent editor={editor} />
                )}
            </div>

            {/* ══════════ FOOTER BAR (METRICS & VOICE STATUS) ══════════ */}
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {isListening && (
                        <div className="flex items-center gap-1.5 text-red-600 font-medium">
                            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                            <span>Voice dictation active</span>
                        </div>
                    )}
                    <span>Words: {editor.getText().trim() ? editor.getText().trim().split(/\s+/).length : 0}</span>
                    <span>Characters: {editor.getText().length}</span>
                    <span className="hidden sm:inline text-[11px] text-slate-400">
                        • Drag cell border to resize column • Use Table menu to resize or move table
                    </span>
                </div>
                <div className="text-slate-400">
                    {sectionTitle ? `Section: ${sectionTitle}` : "Executive Summary Section"}
                </div>
            </div>

            {/* ══════════ MODALS ══════════ */}

            {/* 1. HYPERLINK DIALOG */}
            <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Insert / Edit Hyperlink</DialogTitle>
                        <DialogDescription>
                            Enter destination URL for external specification, standard, or document link.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label htmlFor="link-url">URL</Label>
                            <Input
                                id="link-url"
                                placeholder="https://example.com/spec.pdf"
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex items-center justify-between sm:justify-between">
                        {editor.isActive("link") ? (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                    editor.chain().focus().unsetLink().run();
                                    setLinkModalOpen(false);
                                }}
                            >
                                <Unlink className="h-4 w-4 mr-1" /> Remove Link
                            </Button>
                        ) : <div />}
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setLinkModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button size="sm" onClick={applyLink}>
                                Apply Link
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 2. DIGITAL SIGNATURE DIALOG */}
            <Dialog open={sigModalOpen} onOpenChange={setSigModalOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <PenTool className="h-5 w-5 text-blue-600" />
                            Digital Inspection Signature
                        </DialogTitle>
                        <DialogDescription>
                            Draw your signature below using mouse or pen to embed an authorized verification block.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="border border-slate-300 dark:border-slate-700 rounded-lg bg-white overflow-hidden shadow-inner">
                            <canvas
                                ref={canvasRef}
                                width={440}
                                height={150}
                                className="w-full h-[150px] cursor-crosshair bg-slate-50/50"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                            />
                        </div>
                        <div className="flex justify-end">
                            <Button variant="ghost" size="sm" onClick={clearSignature} className="h-6 text-xs px-2 text-slate-500 hover:text-slate-800">
                                <RotateCcw className="h-3 w-3 mr-1" /> Clear Canvas
                            </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="signer-name" className="text-xs">Signer Full Name</Label>
                                <Input
                                    id="signer-name"
                                    placeholder="e.g. John Doe"
                                    value={signerName}
                                    onChange={(e) => setSignerName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="signer-role" className="text-xs">Position / Role</Label>
                                <Input
                                    id="signer-role"
                                    placeholder="e.g. Lead Inspection Engineer"
                                    value={signerRole}
                                    onChange={(e) => setSignerRole(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setSigModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={insertDigitalSignature} className="bg-blue-600 hover:bg-blue-700 text-white">
                            Insert Signature
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 3. CHART / METRIC VISUAL INSERT DIALOG */}
            <Dialog open={chartModalOpen} onOpenChange={setChartModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-indigo-600" />
                            Insert Integrity Summary Chart
                        </DialogTitle>
                        <DialogDescription>
                            Select a formatted data visualization block to insert into this executive section.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div
                            onClick={() => setChartType("priority")}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                chartType === "priority" ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20" : "border-slate-200 hover:bg-slate-50"
                            }`}
                        >
                            <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">Anomaly Priority Distribution</div>
                            <div className="text-xs text-slate-500">Structured table with P1, P2, P3 color-coded priority indicators and counts.</div>
                        </div>

                        <div
                            onClick={() => setChartType("status")}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                chartType === "status" ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20" : "border-slate-200 hover:bg-slate-50"
                            }`}
                        >
                            <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">Task Completion KPI Cards</div>
                            <div className="text-xs text-slate-500">Planned vs Complete vs Outstanding percentage scorecards.</div>
                        </div>

                        <div
                            onClick={() => setChartType("metrics")}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                chartType === "metrics" ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20" : "border-slate-200 hover:bg-slate-50"
                            }`}
                        >
                            <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">CP Potential Integrity Summary</div>
                            <div className="text-xs text-slate-500">Pass/Fail voltage threshold summary for Cathodic Protection.</div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setChartModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={insertChartBlock} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            Insert Block
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
