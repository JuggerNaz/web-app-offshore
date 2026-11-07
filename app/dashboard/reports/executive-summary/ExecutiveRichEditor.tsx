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
import { CellSelection, TableMap } from "@tiptap/pm/tables";

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
    TrendingUp,
    Activity,
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
    Merge,
    SquareSplitHorizontal,
    SquareSplitVertical,
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
    interpolateAllVariables,
    getAnomalyZonePriorityTableTemplate,
    getIncompleteScopeTableTemplate,
    getCompletedScopeTableTemplate,
    getAnodeDepletionTableTemplate,
    getAnomalyDefectTypeTableTemplate,
    getAnomalyPriorityChartTemplate,
    getScopeCompletionChartTemplate,
    getCpHealthChartTemplate,
    getAnodeDepletionChartTemplate,
    getDefectDistributionChartTemplate,
    buildLiveAnomalyZoneTable,
    buildLiveIncompleteScopeTable,
    buildLiveCompletedScopeTable,
    buildLiveAnodeDepletionTable,
    buildLiveAnomalyDefectTypeTable,
    buildLiveAnomalyPriorityChart,
    buildLiveScopeCompletionChart,
    buildLiveCpHealthChart,
    buildLiveAnodeDepletionChart,
    buildLiveDefectDistributionChart
} from "./template-utils";
import { EXECUTIVE_SUMMARY_TOC, normalizeSectionId } from "./constants";

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
    },
    {
        category: "Smart Inspection Charts (Live Auto-Generated)",
        items: [
            { tag: "{{CHART_ANOMALY_PRIORITY}}", label: "1. Anomaly Priority Distribution Bar Chart" },
            { tag: "{{CHART_SCOPE_COMPLETION}}", label: "2. SOW Completion & Scope Progress Chart" },
            { tag: "{{CHART_CP_STATUS}}", label: "3. CP Potential Integrity Health Chart" },
            { tag: "{{CHART_ANODE_DEPLETION}}", label: "4. Anode Depletion Distribution Chart" },
            { tag: "{{CHART_DEFECT_BREAKDOWN}}", label: "5. Defect Severity & Category Breakdown Chart" },
        ]
    }
];

interface ExecutiveRichEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    sectionTitle?: string;
    sectionId?: string;
    readOnly?: boolean;
    statsContext?: any;
    showDynamicFields?: boolean;
    isTemplateMode?: boolean;
    minHeight?: string;
    className?: string;
}

export function ExecutiveRichEditor({
    value,
    onChange,
    placeholder = "Enter executive summary findings...",
    sectionTitle = "",
    sectionId = "",
    readOnly = false,
    statsContext,
    showDynamicFields = true,
    isTemplateMode = false,
    minHeight = "240px",
    className = "",
}: ExecutiveRichEditorProps) {
    const effectiveSectionId = normalizeSectionId(sectionId || sectionTitle);

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
    const [chartType, setChartType] = useState<number>(1);

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
                link: false,
                underline: false,
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

    // Smart Inspection Tables Insertion:
    // If isTemplateMode is true -> inserts template with dynamic tags ({{P1_ANOMALIES}}, {{REPORT_NO}}, etc.)
    // If isTemplateMode is false (Summary Section) -> inserts table populated with live real campaign data
    const insertSmartTable = (tableIndex: 1 | 2 | 3 | 4 | 5) => {
        if (!editor) return;

        let content = "";
        let tableName = "";

        if (isTemplateMode) {
            // Template creation page: paste with dynamic variables & tags ({{...}})
            switch (tableIndex) {
                case 1:
                    content = getAnomalyZonePriorityTableTemplate();
                    tableName = "1. Anomaly Breakdown Template (Dynamic Tags)";
                    break;
                case 2:
                    content = getIncompleteScopeTableTemplate();
                    tableName = "2. Incomplete Scope Status Template (Dynamic Tags)";
                    break;
                case 3:
                    content = getCompletedScopeTableTemplate();
                    tableName = "3. Completed Scope Status Template (Dynamic Tags)";
                    break;
                case 4:
                    content = getAnodeDepletionTableTemplate();
                    tableName = "4. Anode Depletion Status Template (Dynamic Tags)";
                    break;
                case 5:
                    content = getAnomalyDefectTypeTableTemplate();
                    tableName = "5. Anomaly Defect Matrix Template (Dynamic Tags)";
                    break;
            }
        } else {
            // Summary section page: paste with actual real campaign/inspection data
            switch (tableIndex) {
                case 1:
                    content = buildLiveAnomalyZoneTable(statsContext, effectiveSectionId, sectionTitle);
                    tableName = "1. Anomaly Breakdown (Live Campaign Data)";
                    break;
                case 2:
                    content = buildLiveIncompleteScopeTable(statsContext, effectiveSectionId, sectionTitle);
                    tableName = "2. Incomplete Scope Status (Live Campaign Data)";
                    break;
                case 3:
                    content = buildLiveCompletedScopeTable(statsContext, effectiveSectionId, sectionTitle);
                    tableName = "3. Completed Scope Status (Live Campaign Data)";
                    break;
                case 4:
                    content = buildLiveAnodeDepletionTable(statsContext, effectiveSectionId, sectionTitle);
                    tableName = "4. Anode Depletion Status (Live Campaign Data)";
                    break;
                case 5:
                    content = buildLiveAnomalyDefectTypeTable(statsContext, effectiveSectionId, sectionTitle);
                    tableName = "5. Anomaly Defect Matrix (Live Campaign Data)";
                    break;
            }
            // Double-check with interpolateAllVariables to ensure any remaining tags are cleanly replaced
            if (statsContext) {
                content = interpolateAllVariables(content, statsContext, effectiveSectionId, sectionTitle);
            }
        }

        // Prevent table-in-table nesting corruption & auto-replace empty placeholder tables
        const { state } = editor;
        const { $from } = state.selection;
        let insideTable = false;
        let tablePos = -1;
        let tableEnd = -1;
        let tableNode: any = null;

        for (let d = $from.depth; d > 0; d--) {
            if ($from.node(d).type.name === "table") {
                insideTable = true;
                tablePos = $from.before(d);
                tableNode = $from.node(d);
                tableEnd = tablePos + tableNode.nodeSize;
                break;
            }
        }

        if (insideTable && tableNode) {
            const isTableBlank = !tableNode.textContent.trim();
            if (isTableBlank) {
                // Delete empty placeholder table and replace cleanly with the smart table
                editor.chain().focus().deleteRange({ from: tablePos, to: tableEnd }).insertContent(content).run();
            } else {
                // Table already has content; insert after the table to prevent table nesting
                editor.chain().focus().insertContentAt(tableEnd, `<p></p>${content}<p></p>`).run();
            }
        } else {
            editor.chain().focus().insertContent(content).run();
        }

        toast.success(`Inserted ${tableName}`);
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

    // ══════════ TABLE CELL MERGE & SPLIT HANDLERS ══════════
    const mergeWithNeighbor = (direction: "right" | "down"): boolean => {
        if (!editor) return false;
        try {
            const { state, view } = editor;
            const { $from } = state.selection;
            let tableDepth = -1;
            let cellDepth = -1;
            for (let d = $from.depth; d > 0; d--) {
                const name = $from.node(d).type.name;
                if (name === "table") {
                    tableDepth = d;
                }
                if (name === "tableCell" || name === "tableHeader") {
                    cellDepth = d;
                }
            }
            if (tableDepth === -1 || cellDepth === -1) return false;

            const tableNode = $from.node(tableDepth);
            const tableStart = $from.start(tableDepth);
            const cellPos = $from.before(cellDepth);
            const cellOffset = cellPos - tableStart;

            const map = TableMap.get(tableNode);
            const rect = map.findCell(cellOffset);

            let targetRow = rect.top;
            let targetCol = rect.left;

            if (direction === "right") {
                targetCol = rect.right;
                if (targetCol >= map.width) {
                    toast.info("No adjacent cell to the right to merge with");
                    return false;
                }
            } else if (direction === "down") {
                targetRow = rect.bottom;
                if (targetRow >= map.height) {
                    toast.info("No adjacent cell below to merge with");
                    return false;
                }
            }

            const targetOffset = map.positionAt(targetRow, targetCol, tableNode);
            const targetPos = tableStart + targetOffset;

            // Create cell selection spanning from current cell to target cell
            const sel = CellSelection.create(state.doc, cellPos, targetPos);
            const tr = state.tr.setSelection(sel);
            view.dispatch(tr);

            // Execute mergeCells on the selection
            const merged = editor.chain().focus().mergeCells().run();
            return merged;
        } catch (err) {
            console.warn("[TableMerge] Error merging cells:", err);
            return false;
        }
    };

    const handleMergeCells = () => {
        if (!editor) return;
        if (editor.can().mergeCells()) {
            const ok = editor.chain().focus().mergeCells().run();
            if (ok) {
                toast.success("Selected cells merged successfully");
                return;
            }
        }
        // If not in multi-cell selection, attempt to merge with adjacent cell to the right
        const okRight = mergeWithNeighbor("right");
        if (okRight) {
            toast.success("Merged with adjacent right cell");
        } else {
            toast.info("Select 2 or more cells by dragging across them, or use Merge with Right / Below cell.");
        }
    };

    const handleSplitCell = () => {
        if (!editor) return;
        if (editor.can().splitCell()) {
            const ok = editor.chain().focus().splitCell().run();
            if (ok) {
                toast.success("Cell split (unmerged) successfully");
                return;
            }
        }
        toast.info("This cell is not merged. Split Cell unmerges cells with multiple rows or columns.");
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

    // Insert Smart Inspection Charts (Supports Live Data & Template Tags)
    const insertSmartChart = (chartIndex: number) => {
        if (!editor) return;

        let content = "";
        let chartName = "";

        if (isTemplateMode) {
            // Template creation page: paste with variables and tags
            switch (chartIndex) {
                case 1:
                    content = getAnomalyPriorityChartTemplate();
                    chartName = "1. Anomaly Priority Distribution Chart (Template with Tags)";
                    break;
                case 2:
                    content = getScopeCompletionChartTemplate();
                    chartName = "2. SOW Completion & Scope Progress Chart (Template with Tags)";
                    break;
                case 3:
                    content = getCpHealthChartTemplate();
                    chartName = "3. CP Potential Integrity Chart (Template with Tags)";
                    break;
                case 4:
                    content = getAnodeDepletionChartTemplate();
                    chartName = "4. Anode Depletion Distribution Chart (Template with Tags)";
                    break;
                case 5:
                    content = getDefectDistributionChartTemplate();
                    chartName = "5. Defect Severity Breakdown Chart (Template with Tags)";
                    break;
            }
        } else {
            // Summary section page: paste with actual real campaign/inspection data
            switch (chartIndex) {
                case 1:
                    content = buildLiveAnomalyPriorityChart(statsContext, effectiveSectionId, sectionTitle);
                    chartName = "1. Anomaly Priority Distribution Chart (Live Data)";
                    break;
                case 2:
                    content = buildLiveScopeCompletionChart(statsContext, effectiveSectionId, sectionTitle);
                    chartName = "2. SOW Completion & Scope Progress Chart (Live Data)";
                    break;
                case 3:
                    content = buildLiveCpHealthChart(statsContext, effectiveSectionId, sectionTitle);
                    chartName = "3. CP Potential Integrity Chart (Live Data)";
                    break;
                case 4:
                    content = buildLiveAnodeDepletionChart(statsContext, effectiveSectionId, sectionTitle);
                    chartName = "4. Anode Depletion Distribution Chart (Live Data)";
                    break;
                case 5:
                    content = buildLiveDefectDistributionChart(statsContext, effectiveSectionId, sectionTitle);
                    chartName = "5. Defect Severity Breakdown Chart (Live Data)";
                    break;
            }
            if (statsContext) {
                content = interpolateAllVariables(content, statsContext, effectiveSectionId, sectionTitle);
            }
        }

        // Clean space management: insert right after table if cursor is inside a table, or at cursor
        const { state } = editor;
        const { $from } = state.selection;
        let insideTable = false;
        let tableEnd = -1;

        for (let d = $from.depth; d > 0; d--) {
            if ($from.node(d).type.name === "table") {
                insideTable = true;
                tableEnd = $from.after(d);
                break;
            }
        }

        if (insideTable) {
            editor.chain().focus().insertContentAt(tableEnd, content).run();
        } else {
            editor.chain().focus().insertContent(content).run();
        }

        toast.success(`Inserted ${chartName}`);
        setChartModalOpen(false);
    };

    const insertChartBlock = () => {
        insertSmartChart(chartType);
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
                                <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center justify-between">
                                    <span className="flex items-center gap-1">
                                        <Sparkles className="w-3 h-3 text-blue-600" />
                                        {isTemplateMode ? "Smart Table Templates (Tags)" : "Smart Inspection Tables (Live Data)"}
                                    </span>
                                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                                        isTemplateMode 
                                            ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-200" 
                                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200"
                                    }`}>
                                        {isTemplateMode ? "Variables / Tags" : "Actual Data"}
                                    </span>
                                </DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => insertSmartTable(1)} className="cursor-pointer py-1.5">
                                    <BarChart3 className="h-4 w-4 mr-2 text-rose-500 shrink-0 mt-0.5" />
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">
                                            1. Anomaly Breakdown
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                            {isTemplateMode ? "Template with Component, Zone & Full Priority Types" : "Live components, full priority types & open/rectified status"}
                                        </span>
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => insertSmartTable(2)} className="cursor-pointer py-1.5">
                                    <FileText className="h-4 w-4 mr-2 text-amber-500 shrink-0 mt-0.5" />
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">
                                            2. Incomplete Scope Status
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                            {isTemplateMode ? "Template grouped by inspection type & ordered by elevation" : "Grouped by inspection type & ordered by elevation"}
                                        </span>
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => insertSmartTable(3)} className="cursor-pointer py-1.5">
                                    <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500 shrink-0 mt-0.5" />
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">
                                            3. Completed Scope Status
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                            {isTemplateMode ? "Template with SOW completion tags" : "Live 100% completed inspection task counts"}
                                        </span>
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => insertSmartTable(4)} className="cursor-pointer py-1.5">
                                    <Zap className="h-4 w-4 mr-2 text-blue-500 shrink-0 mt-0.5" />
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">
                                            4. Anode Depletion Status
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                            {isTemplateMode ? "Template with 0-25%, 26-50%, 51-75%, 76%+ tags" : "Live anode depletion percentage brackets & counts"}
                                        </span>
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => insertSmartTable(5)} className="cursor-pointer py-1.5">
                                    <Grid className="h-4 w-4 mr-2 text-indigo-500 shrink-0 mt-0.5" />
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">
                                            5. Anomaly Defect Matrix
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                            {isTemplateMode ? "Template with defect type & priority matrix tags" : "Live defect classifications vs components"}
                                        </span>
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

                                {/* Cell Merge & Split Options */}
                                <DropdownMenuSeparator />
                                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Cell Merge & Split
                                </div>
                                <DropdownMenuItem onClick={handleMergeCells}>
                                    <Merge className="h-3.5 w-3.5 mr-2 text-blue-600" /> Merge Selected Cells
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                    const ok = mergeWithNeighbor("right");
                                    if (ok) toast.success("Merged with right cell");
                                }}>
                                    <SquareSplitHorizontal className="h-3.5 w-3.5 mr-2 text-blue-600" /> Merge with Right Cell
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                    const ok = mergeWithNeighbor("down");
                                    if (ok) toast.success("Merged with cell below");
                                }}>
                                    <SquareSplitVertical className="h-3.5 w-3.5 mr-2 text-blue-600" /> Merge with Cell Below
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleSplitCell}>
                                    <SquareSplitHorizontal className="h-3.5 w-3.5 mr-2 text-indigo-600" /> Split (Unmerge) Cell
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

                {/* 12. Smart Charts Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 gap-1 text-xs text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-medium"
                            title="Insert Smart Inspection Chart"
                        >
                            <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            <span>Chart</span>
                            <ChevronDown className="h-3 w-3 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-84">
                        <DropdownMenuLabel className="flex items-center justify-between text-xs py-1.5 bg-slate-50 dark:bg-slate-900 border-b">
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                                SMART INSPECTION CHARTS
                            </span>
                            <span className="text-[10px] font-normal text-indigo-600 dark:text-indigo-400">
                                {isTemplateMode ? "Variables / Tags" : "Actual Data"}
                            </span>
                        </DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => insertSmartChart(1)} className="cursor-pointer py-1.5">
                            <BarChart3 className="h-4 w-4 mr-2 text-rose-500 shrink-0 mt-0.5" />
                            <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">
                                    1. Anomaly Priority Distribution Chart
                                </span>
                                <span className="text-[10px] text-slate-400">
                                    {isTemplateMode ? "Template with P1-P4 & OBS variables with horizontal bars" : "Live P1-P4 & OBS visual comparison bars with counts"}
                                </span>
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => insertSmartChart(2)} className="cursor-pointer py-1.5">
                            <TrendingUp className="h-4 w-4 mr-2 text-emerald-500 shrink-0 mt-0.5" />
                            <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">
                                    2. SOW Completion &amp; Scope Progress Chart
                                </span>
                                <span className="text-[10px] text-slate-400">
                                    {isTemplateMode ? "Template with completion % & task scorecards" : "Live planned vs completed vs outstanding KPI progress bars"}
                                </span>
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => insertSmartChart(3)} className="cursor-pointer py-1.5">
                            <Activity className="h-4 w-4 mr-2 text-sky-500 shrink-0 mt-0.5" />
                            <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">
                                    3. CP Potential Integrity Chart
                                </span>
                                <span className="text-[10px] text-slate-400">
                                    {isTemplateMode ? "Template with CP voltage threshold & health meter" : "Live CP min/max potential range vs -800mV to -1050mV"}
                                </span>
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => insertSmartChart(4)} className="cursor-pointer py-1.5">
                            <Zap className="h-4 w-4 mr-2 text-blue-500 shrink-0 mt-0.5" />
                            <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">
                                    4. Anode Depletion Distribution Chart
                                </span>
                                <span className="text-[10px] text-slate-400">
                                    {isTemplateMode ? "Template with 0-25%, 26-50%, 51-75%, 76%+ bars" : "Live consumption distribution visual comparison bars"}
                                </span>
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => insertSmartChart(5)} className="cursor-pointer py-1.5">
                            <Grid className="h-4 w-4 mr-2 text-purple-500 shrink-0 mt-0.5" />
                            <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">
                                    5. Defect Severity &amp; Category Chart
                                </span>
                                <span className="text-[10px] text-slate-400">
                                    {isTemplateMode ? "Template with defect type matrix & severity tags" : "Live top defect classifications with visual progress distribution"}
                                </span>
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setChartModalOpen(true)} className="cursor-pointer text-xs text-slate-500 py-1.5">
                            <BarChart3 className="h-3.5 w-3.5 mr-2" /> Browse / Preview Chart Gallery...
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

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

                    <Separator orientation="vertical" className="h-4 mx-1 bg-blue-200 dark:bg-blue-800" />

                    {/* Cell Merge & Split Buttons */}
                    <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                        Cells:
                    </span>
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded border border-blue-200 dark:border-blue-800 shadow-2xs">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[11px] text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900 gap-1 font-medium"
                            onClick={handleMergeCells}
                            title="Merge selected cells (or click to merge with adjacent cell)"
                        >
                            <Merge className="h-3.5 w-3.5 text-blue-600" /> Merge
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-5 p-0 text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900"
                                    title="More merge directions"
                                >
                                    <ChevronDown className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48 text-xs">
                                <DropdownMenuItem onClick={handleMergeCells}>
                                    <Merge className="h-3.5 w-3.5 mr-2 text-blue-600" /> Merge Selected Cells
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                    const ok = mergeWithNeighbor("right");
                                    if (ok) toast.success("Merged with cell to the right");
                                }}>
                                    <SquareSplitHorizontal className="h-3.5 w-3.5 mr-2 text-blue-600" /> Merge with Right Cell
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                    const ok = mergeWithNeighbor("down");
                                    if (ok) toast.success("Merged with cell below");
                                }}>
                                    <SquareSplitVertical className="h-3.5 w-3.5 mr-2 text-blue-600" /> Merge with Cell Below
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Separator orientation="vertical" className="h-3.5 mx-0.5 bg-slate-200 dark:bg-slate-700" />

                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[11px] text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900 gap-1 font-medium"
                            onClick={handleSplitCell}
                            title="Split (unmerge) previously merged cell"
                        >
                            <SquareSplitHorizontal className="h-3.5 w-3.5 text-indigo-600" /> Split
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
                <style dangerouslySetInnerHTML={{ __html: `
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
                        border-collapse: collapse !important;
                        table-layout: fixed !important;
                        width: 100% !important;
                        margin: 0.75em 0 !important;
                        overflow: visible;
                        box-sizing: border-box;
                        font-size: 11px;
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
                        padding: 5px 8px !important;
                        vertical-align: middle;
                        box-sizing: border-box;
                        position: relative;
                        font-size: 11px;
                        line-height: 1.35;
                    }
                    .ProseMirror table p {
                        margin: 0 !important;
                        padding: 0 !important;
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
                        background: rgba(59, 130, 246, 0.2);
                        border: 2px solid #2563eb;
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
                ` }} />

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
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-indigo-600" />
                            Smart Inspection Charts Gallery
                        </DialogTitle>
                        <DialogDescription>
                            {isTemplateMode
                                ? "Select a chart template to insert with dynamic variables and tags for template creation."
                                : "Select a smart chart to insert with live campaign calculations, horizontal progress bars, and metrics."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2 max-h-[420px] overflow-y-auto pr-1">
                        {[
                            {
                                id: 1,
                                title: "1. Anomaly Priority Distribution Chart",
                                desc: isTemplateMode
                                    ? "Horizontal visual bars with P1, P2, P3, P4, and OBS tags & counts"
                                    : "Live visual comparison bars for Priority 1 to 4 and Observations with percentage share",
                                icon: BarChart3,
                                color: "text-rose-500",
                                badge: "Severity Analysis",
                            },
                            {
                                id: 2,
                                title: "2. SOW Completion & Scope Progress Chart",
                                desc: isTemplateMode
                                    ? "Inspection completion % gauge with planned, completed, and outstanding scorecards"
                                    : "Live campaign execution rate, completed tasks, and outstanding scope KPI bar",
                                icon: TrendingUp,
                                color: "text-emerald-500",
                                badge: "Scope Progress",
                            },
                            {
                                id: 3,
                                title: "3. CP Potential Integrity Health Chart",
                                desc: isTemplateMode
                                    ? "Cathodic protection potential meter vs -800mV to -1050mV threshold criteria"
                                    : "Live CP potential range (min/max mV) with structural polarization compliance status",
                                icon: Activity,
                                color: "text-sky-500",
                                badge: "CP Health",
                            },
                            {
                                id: 4,
                                title: "4. Anode Depletion Distribution Chart",
                                desc: isTemplateMode
                                    ? "Depletion bracket comparison bars (0-25%, 26-50%, 51-75%, 76-100%)"
                                    : "Live sacrificial anode consumption breakdown with retrofit/health indicators",
                                icon: Zap,
                                color: "text-blue-500",
                                badge: "Anode Wastage",
                            },
                            {
                                id: 5,
                                title: "5. Defect Severity & Category Chart",
                                desc: isTemplateMode
                                    ? "Top structural defect categories with priority matrix variables"
                                    : "Live top defect classifications (MGI, coating breakdown, scour) with proportional bars",
                                icon: Grid,
                                color: "text-purple-500",
                                badge: "Defect Matrix",
                            },
                        ].map((c) => {
                            const IconComponent = c.icon;
                            return (
                                <div
                                    key={c.id}
                                    onClick={() => setChartType(c.id)}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                                        chartType === c.id
                                            ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/30 ring-1 ring-indigo-500/20"
                                            : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                                    }`}
                                >
                                    <IconComponent className={`h-5 w-5 ${c.color} shrink-0 mt-0.5`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">
                                                {c.title}
                                            </span>
                                            <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                                {c.badge}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                            {c.desc}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setChartModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={insertChartBlock} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            {isTemplateMode ? "Insert Chart (with Tags)" : "Insert Live Chart"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
