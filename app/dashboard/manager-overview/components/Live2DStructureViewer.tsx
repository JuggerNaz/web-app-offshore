"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
    Activity,
    Layers,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Printer,
    Compass,
    AlertTriangle,
    Shield,
    Zap,
    Anchor,
    Maximize2,
    Sliders,
    FileText,
    CheckCircle2,
    XCircle,
    Info,
    X,
    Filter,
    Clock,
    Wrench,
    ClipboardList,
    AlertCircle
} from "lucide-react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// ─── INTERFACES ───
export interface StructuralNode {
    id: string;
    label: string;
    x: number;
    y: number;
    z: number;
    elevation: number;
    connectedMembers: string[];
    hasAnomaly?: boolean;
}

export interface StructuralMember {
    id: string;
    label: string;
    code: string;
    startNodeId: string;
    endNodeId: string;
    startX: number;
    startY: number;
    startZ: number;
    endX: number;
    endY: number;
    endZ: number;
    od: number | string;
    wt: number | string;
    length: number;
    face: string;
    elevationLevel: number;
    isLeg: boolean;
    hasAnomaly?: boolean;
    anomalyId?: string;
    anomalyPriority?: "P1" | "P2" | "P3" | "OBSERVATION";
    condition: "NORMAL" | "ATTENTION" | "CRITICAL" | "FLOODED";
    inspections?: any[];
    anomalies?: any[];
    dbRecord?: any;
}

export interface StructuralAnode {
    id: string;
    label: string;
    memberId: string;
    x: number;
    y: number;
    z: number;
    face: string;
    depletionPercent: number;
    potentialMv: number;
    status: "OPTIMAL" | "MARGINAL" | "DEPLETED";
    type: string;
    inspections?: any[];
}

export interface StructuralClamp {
    id: string;
    label: string;
    memberId: string;
    associatedPipe: string;
    x: number;
    y: number;
    z: number;
    face: string;
    type: "RISER_CLAMP" | "CAISSON_GUIDE" | "CONDUCTOR_GUIDE" | "REPAIR_CLAMP" | string;
    boltsTotal: number;
    boltsIntact: number;
    condition: "TIGHT" | "LOOSE" | "DEFECTIVE";
}

export interface StructuralAnomaly {
    id: string;
    refNo: string;
    componentId: string;
    componentName: string;
    face: string;
    elevation: number;
    x: number;
    y: number;
    priority: "P1" | "P2" | "P3" | "OBSERVATION";
    defectType: string;
    description: string;
    dimensions?: string;
    mitigationPlan: string;
    status: string;
    inspectionDate: string;
    jobpackName?: string;
}

interface Live2DStructureViewerProps {
    structure: any;
    activeSummary: any;
    className?: string;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
}

const sanitizeElevation = (elvVal: any): number => {
    if (elvVal === undefined || elvVal === null) return 0;
    const val = typeof elvVal === "number" ? elvVal : parseFloat(elvVal);
    if (isNaN(val)) return 0;
    if (val === 50.772) return -50.772; // Fix known database typo
    if (val < -1000) return val / 1000;
    return val;
};

function getLegEndpoints(layout: any) {
    const compObj = layout.component || layout.originalComp || layout.structure_components || {};
    const md = compObj.metadata || layout.metadata || compObj || {};

    let sLeg = (md.s_leg || compObj.s_leg || layout.s_leg || md.leg || compObj.leg || "").toString().toUpperCase().trim();
    let fLeg = (md.f_leg || compObj.f_leg || layout.f_leg || "").toString().toUpperCase().trim();

    if (!sLeg) {
        const sNode = (md.s_node || compObj.s_node || layout.s_node || "").toString().toUpperCase().trim();
        const m = sNode.match(/([A-Z]+\d+)/);
        if (m) sLeg = m[1];
    }
    if (!fLeg) {
        const fNode = (md.f_node || compObj.f_node || layout.f_node || "").toString().toUpperCase().trim();
        const m = fNode.match(/([A-Z]+\d+)/);
        if (m) fLeg = m[1];
    }

    const qId = (layout.q_id || compObj.q_id || md.q_id || layout.id || "").toString().toUpperCase().trim();
    if (!sLeg || !fLeg) {
        const legsInQId = qId.match(/\b([A-Z]+\d+)\b/g);
        if (legsInQId && legsInQId.length >= 1) {
            if (!sLeg) sLeg = legsInQId[0];
            if (!fLeg && legsInQId.length >= 2) fLeg = legsInQId[1];
        }
    }

    const compFace = (md.face || compObj.face || layout.face || "").toString().toUpperCase().trim();

    return { sLeg, fLeg, compFace, qId, compObj, md };
}

function checkComponentOnFace(layout: any, faceName: string, faces: any[] = []): boolean {
    const fUpper = faceName.toUpperCase().trim();
    if (fUpper === "ALL" || fUpper === "ALL 3D WIREFRAME") return true;

    const cleanFace = fUpper.replace(/^ROW\s*|^FACE\s*/i, "").trim();
    const { sLeg, fLeg, compFace, compObj } = getLegEndpoints(layout);
    const code = (layout.code || compObj.code || "").toUpperCase().trim();
    const labelUpper = String(layout.q_id || compObj.q_id || layout.label || layout.id || "").toUpperCase();

    // 1. Explicit Component Specifications FACE Field Check
    if (compFace) {
        if (compFace === "N/A" || compFace === "NA" || compFace === "NONE") {
            return fUpper === compFace;
        }

        const compFacesArray = compFace.split(",").map((f: string) => f.trim()).filter(Boolean);
        const isMatch = compFacesArray.some((cf: string) => {
            const cleanCompFace = cf.replace(/^ROW\s*|^FACE\s*/i, "").trim();
            return cf === fUpper || cleanCompFace === cleanFace || cf.includes(cleanFace) || fUpper.includes(cleanCompFace);
        });

        if (isMatch) return true;
        return false;
    }

    // 2. Strict Row Letter match (e.g. "ROW A", "FACE A", "A")
    const rowMatch = fUpper.match(/^(?:ROW|FACE)\s*([A-Z]+)$/i) || fUpper.match(/^([A-Z]+)$/i);
    if (rowMatch) {
        const rowLetter = rowMatch[1].toUpperCase();
        if (sLeg && fLeg && sLeg !== fLeg) {
            if (sLeg.startsWith(rowLetter) && fLeg.startsWith(rowLetter)) return true;
            if (sLeg.startsWith(rowLetter) || fLeg.startsWith(rowLetter)) return false;
        } else if (sLeg || fLeg) {
            const singleLeg = sLeg || fLeg;
            if (singleLeg.startsWith(rowLetter)) return true;
        }
    }

    // 3. Strict Column Number match (e.g. "ROW 1", "FACE 1", "1")
    const colMatch = fUpper.match(/^(?:ROW|FACE)\s*(\d+)$/i) || fUpper.match(/^(\d+)$/i);
    if (colMatch) {
        const colNum = colMatch[1].toUpperCase();
        if (sLeg && fLeg && sLeg !== fLeg) {
            if (sLeg.endsWith(colNum) && fLeg.endsWith(colNum)) return true;
            if (sLeg.endsWith(colNum) || fLeg.endsWith(colNum)) return false;
        } else if (sLeg || fLeg) {
            const singleLeg = sLeg || fLeg;
            if (singleLeg.endsWith(colNum)) return true;
        }
    }

    // 4. Check str_faces object definition from DB
    const faceObj = faces.find(
        (f) => (f.face || "").toUpperCase().trim() === fUpper || (f.face || "").toUpperCase().trim() === cleanFace
    );
    if (faceObj) {
        const fromLeg = (faceObj.face_from || "").toUpperCase().trim();
        const toLeg = (faceObj.face_to || "").toUpperCase().trim();

        if (fromLeg && toLeg) {
            const sMatch = sLeg === fromLeg || sLeg === toLeg;
            const fMatch = fLeg === fromLeg || fLeg === toLeg;

            if (sLeg && fLeg && sLeg !== fLeg) {
                if (sMatch && fMatch) return true;
            } else {
                if (sMatch || fMatch) return true;
            }
        }
    }

    // 5. Composite leg pair face (e.g., "A1A2", "A1-A2")
    const pairTokens = fUpper.split(/[\s\-]/).filter(Boolean);
    if (pairTokens.length >= 2) {
        if (sLeg && fLeg && sLeg !== fLeg) {
            if (pairTokens.includes(sLeg) && pairTokens.includes(fLeg)) return true;
        } else {
            if (pairTokens.includes(sLeg) || pairTokens.includes(fLeg)) return true;
        }
    }

    // 6. Foundation member label check (e.g. LEG-A1, LEG A2)
    if (labelUpper.startsWith("LEG-") || labelUpper.startsWith("LEG ")) {
        const legName = labelUpper.replace(/^LEG[\-\s]+/i, "");
        if (rowMatch && legName.startsWith(rowMatch[1].toUpperCase())) return true;
        if (colMatch && legName.endsWith(colMatch[1].toUpperCase())) return true;
    }

    return false;
}

export function Live2DStructureViewer({
    structure,
    activeSummary,
    className,
    isExpanded = false,
    onToggleExpand,
}: Live2DStructureViewerProps) {
    const platId = structure?.plat_id || structure?.id || activeSummary?.structure_id;
    const structureName = activeSummary?.structure_name || structure?.plat_name || structure?.title || structure?.name || "PLATFORM";
    const fieldName = activeSummary?.field_name || structure?.pfield || structure?.field_name || "Offshore Field";
    const waterDepth = Math.abs(Number(activeSummary?.platform_info?.water_depth || structure?.pwater_depth || structure?.depth || 60));
    const installYear = activeSummary?.platform_info?.install_year || structure?.pinstalled || (structure?.inst_date ? new Date(structure?.inst_date).getFullYear() : 1990);

    // ─── SWR REAL DATA FETCHING ───
    // 1. Structure Components (Enriched with real anomalies and inspections)
    const { data: rawComponentsRes } = useSWR(
        platId ? `/api/structure-components/${platId}` : null,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 30000 }
    );
    const rawComponents: any[] = rawComponentsRes?.data || [];

    // 2. WebApp 3D Coordinates & Foundation Layouts
    const { data: webapp3dRes } = useSWR(
        platId ? `/api/platform/webapp-3d/${platId}` : null,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 30000 }
    );
    const webapp3dData = webapp3dRes?.data;

    // 3. Platform Faces
    const { data: facesRes } = useSWR(
        platId ? `/api/platform/faces/${platId}` : null,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 30000 }
    );
    const strFaces: any[] = facesRes?.data || [];

    // 4. Platform Elevations
    const { data: elevationsRes } = useSWR(
        platId ? `/api/platform/elevation/${platId}` : null,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 30000 }
    );
    const strElevations: any[] = elevationsRes?.data || [];

    // 5. Direct Anomaly Register for this Platform (Backup / Global enrichment)
    const { data: anomalyReportRes } = useSWR(
        platId ? `/api/reports/anomaly-report?structureId=${platId}` : null,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 30000 }
    );
    const directAnomalies: any[] = anomalyReportRes?.data || [];

    // ─── DYNAMIC FACES COMPUTATION ───
    const availableFaces = useMemo(() => {
        const faceSet = new Set<string>();

        if (Array.isArray(strFaces) && strFaces.length > 0) {
            strFaces.forEach((f) => {
                const name = typeof f === "string" ? f : f.face;
                if (name) faceSet.add(name.toString().trim().toUpperCase());
            });
        }

        if (Array.isArray(rawComponents)) {
            rawComponents.forEach((c) => {
                const face = c.metadata?.face || c.face;
                if (face && typeof face === "string") {
                    face.split(",").forEach((sub: string) => {
                        const clean = sub.trim().toUpperCase();
                        if (clean && clean !== "N/A" && clean !== "NA" && clean !== "NONE") {
                            faceSet.add(clean);
                        }
                    });
                }
            });
        }

        if (faceSet.size === 0) {
            return ["ROW A", "ROW B", "ROW 1", "ROW 2", "ALL 3D WIREFRAME"];
        }

        const sorted = Array.from(faceSet).sort();
        if (!sorted.includes("ALL 3D WIREFRAME")) {
            sorted.push("ALL 3D WIREFRAME");
        }
        return sorted;
    }, [strFaces, rawComponents]);

    // ─── VIEW CONTROLS & STATE ───
    const [selectedFace, setSelectedFace] = useState<string>("ROW A");
    const [selectedPhase, setSelectedPhase] = useState<string>("ALL");
    const [viewTheme, setViewTheme] = useState<"dark" | "cad">("dark");
    const [zoomLevel, setZoomLevel] = useState<number>(1);
    const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    useEffect(() => {
        if (availableFaces.length > 0 && !availableFaces.includes(selectedFace)) {
            setSelectedFace(availableFaces[0]);
        }
    }, [availableFaces, selectedFace]);

    // ─── LAYER TOGGLES ───
    const [showNodes, setShowNodes] = useState(true);
    const [showMemberLabels, setShowMemberLabels] = useState(true);
    const [showAnomalies, setShowAnomalies] = useState(true);
    const [showAnodes, setShowAnodes] = useState(true);
    const [showClamps, setShowClamps] = useState(true);
    const [showAppurtenances, setShowAppurtenances] = useState(true);
    const [showElevations, setShowElevations] = useState(true);

    // ─── SELECTION & INSPECTOR ───
    const [selectedMember, setSelectedMember] = useState<StructuralMember | null>(null);
    const [selectedNode, setSelectedNode] = useState<StructuralNode | null>(null);
    const [selectedAnomaly, setSelectedAnomaly] = useState<StructuralAnomaly | null>(null);
    const [selectedAnode, setSelectedAnode] = useState<StructuralAnode | null>(null);
    const [selectedClamp, setSelectedClamp] = useState<StructuralClamp | null>(null);
    const [hoveredElement, setHoveredElement] = useState<{ type: string; id: string; label: string } | null>(null);

    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

    // ─── REAL COMPONENT & ANOMALY PROJECTION ENGINE ───
    const projectedStructure = useMemo(() => {
        const w3dMapByCompId = new Map<number, any>();
        const w3dMapByQId = new Map<string, any>();

        const w3dComponents: any[] = webapp3dData?.components || [];
        const foundationMembers: any[] = webapp3dData?.foundationMembers || [];

        w3dComponents.forEach((w: any) => {
            const cid = Number(w.component_id || w.comp_id || w.id);
            if (cid && !isNaN(cid)) w3dMapByCompId.set(cid, w);
            const qid = String(w.q_id || "").toUpperCase().trim();
            if (qid) w3dMapByQId.set(qid, w);
        });

        const isColSearch = /^(?:ROW|FACE)\s*\d+$/i.test(selectedFace) || /^\d+$/i.test(selectedFace);
        const runsAlongX = !isColSearch;

        const get3DVector = (item: any, isEnd: boolean = false): number[] => {
            const parseVec = (v: any) => {
                if (Array.isArray(v) && v.length >= 3) return [Number(v[0]), Number(v[1]), Number(v[2])];
                if (v && v.x !== undefined && v.y !== undefined && v.z !== undefined) {
                    return [Number(v.x), Number(v.y), Number(v.z)];
                }
                return null;
            };

            if (isEnd) {
                const end = parseVec(item.end);
                if (end) return end;
                if (item.end_x !== undefined && item.end_y !== undefined && item.end_z !== undefined) {
                    return [Number(item.end_x), Number(item.end_y), Number(item.end_z)];
                }
            } else {
                const start = parseVec(item.start);
                if (start) return start;
                if (item.start_x !== undefined && item.start_y !== undefined && item.start_z !== undefined) {
                    return [Number(item.start_x), Number(item.start_y), Number(item.start_z)];
                }
            }
            const pos = parseVec(item.position);
            if (pos) return pos;
            if (item.pos_x !== undefined && item.pos_y !== undefined && item.pos_z !== undefined) {
                return [Number(item.pos_x), Number(item.pos_y), Number(item.pos_z)];
            }
            return [0, 0, 0];
        };

        const rawElvNumbers = new Set<number>();
        if (Array.isArray(strElevations)) {
            strElevations.forEach((e) => {
                const val = typeof e === "number" ? sanitizeElevation(e) : sanitizeElevation(e?.elv);
                if (isFinite(val)) rawElvNumbers.add(val);
            });
        }
        rawElvNumbers.add(15.0);
        rawElvNumbers.add(0.0);
        rawElvNumbers.add(-waterDepth);

        const topHalfWidth = 9.0;
        const bottomHalfWidth = topHalfWidth + (waterDepth + 15) * 0.10;
        const batterSlope = 0.10;

        // Determine left and right column labels from str_faces or member layout
        let resolvedLeftLeg = "A1";
        let resolvedRightLeg = "A2";

        const cleanSelected = selectedFace.toUpperCase().trim();
        const matchedFace = strFaces.find((f: any) =>
            (f.face || "").toString().toUpperCase().trim() === cleanSelected ||
            (f.face || "").toString().toUpperCase().replace(/^ROW\s*|^FACE\s*/i, "").trim() === cleanSelected.replace(/^ROW\s*|^FACE\s*/i, "").trim()
        );
        if (matchedFace?.face_from && matchedFace?.face_to) {
            resolvedLeftLeg = matchedFace.face_from.toUpperCase();
            resolvedRightLeg = matchedFace.face_to.toUpperCase();
        } else if (cleanSelected.includes("B") || cleanSelected === "ROW B") {
            resolvedLeftLeg = "B1"; resolvedRightLeg = "B2";
        } else if (cleanSelected.includes("1") || cleanSelected === "ROW 1") {
            resolvedLeftLeg = "A1"; resolvedRightLeg = "B1";
        } else if (cleanSelected.includes("2") || cleanSelected === "ROW 2") {
            resolvedLeftLeg = "A2"; resolvedRightLeg = "B2";
        } else if (cleanSelected.includes("3") || cleanSelected === "ROW 3") {
            resolvedLeftLeg = "A3"; resolvedRightLeg = "B3";
        } else if (cleanSelected.includes("4") || cleanSelected === "ROW 4") {
            resolvedLeftLeg = "A4"; resolvedRightLeg = "B4";
        }

        const members: StructuralMember[] = [];
        const anodes: StructuralAnode[] = [];
        const clamps: StructuralClamp[] = [];
        const risersAndCaissons: Array<{ id: string; label: string; code: string; x: number; topY: number; bottomY: number; color: string }> = [];
        const anomalies: StructuralAnomaly[] = [];
        const nodesMap = new Map<string, StructuralNode>();

        const allPlatformAnomalies: any[] = [];
        const seenAnomalyIds = new Set<string>();

        const registerAnomaly = (a: any, sourceComp?: any) => {
            const anomId = String(a.anomaly_id || a.id || a.display_ref_no || `${a.component_qid || "A"}-${Math.random()}`);
            if (seenAnomalyIds.has(anomId)) return;
            seenAnomalyIds.add(anomId);

            allPlatformAnomalies.push({
                ...a,
                sourceComp,
            });
        };

        rawComponents.forEach((comp: any) => {
            if (comp.anomalies && Array.isArray(comp.anomalies)) {
                comp.anomalies.forEach((a: any) => registerAnomaly(a, comp));
            }
        });

        directAnomalies.forEach((a: any) => {
            registerAnomaly(a);
        });

        if (Array.isArray(activeSummary?.anomalies)) {
            activeSummary.anomalies.forEach((a: any) => registerAnomaly(a));
        }

        // Add foundation leg members if present
        foundationMembers.forEach((fm: any) => {
            if (checkComponentOnFace(fm, selectedFace, strFaces)) {
                const s = get3DVector(fm, false);
                const e = get3DVector(fm, true);
                const x1 = runsAlongX ? s[0] : s[2];
                const x2 = runsAlongX ? e[0] : e[2];
                const y1 = s[1];
                const y2 = e[1];

                const legLabel = fm.label || fm.q_id || "LEG";
                members.push({
                    id: `FND-${fm.id || legLabel}`,
                    label: legLabel,
                    code: "LG",
                    startNodeId: legLabel.includes("1") ? resolvedLeftLeg : resolvedRightLeg,
                    endNodeId: `ML-${legLabel}`,
                    startX: x1,
                    startY: y1,
                    startZ: s[2],
                    endX: x2,
                    endY: y2,
                    endZ: e[2],
                    od: 1200,
                    wt: 32,
                    length: Math.hypot(x2 - x1, y2 - y1),
                    face: selectedFace,
                    elevationLevel: (y1 + y2) / 2,
                    isLeg: true,
                    condition: "NORMAL",
                });
            }
        });

        // Process all database structure components
        rawComponents.forEach((c: any) => {
            const cid = Number(c.id);
            const qid = String(c.q_id || c.name || "").toUpperCase().trim();
            const code = (c.code || "").toUpperCase().trim();
            const md = c.metadata || {};

            const w3d = w3dMapByCompId.get(cid) || w3dMapByQId.get(qid);

            const elv1 = sanitizeElevation(md.elv_1 ?? md.elevation1 ?? w3d?.start_y ?? 0);
            const elv2 = sanitizeElevation(md.elv_2 ?? md.elevation2 ?? w3d?.end_y ?? elv1);
            if (isFinite(elv1)) rawElvNumbers.add(elv1);
            if (isFinite(elv2)) rawElvNumbers.add(elv2);

            // A. SACRIFICIAL ANODES
            if (code === "AN" || qid.startsWith("BAN") || qid.startsWith("AN") || qid.includes("ANODE")) {
                const sLeg = (md.s_leg || md.leg || "").toString().toUpperCase();
                const fLeg = (md.f_leg || "").toString().toUpperCase();
                const targetLeg = sLeg || fLeg;
                const isOnFace = checkComponentOnFace(c, selectedFace, strFaces);

                const matchesFaceLegs = targetLeg && (
                    targetLeg.includes(resolvedLeftLeg) || targetLeg.includes(resolvedRightLeg) ||
                    resolvedLeftLeg.includes(targetLeg) || resolvedRightLeg.includes(targetLeg)
                );

                if (isOnFace || matchesFaceLegs || selectedFace === "ALL 3D WIREFRAME") {
                    const y = elv1 || (w3d ? (w3d.start_y + w3d.end_y) / 2 : -20.0);
                    const isLeftLeg = targetLeg ? (targetLeg === resolvedLeftLeg || targetLeg.includes("1") || targetLeg.startsWith("A")) : (anodes.length % 2 === 0);
                    let x = isLeftLeg ? -topHalfWidth - (Math.abs(y) * batterSlope) : topHalfWidth + (Math.abs(y) * batterSlope);
                    if (w3d) {
                        const s = get3DVector(w3d, false);
                        x = runsAlongX ? s[0] : s[2];
                    }

                    const inspList: any[] = c.inspections || [];
                    const cpInsp = inspList.find((i: any) => i.inspection_type_code === "CP" || i.description?.toLowerCase().includes("potential")) || inspList[0];

                    let potentialMv = -950;
                    let depletionPercent = 30;

                    if (cpInsp?.inspection_data) {
                        const d = cpInsp.inspection_data;
                        if (d.potential) potentialMv = Number(d.potential);
                        if (d.potential_mv) potentialMv = Number(d.potential_mv);
                        if (d.depletion) depletionPercent = Number(d.depletion);
                        if (d.depletion_pct) depletionPercent = Number(d.depletion_pct);
                    } else if (cpInsp?.description) {
                        const matchPot = cpInsp.description.match(/-?\d{3,4}\s*m?V/i);
                        if (matchPot) potentialMv = parseInt(matchPot[0]);
                        const matchDep = cpInsp.description.match(/(\d{1,3})\s*%/);
                        if (matchDep) depletionPercent = parseInt(matchDep[1]);
                    }

                    const status: "OPTIMAL" | "MARGINAL" | "DEPLETED" =
                        depletionPercent >= 80 || potentialMv > -800 ? "DEPLETED" :
                        depletionPercent >= 50 || potentialMv > -900 ? "MARGINAL" : "OPTIMAL";

                    anodes.push({
                        id: String(c.id || qid),
                        label: qid || `ANODE-${c.id}`,
                        memberId: targetLeg || (isLeftLeg ? resolvedLeftLeg : resolvedRightLeg),
                        x,
                        y,
                        z: 0,
                        face: selectedFace,
                        depletionPercent,
                        potentialMv,
                        status,
                        type: md.type || "ALUMINUM",
                        inspections: inspList,
                    });
                }
                return;
            }

            // B. CLAMPS & GUIDES
            if (code === "CL" || code === "RC" || qid.includes("CLP") || qid.includes("SUPP") || qid.includes("CLAMP")) {
                const sLeg = (md.s_leg || md.leg || "").toString().toUpperCase();
                const isOnFace = checkComponentOnFace(c, selectedFace, strFaces) ||
                    (sLeg && (sLeg.includes(resolvedLeftLeg) || sLeg.includes(resolvedRightLeg)));

                if (isOnFace || selectedFace === "ALL 3D WIREFRAME") {
                    const y = elv1 || (w3d ? (w3d.start_y + w3d.end_y) / 2 : -15.0);
                    let x = -2.5;
                    if (w3d) {
                        const s = get3DVector(w3d, false);
                        x = runsAlongX ? s[0] : s[2];
                    }

                    const inspList: any[] = c.inspections || [];
                    const hasDefect = c.anomalies?.length > 0 || inspList.some((i: any) => i.has_anomaly);

                    clamps.push({
                        id: String(c.id || qid),
                        label: qid || `CLAMP-${c.id}`,
                        memberId: md.s_member || md.associated_member || "BRACE",
                        associatedPipe: md.associated_pipe || (qid.includes("RS") ? "RISER RS-1" : "CAISSON CS-1"),
                        x,
                        y,
                        z: 0,
                        face: selectedFace,
                        type: qid.includes("CS") ? "CAISSON_GUIDE" : "RISER_CLAMP",
                        boltsTotal: 4,
                        boltsIntact: hasDefect ? 3 : 4,
                        condition: hasDefect ? "LOOSE" : "TIGHT",
                    });
                }
                return;
            }

            // C. RISERS & CAISSONS
            if (code === "RS" || code === "CS" || qid.startsWith("RS-") || qid.startsWith("CS-") || qid.includes("RISER") || qid.includes("CAISSON")) {
                let x = code === "CS" || qid.includes("CS") ? 4.2 : -2.5;
                if (w3d) {
                    const s = get3DVector(w3d, false);
                    x = runsAlongX ? s[0] : s[2];
                }
                risersAndCaissons.push({
                    id: String(c.id || qid),
                    label: qid || (code === "RS" ? "RISER" : "CAISSON"),
                    code,
                    x,
                    topY: 15.0,
                    bottomY: -waterDepth,
                    color: code === "RS" ? "#10b981" : "#a855f7",
                });
                return;
            }

            // D. STRUCTURAL STEEL MEMBERS (LEGS, HORIZONTALS, DIAGONALS, PILES)
            const isMember =
                code === "LG" || code === "HM" || code === "VD" || code === "HD" || code === "VM" ||
                code === "DM" || code === "BR" || code === "DK" || code === "PL" ||
                qid.startsWith("LG") || qid.startsWith("HM") || qid.startsWith("HOM") || qid.startsWith("VDM") || qid.startsWith("HDM");

            if (isMember) {
                if (!checkComponentOnFace(c, selectedFace, strFaces)) return;

                let sx = 0, sy = elv1, sz = 0;
                let ex = 0, ey = elv2, ez = 0;

                if (w3d) {
                    const s = get3DVector(w3d, false);
                    const e = get3DVector(w3d, true);
                    sx = runsAlongX ? s[0] : s[2];
                    sy = s[1];
                    sz = s[2];
                    ex = runsAlongX ? e[0] : e[2];
                    ey = e[1];
                    ez = e[2];
                } else {
                    const sLeg = (md.s_leg || "").toUpperCase();
                    const fLeg = (md.f_leg || "").toUpperCase();
                    const isLeftS = sLeg === resolvedLeftLeg || sLeg.includes("1");
                    const isLeftF = fLeg === resolvedLeftLeg || fLeg.includes("1");

                    const leftXs = -topHalfWidth - (Math.abs(sy) * batterSlope);
                    const rightXs = topHalfWidth + (Math.abs(sy) * batterSlope);
                    const leftXe = -topHalfWidth - (Math.abs(ey) * batterSlope);
                    const rightXe = topHalfWidth + (Math.abs(ey) * batterSlope);

                    if (code === "LG") {
                        const isLeft = isLeftS || qid.includes(resolvedLeftLeg);
                        sx = isLeft ? -topHalfWidth : topHalfWidth;
                        sy = 15.0;
                        ex = isLeft ? -bottomHalfWidth : bottomHalfWidth;
                        ey = -waterDepth;
                    } else if (code === "HM" || Math.abs(sy - ey) < 0.5) {
                        sx = leftXs;
                        ex = rightXs;
                        ey = sy;
                    } else {
                        sx = isLeftS ? leftXs : rightXs;
                        ex = isLeftF ? leftXe : rightXe;
                    }
                }

                const isLeg = code === "LG" || qid.startsWith("LG") || qid.startsWith("LEG");
                const od = Number(md.od || md.diameter || (isLeg ? 1200 : 610));
                const wt = Number(md.wt || md.wall_thickness || (isLeg ? 32 : 16));
                const length = Math.hypot(ex - sx, ey - sy) || Number(md.dist || 12.0);

                const compAnomalies = c.anomalies || [];
                const hasAnomaly = compAnomalies.length > 0;
                let anomalyPriority: "P1" | "P2" | "P3" | "OBSERVATION" | undefined;
                if (hasAnomaly) {
                    if (compAnomalies.some((a: any) => a.priority === "P1")) anomalyPriority = "P1";
                    else if (compAnomalies.some((a: any) => a.priority === "P2")) anomalyPriority = "P2";
                    else anomalyPriority = "P3";
                }

                const sNodeId = md.s_node || (isLeg ? resolvedLeftLeg : `N-${sy.toFixed(0)}L`);
                const fNodeId = md.f_node || (isLeg ? `ML-${resolvedLeftLeg}` : `N-${ey.toFixed(0)}R`);

                if (!nodesMap.has(sNodeId)) {
                    nodesMap.set(sNodeId, {
                        id: sNodeId,
                        label: sNodeId,
                        x: sx,
                        y: sy,
                        z: sz,
                        elevation: sy,
                        connectedMembers: [qid],
                        hasAnomaly,
                    });
                } else {
                    nodesMap.get(sNodeId)!.connectedMembers.push(qid);
                }

                if (!nodesMap.has(fNodeId)) {
                    nodesMap.set(fNodeId, {
                        id: fNodeId,
                        label: fNodeId,
                        x: ex,
                        y: ey,
                        z: ez,
                        elevation: ey,
                        connectedMembers: [qid],
                        hasAnomaly,
                    });
                } else {
                    nodesMap.get(fNodeId)!.connectedMembers.push(qid);
                }

                const condition: "NORMAL" | "ATTENTION" | "CRITICAL" | "FLOODED" =
                    anomalyPriority === "P1" ? "CRITICAL" :
                    compAnomalies.some((a: any) => a.defect_type?.toLowerCase().includes("flood") || a.description?.toLowerCase().includes("flood")) ? "FLOODED" :
                    anomalyPriority === "P2" ? "ATTENTION" : "NORMAL";

                members.push({
                    id: String(c.id || qid),
                    label: qid,
                    code,
                    startNodeId: sNodeId,
                    endNodeId: fNodeId,
                    startX: sx,
                    startY: sy,
                    startZ: sz,
                    endX: ex,
                    endY: ey,
                    endZ: ez,
                    od,
                    wt,
                    length,
                    face: selectedFace,
                    elevationLevel: (sy + ey) / 2,
                    isLeg,
                    hasAnomaly,
                    anomalyPriority,
                    condition,
                    inspections: c.inspections || [],
                    anomalies: compAnomalies,
                    dbRecord: c,
                });
            }
        });

        // 2. FALLBACK JACKET STRUCTURAL FRAMING IF NO MEMBERS DERIVED YET
        if (members.length === 0) {
            members.push(
                {
                    id: "LG-LEFT",
                    label: `LEG ${resolvedLeftLeg}`,
                    code: "LG",
                    startNodeId: resolvedLeftLeg,
                    endNodeId: `ML-${resolvedLeftLeg}`,
                    startX: -topHalfWidth * 0.85,
                    startY: 15.0,
                    startZ: 0,
                    endX: -bottomHalfWidth,
                    endY: -waterDepth,
                    endZ: 0,
                    od: 1200,
                    wt: 32,
                    length: Math.hypot(bottomHalfWidth - topHalfWidth * 0.85, waterDepth + 15),
                    face: selectedFace,
                    elevationLevel: 0,
                    isLeg: true,
                    condition: "NORMAL",
                },
                {
                    id: "LG-RIGHT",
                    label: `LEG ${resolvedRightLeg}`,
                    code: "LG",
                    startNodeId: resolvedRightLeg,
                    endNodeId: `ML-${resolvedRightLeg}`,
                    startX: topHalfWidth * 0.85,
                    startY: 15.0,
                    startZ: 0,
                    endX: bottomHalfWidth,
                    endY: -waterDepth,
                    endZ: 0,
                    od: 1200,
                    wt: 32,
                    length: Math.hypot(bottomHalfWidth - topHalfWidth * 0.85, waterDepth + 15),
                    face: selectedFace,
                    elevationLevel: 0,
                    isLeg: true,
                    condition: "NORMAL",
                }
            );

            const tiers = [15.0, 1.5, -15.0, -30.0, -45.0, -waterDepth];
            tiers.forEach((elv, i) => {
                if (i < tiers.length - 1) {
                    const nextElv = tiers[i + 1];
                    const halfW1 = topHalfWidth + (Math.abs(elv) * batterSlope);
                    const halfW2 = topHalfWidth + (Math.abs(nextElv) * batterSlope);

                    members.push({
                        id: `HM-${elv}`,
                        label: `HM EL ${elv.toFixed(1)}M`,
                        code: "HM",
                        startNodeId: `N-${i}A`,
                        endNodeId: `N-${i}B`,
                        startX: -halfW1,
                        startY: elv,
                        startZ: 0,
                        endX: halfW1,
                        endY: elv,
                        endZ: 0,
                        od: 610,
                        wt: 16,
                        length: halfW1 * 2,
                        face: selectedFace,
                        elevationLevel: elv,
                        isLeg: false,
                        condition: "NORMAL",
                    });

                    members.push(
                        {
                            id: `VDM-${elv}-1`,
                            label: `VDM EL ${elv.toFixed(0)}-${nextElv.toFixed(0)} A`,
                            code: "VDM",
                            startNodeId: `N-${i}A`,
                            endNodeId: `N-${i + 1}B`,
                            startX: -halfW1,
                            startY: elv,
                            startZ: 0,
                            endX: halfW2,
                            endY: nextElv,
                            endZ: 0,
                            od: 508,
                            wt: 14,
                            length: Math.hypot(halfW1 + halfW2, elv - nextElv),
                            face: selectedFace,
                            elevationLevel: (elv + nextElv) / 2,
                            isLeg: false,
                            condition: "NORMAL",
                        },
                        {
                            id: `VDM-${elv}-2`,
                            label: `VDM EL ${elv.toFixed(0)}-${nextElv.toFixed(0)} B`,
                            code: "VDM",
                            startNodeId: `N-${i}B`,
                            endNodeId: `N-${i + 1}A`,
                            startX: halfW1,
                            startY: elv,
                            startZ: 0,
                            endX: -halfW2,
                            endY: nextElv,
                            endZ: 0,
                            od: 508,
                            wt: 14,
                            length: Math.hypot(halfW1 + halfW2, elv - nextElv),
                            face: selectedFace,
                            elevationLevel: (elv + nextElv) / 2,
                            isLeg: false,
                            condition: "NORMAL",
                        }
                    );
                }
            });
        }

        // 3. PIN ACTUAL ANOMALIES TO THE 2D STRUCTURE
        allPlatformAnomalies.forEach((a: any) => {
            const qid = (a.component_qid || a.component_name || "").toUpperCase().trim();
            const cid = Number(a.component_id);

            const targetMember = members.find(m =>
                (cid && m.id === String(cid)) ||
                (qid && m.label.toUpperCase().includes(qid)) ||
                (qid && qid.includes(m.label.toUpperCase()))
            );

            let pinX = 0;
            let pinY = sanitizeElevation(a.elevation);

            if (targetMember) {
                pinX = (targetMember.startX + targetMember.endX) / 2;
                if (!pinY || pinY === 0) {
                    pinY = (targetMember.startY + targetMember.endY) / 2;
                }
            } else {
                const belongsToFace = checkComponentOnFace(a, selectedFace, strFaces);
                if (!belongsToFace && selectedFace !== "ALL 3D WIREFRAME") return;

                pinY = pinY || -15.0;
                pinX = Math.random() > 0.5 ? -3.0 : 3.0;
            }

            const priority: "P1" | "P2" | "P3" | "OBSERVATION" =
                a.priority === "P1" ? "P1" :
                a.priority === "P2" ? "P2" :
                a.priority === "P3" ? "P3" : "OBSERVATION";

            anomalies.push({
                id: String(a.anomaly_id || a.id || a.display_ref_no),
                refNo: a.display_ref_no || a.anomaly_ref_no || `ANO-${structureName}-${a.anomaly_id || "001"}`,
                componentId: String(a.component_id || targetMember?.id || "COMP"),
                componentName: a.component_qid || targetMember?.label || "Structural Member",
                face: selectedFace,
                elevation: pinY,
                x: pinX,
                y: pinY,
                priority,
                defectType: a.defect_type || a.category || "Inspection Defect",
                description: a.description || a.defect_description || "Inspection finding logged during campaign.",
                dimensions: a.dimensions || a.defect_size || "N/A",
                mitigationPlan: a.recommended_action || a.mitigation_plan || "Integrity review scheduled.",
                status: a.status || "OPEN",
                inspectionDate: a.inspection_date ? new Date(a.inspection_date).toLocaleDateString("en-GB") : "RECENT",
                jobpackName: a.jobpack_name || "Integrity Campaign",
            });
        });

        // 4. SORT ELEVATIONS AND FILTER COLLIDING LABELS
        const sortedElevations = Array.from(rawElvNumbers)
            .filter(v => isFinite(v))
            .sort((a, b) => b - a)
            .map(elv => ({
                elv,
                name: elv === 15.0 ? "TOPSIDE DECK (+15M)" :
                      Math.abs(elv) < 0.01 ? "MSL (WATERLINE)" :
                      elv === -3.0 ? "SPLASH ZONE (SZ)" :
                      elv <= -waterDepth ? `SEABED MUDLINE (-${waterDepth.toFixed(1)}M)` :
                      `EL ${elv >= 0 ? `(+) ${elv.toFixed(1)}M` : `(-) ${Math.abs(elv).toFixed(1)}M`}`,
            }));

        const filteredElevations: Array<{ elv: number; name: string }> = [];
        let lastElv: number | null = null;
        sortedElevations.forEach(e => {
            const isCritical = e.elv === 15.0 || Math.abs(e.elv) < 0.01 || e.elv === -3.0 || e.elv <= -waterDepth;
            if (isCritical || lastElv === null || Math.abs(lastElv - e.elv) >= 3.0) {
                filteredElevations.push(e);
                lastElv = e.elv;
            }
        });

        const nodes = Array.from(nodesMap.values());

        return {
            members,
            nodes,
            anodes,
            clamps,
            risersAndCaissons,
            anomalies,
            elevations: filteredElevations,
            allPlatformAnomalies,
            topHalfWidth,
            bottomHalfWidth,
            colLeftLabel: resolvedLeftLeg,
            colRightLabel: resolvedRightLeg,
        };
    }, [
        rawComponents,
        webapp3dData,
        strFaces,
        strElevations,
        directAnomalies,
        activeSummary,
        selectedFace,
        waterDepth,
        structureName,
    ]);

    // ─── FILTER MEMBERS, NODES, APPURTENANCES BY PHASE ───
    const filteredModel = useMemo(() => {
        let { nodes, members, anodes, clamps, risersAndCaissons, anomalies, elevations, allPlatformAnomalies, topHalfWidth, bottomHalfWidth, colLeftLabel, colRightLabel } = projectedStructure;

        if (selectedPhase === "PHASE_1") {
            // Topside & Splash Zone: +15m down to -5m
            nodes = nodes.filter(n => n.y >= -5.0);
            members = members.filter(m => Math.max(m.startY, m.endY) >= -5.0);
            anodes = anodes.filter(a => a.y >= -5.0);
            clamps = clamps.filter(c => c.y >= -5.0);
            anomalies = anomalies.filter(a => a.elevation >= -5.0);
        } else if (selectedPhase === "PHASE_2") {
            // Mid-Depth Subsea: -5m down to -40m
            nodes = nodes.filter(n => n.y <= 0 && n.y >= -40.0);
            members = members.filter(m => (m.startY <= 0 && m.startY >= -40.0) || (m.endY <= 0 && m.endY >= -40.0));
            anodes = anodes.filter(a => a.y <= 0 && a.y >= -40.0);
            clamps = clamps.filter(c => c.y <= 0 && c.y >= -40.0);
            anomalies = anomalies.filter(a => a.elevation <= 0 && a.elevation >= -40.0);
        } else if (selectedPhase === "PHASE_3") {
            // Deepwater & Mudline: -35m down to mudline
            nodes = nodes.filter(n => n.y <= -35.0);
            members = members.filter(m => Math.min(m.startY, m.endY) <= -35.0);
            anodes = anodes.filter(a => a.y <= -35.0);
            clamps = clamps.filter(c => c.y <= -35.0);
            anomalies = anomalies.filter(a => a.elevation <= -35.0);
        }

        return {
            nodes,
            members,
            anodes,
            clamps,
            risersAndCaissons,
            anomalies,
            elevations,
            allPlatformAnomalies,
            topHalfWidth,
            bottomHalfWidth,
            colLeftLabel,
            colRightLabel,
        };
    }, [projectedStructure, selectedPhase]);

    // ─── 2D COORDINATE PROJECTION SYSTEM ───
    const svgWidth = 840;
    const svgHeight = 780;
    const paddingLeft = 190;
    const paddingRight = 70;
    const paddingTop = 90;
    const paddingBottom = 70;

    const bounds = useMemo(() => {
        let minX = -projectedStructure.bottomHalfWidth * 1.25;
        let maxX = projectedStructure.bottomHalfWidth * 1.25;

        if (filteredModel.members.length > 0) {
            const allX = filteredModel.members.flatMap(m => [m.startX, m.endX]).filter(isFinite);
            if (allX.length > 0) {
                const observedMin = Math.min(...allX);
                const observedMax = Math.max(...allX);
                const span = Math.max(observedMax - observedMin, 15);
                minX = Math.min(minX, observedMin - span * 0.15);
                maxX = Math.max(maxX, observedMax + span * 0.15);
            }
        }

        const yMin = -waterDepth - 6;
        const yMax = 20.0;
        return { minX, maxX, minY: yMin, maxY: yMax };
    }, [filteredModel.members, projectedStructure.bottomHalfWidth, waterDepth]);

    const mapX = (x: number) => {
        const norm = (x - bounds.minX) / (bounds.maxX - bounds.minX || 1);
        return paddingLeft + norm * (svgWidth - paddingLeft - paddingRight);
    };

    const mapY = (y: number) => {
        const norm = (y - bounds.minY) / (bounds.maxY - bounds.minY || 1);
        return (svgHeight - paddingBottom) - norm * (svgHeight - paddingTop - paddingBottom);
    };

    // ─── ZOOM & PAN HANDLERS ───
    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 3.0));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.75));
    const handleResetZoom = () => {
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 0) {
            setIsDragging(true);
            dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setPanOffset({
                x: e.clientX - dragStartRef.current.x,
                y: e.clientY - dragStartRef.current.y,
            });
        }
    };

    const handleMouseUp = () => setIsDragging(false);

    const triggerBrowserPrint = () => {
        window.print();
    };

    return (
        <div className={cn("space-y-4", className)}>
            {/* ═══ TOP CONTROLS & PHASE SWITCHER ═══ */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-sm">
                {/* Dynamic Face Selector */}
                <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1 mr-1 shrink-0">
                        <Compass className="w-3.5 h-3.5 text-blue-500" />
                        Face:
                    </span>
                    {availableFaces.map(face => (
                        <button
                            key={face}
                            onClick={() => setSelectedFace(face)}
                            className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-tight transition-all shrink-0",
                                selectedFace === face
                                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                            )}
                        >
                            {face}
                        </button>
                    ))}
                </div>

                {/* Campaign Phase dropdown & Action buttons */}
                <div className="flex items-center gap-2">
                    {/* Phase selection */}
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Phase:</span>
                        <select
                            value={selectedPhase}
                            onChange={(e) => setSelectedPhase(e.target.value)}
                            className="bg-transparent text-xs font-black text-slate-800 dark:text-white outline-none cursor-pointer pr-1"
                        >
                            <option value="ALL">All Phases (Topside to Mudline)</option>
                            <option value="PHASE_1">Phase 1 (Topside & Splash Zone: +15m to -5m)</option>
                            <option value="PHASE_2">Phase 2 (Subsea Mid-Depth: -5m to -40m)</option>
                            <option value="PHASE_3">Phase 3 (Deepwater Mudline: -35m to Mudline)</option>
                        </select>
                    </div>

                    {/* View Theme Toggle (CAD Blueprint vs Dark Glass) */}
                    <button
                        onClick={() => setViewTheme(prev => prev === "dark" ? "cad" : "dark")}
                        className={cn(
                            "px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all",
                            viewTheme === "cad"
                                ? "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400"
                                : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                        )}
                        title="Toggle CAD White Blueprint vs Dark Digital Twin"
                    >
                        <Sliders className="w-3.5 h-3.5" />
                        <span className="text-[10px] uppercase font-black">{viewTheme === "cad" ? "CAD White" : "Digital Twin"}</span>
                    </button>

                    {/* Expand / Wide View Toggle */}
                    {onToggleExpand && (
                        <button
                            onClick={onToggleExpand}
                            className={cn(
                                "px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all",
                                isExpanded
                                    ? "bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400"
                                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-white"
                            )}
                            title={isExpanded ? "Collapse to Side-by-Side View" : "Expand to Full Width"}
                        >
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span className="text-[10px] uppercase font-black">{isExpanded ? "Side-by-Side" : "Wide View"}</span>
                        </button>
                    )}

                    {/* Print 2D Report Button */}
                    <Button
                        onClick={() => setIsPrintModalOpen(true)}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/20 flex items-center gap-1.5 h-8 px-3"
                    >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print 2D Report</span>
                    </Button>
                </div>
            </div>

            {/* ═══ MAIN 2D SCHEMATIC CANVAS ═══ */}
            <div className="relative w-full rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl select-none group">
                {/* Floating Interactive Canvas Controls */}
                <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
                    {/* Zoom / Pan Bar */}
                    <div className="flex items-center gap-1 p-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg">
                        <button
                            onClick={handleZoomIn}
                            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                            title="Zoom In"
                        >
                            <ZoomIn className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleZoomOut}
                            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                            title="Zoom Out"
                        >
                            <ZoomOut className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleResetZoom}
                            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors text-[10px] font-black"
                            title="Reset 100%"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Layer Visibility Filters */}
                    <div className="p-2.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg space-y-1.5 text-[10px] font-black text-slate-600 dark:text-slate-300">
                        <div className="text-[9px] uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-200 dark:border-slate-800 font-extrabold">
                            Layers
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer hover:text-blue-500">
                            <input type="checkbox" checked={showNodes} onChange={(e) => setShowNodes(e.target.checked)} className="rounded" />
                            <span>Nodes (Joints)</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer hover:text-blue-500">
                            <input type="checkbox" checked={showMemberLabels} onChange={(e) => setShowMemberLabels(e.target.checked)} className="rounded" />
                            <span>Member Specs</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer hover:text-rose-500">
                            <input type="checkbox" checked={showAnomalies} onChange={(e) => setShowAnomalies(e.target.checked)} className="rounded" />
                            <span className="text-rose-500 font-black">Anomaly Flags ({filteredModel.anomalies.length})</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer hover:text-amber-500">
                            <input type="checkbox" checked={showAnodes} onChange={(e) => setShowAnodes(e.target.checked)} className="rounded" />
                            <span className="text-amber-500 font-black">Anodes CP ({filteredModel.anodes.length})</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-500">
                            <input type="checkbox" checked={showClamps} onChange={(e) => setShowClamps(e.target.checked)} className="rounded" />
                            <span className="text-indigo-500 font-black">Clamps &amp; Guides ({filteredModel.clamps.length})</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer hover:text-emerald-500">
                            <input type="checkbox" checked={showAppurtenances} onChange={(e) => setShowAppurtenances(e.target.checked)} className="rounded" />
                            <span className="text-emerald-500 font-black">Risers &amp; Caissons</span>
                        </label>
                    </div>
                </div>

                {/* SVG Render Container */}
                <div
                    className={cn(
                        "relative w-full h-[620px] overflow-hidden transition-colors duration-500 cursor-grab active:cursor-grabbing flex items-center justify-center",
                        viewTheme === "cad"
                            ? "bg-[#ffffff] text-slate-900"
                            : "bg-gradient-to-b from-sky-950/40 via-slate-950 to-[#02050f] text-slate-100"
                    )}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    <svg
                        className="w-full h-full max-w-[850px] transition-transform duration-75"
                        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                        style={{
                            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                            transformOrigin: "center center"
                        }}
                    >
                        {viewTheme === "cad" && (
                            <defs>
                                <pattern id="cadGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" strokeWidth="1" />
                                </pattern>
                            </defs>
                        )}
                        {viewTheme === "cad" && <rect width={svgWidth} height={svgHeight} fill="url(#cadGrid)" />}

                        {/* ─── 1. ELEVATION DATUM AXIS (LEFT SIDE) ─── */}
                        {showElevations && filteredModel.elevations.map(elv => {
                            const py = mapY(elv.elv);
                            const isMSL = Math.abs(elv.elv) < 0.01;
                            const strokeColor = viewTheme === "cad" ? "#0f172a" : "#38bdf8";

                            return (
                                <g key={`elv-${elv.elv}-${elv.name}`}>
                                    <line
                                        x1={paddingLeft - 30}
                                        y1={py}
                                        x2={svgWidth - paddingRight}
                                        y2={py}
                                        stroke={strokeColor}
                                        strokeWidth={isMSL ? "1.5" : "1"}
                                        strokeDasharray={isMSL ? "none" : "3,3"}
                                        opacity={isMSL ? 0.7 : 0.25}
                                    />
                                    <text
                                        x={paddingLeft - 35}
                                        y={py - 4}
                                        textAnchor="end"
                                        fontFamily="monospace"
                                        fontSize="9.5"
                                        fontWeight="800"
                                        fill={isMSL ? (viewTheme === "cad" ? "#0284c7" : "#38bdf8") : (viewTheme === "cad" ? "#475569" : "#94a3b8")}
                                    >
                                        {elv.elv >= 0 ? `EL (+) ${elv.elv.toFixed(1)}M` : `EL (-) ${Math.abs(elv.elv).toFixed(1)}M`}
                                    </text>

                                    {isMSL && (
                                        <g transform={`translate(${paddingLeft - 18}, ${py})`}>
                                            <polygon points="-6,0 0,6 6,0" fill={viewTheme === "cad" ? "#0284c7" : "#38bdf8"} />
                                            <line x1="-12" y1="8" x2="12" y2="8" stroke={strokeColor} strokeWidth="1.2" />
                                            <line x1="-7" y1="11" x2="7" y2="11" stroke={strokeColor} strokeWidth="1" />
                                        </g>
                                    )}
                                </g>
                            );
                        })}

                        {/* ─── 2. SEABED BATHYMETRY & SCOUR PROFILE ─── */}
                        <g>
                            <path
                                d={`M ${paddingLeft - 20},${mapY(-waterDepth)} Q ${mapX(0)},${mapY(-waterDepth) + 15} ${svgWidth - paddingRight + 20},${mapY(-waterDepth)}`}
                                fill="none"
                                stroke="#eab308"
                                strokeWidth="2"
                                strokeDasharray="4,4"
                            />
                            <text
                                x={mapX(0)}
                                y={mapY(-waterDepth) + 30}
                                textAnchor="middle"
                                fontSize="9"
                                fontWeight="800"
                                fill="#eab308"
                            >
                                SEABED MUDLINE &middot; DEPTH: {waterDepth.toFixed(1)}M LAT
                            </text>
                        </g>

                        {/* ─── 3. TOPSIDE DECK BOX (+15M) ─── */}
                        <g>
                            <rect
                                x={mapX(-projectedStructure.topHalfWidth * 0.9)}
                                y={mapY(18.0)}
                                width={mapX(projectedStructure.topHalfWidth * 0.9) - mapX(-projectedStructure.topHalfWidth * 0.9)}
                                height={mapY(15.0) - mapY(18.0)}
                                rx="4"
                                fill={viewTheme === "cad" ? "#f8fafc" : "#1e293b"}
                                stroke={viewTheme === "cad" ? "#0f172a" : "#64748b"}
                                strokeWidth="2"
                            />
                            <text
                                x={mapX(0)}
                                y={(mapY(18.0) + mapY(15.0)) / 2 + 4}
                                textAnchor="middle"
                                fontSize="10"
                                fontWeight="900"
                                letterSpacing="0.1em"
                                fill={viewTheme === "cad" ? "#0f172a" : "#f8fafc"}
                            >
                                TOPSIDE DECK &middot; {structureName.toUpperCase()}
                            </text>
                        </g>

                        {/* ─── 4. RISERS & CAISSONS ─── */}
                        {showAppurtenances && filteredModel.risersAndCaissons.map(rc => (
                            <g key={rc.id}>
                                <line
                                    x1={mapX(rc.x)}
                                    y1={mapY(rc.topY)}
                                    x2={mapX(rc.x)}
                                    y2={mapY(rc.bottomY)}
                                    stroke={rc.color}
                                    strokeWidth="3.5"
                                    strokeLinecap="round"
                                />
                                <text
                                    x={mapX(rc.x) + 6}
                                    y={mapY(-8.0)}
                                    fontSize="8"
                                    fontWeight="900"
                                    fill={rc.color}
                                    style={{ paintOrder: "stroke", stroke: viewTheme === "cad" ? "#ffffff" : "#020817", strokeWidth: 2 }}
                                >
                                    {rc.label}
                                </text>
                            </g>
                        ))}

                        {/* ─── 5. STRUCTURAL STEEL MEMBERS ─── */}
                        {filteredModel.members.map(member => {
                            const sx = mapX(member.startX);
                            const sy = mapY(member.startY);
                            const ex = mapX(member.endX);
                            const ey = mapY(member.endY);

                            const isSelected = selectedMember?.id === member.id;
                            let strokeColor = viewTheme === "cad" ? "#0f172a" : "#60a5fa";
                            let strokeWidth = member.isLeg ? 5 : 2.5;

                            if (member.condition === "CRITICAL") strokeColor = "#ef4444";
                            else if (member.condition === "FLOODED") strokeColor = "#06b6d4";
                            else if (member.condition === "ATTENTION") strokeColor = "#f59e0b";

                            if (isSelected) {
                                strokeColor = "#38bdf8";
                                strokeWidth += 2;
                            }

                            const mx = (sx + ex) / 2;
                            const my = (sy + ey) / 2;
                            let angleDeg = (Math.atan2(ey - sy, ex - sx) * 180) / Math.PI;
                            if (angleDeg > 90 || angleDeg < -90) angleDeg += 180;

                            return (
                                <g
                                    key={member.id}
                                    className="cursor-pointer transition-all"
                                    onClick={() => setSelectedMember(member)}
                                    onMouseEnter={() => setHoveredElement({ type: "MEMBER", id: member.id, label: `${member.label} (${member.isLeg ? "Leg" : "Brace"})` })}
                                    onMouseLeave={() => setHoveredElement(null)}
                                >
                                    <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="transparent" strokeWidth="18" />

                                    <line
                                        x1={sx}
                                        y1={sy}
                                        x2={ex}
                                        y2={ey}
                                        stroke={strokeColor}
                                        strokeWidth={strokeWidth}
                                        strokeLinecap="round"
                                    />

                                    {member.isLeg && viewTheme === "cad" && (
                                        <>
                                            <line x1={sx - 3} y1={sy} x2={ex - 3} y2={ey} stroke="#0f172a" strokeWidth="1.5" />
                                            <line x1={sx + 3} y1={sy} x2={ex + 3} y2={ey} stroke="#0f172a" strokeWidth="1.5" />
                                        </>
                                    )}

                                    {showMemberLabels && Math.hypot(ex - sx, ey - sy) > 40 && (
                                        <g transform={`translate(${mx}, ${my}) rotate(${angleDeg})`}>
                                            <text
                                                x="0"
                                                y="-5"
                                                textAnchor="middle"
                                                fontSize="7.5"
                                                fontWeight="800"
                                                fontFamily="sans-serif"
                                                fill={viewTheme === "cad" ? "#0f172a" : "#e2e8f0"}
                                                style={{
                                                    paintOrder: "stroke fill",
                                                    stroke: viewTheme === "cad" ? "#ffffff" : "#020817",
                                                    strokeWidth: "2.5px"
                                                }}
                                            >
                                                &oslash;{member.od}x{member.wt}WT
                                            </text>
                                        </g>
                                    )}
                                </g>
                            );
                        })}

                        {/* ─── 6. CLAMPS & GUIDES ─── */}
                        {showClamps && filteredModel.clamps.map(clamp => {
                            const cx = mapX(clamp.x);
                            const cy = mapY(clamp.y);
                            const isSelected = selectedClamp?.id === clamp.id;

                            return (
                                <g
                                    key={clamp.id}
                                    className="cursor-pointer transition-all"
                                    onClick={() => setSelectedClamp(clamp)}
                                    onMouseEnter={() => setHoveredElement({ type: "CLAMP", id: clamp.id, label: clamp.label })}
                                    onMouseLeave={() => setHoveredElement(null)}
                                >
                                    <rect
                                        x={cx - 7}
                                        y={cy - 4}
                                        width="14"
                                        height="8"
                                        rx="2"
                                        fill="#6366f1"
                                        stroke={isSelected ? "#ffffff" : "#312e81"}
                                        strokeWidth="1.5"
                                    />
                                    <circle cx={cx - 4} cy={cy} r="1" fill="#ffffff" />
                                    <circle cx={cx + 4} cy={cy} r="1" fill="#ffffff" />
                                    <text
                                        x={cx + 9}
                                        y={cy + 3}
                                        fontSize="7"
                                        fontWeight="800"
                                        fill="#818cf8"
                                        style={{ paintOrder: "stroke", stroke: viewTheme === "cad" ? "#ffffff" : "#020817", strokeWidth: 2 }}
                                    >
                                        CLP
                                    </text>
                                </g>
                            );
                        })}

                        {/* ─── 7. SACRIFICIAL ANODES (CP) ─── */}
                        {showAnodes && filteredModel.anodes.map(anode => {
                            const ax = mapX(anode.x);
                            const ay = mapY(anode.y);
                            const isSelected = selectedAnode?.id === anode.id;

                            const anodeColor =
                                anode.depletionPercent >= 80 ? "#ef4444" :
                                anode.depletionPercent >= 50 ? "#f59e0b" : "#10b981";

                            return (
                                <g
                                    key={anode.id}
                                    className="cursor-pointer transition-all"
                                    onClick={() => setSelectedAnode(anode)}
                                    onMouseEnter={() => setHoveredElement({ type: "ANODE", id: anode.id, label: `${anode.label} (${anode.depletionPercent}% Depleted)` })}
                                    onMouseLeave={() => setHoveredElement(null)}
                                >
                                    <line x1={ax} y1={ay} x2={ax + (anode.x > 0 ? 8 : -8)} y2={ay} stroke="#94a3b8" strokeWidth="1.5" />
                                    <rect
                                        x={anode.x > 0 ? ax + 8 : ax - 16}
                                        y={ay - 3.5}
                                        width="9"
                                        height="7"
                                        rx="1"
                                        fill={anodeColor}
                                        stroke={isSelected ? "#ffffff" : "#78350f"}
                                        strokeWidth="1"
                                    />
                                    <text
                                        x={anode.x > 0 ? ax + 20 : ax - 20}
                                        y={ay + 2}
                                        textAnchor={anode.x > 0 ? "start" : "end"}
                                        fontSize="6.5"
                                        fontWeight="800"
                                        fill={anodeColor}
                                    >
                                        Zn {anode.depletionPercent}%
                                    </text>
                                </g>
                            );
                        })}

                        {/* ─── 8. STRUCTURAL NODES (JOINTS) ─── */}
                        {showNodes && filteredModel.nodes.map(node => {
                            const nx = mapX(node.x);
                            const ny = mapY(node.y);
                            const isSelected = selectedNode?.id === node.id;

                            return (
                                <g
                                    key={node.id}
                                    className="cursor-pointer transition-all"
                                    onClick={() => setSelectedNode(node)}
                                    onMouseEnter={() => setHoveredElement({ type: "NODE", id: node.id, label: `Node ${node.label} (EL ${node.elevation.toFixed(1)}m)` })}
                                    onMouseLeave={() => setHoveredElement(null)}
                                >
                                    <circle
                                        cx={nx}
                                        cy={ny}
                                        r={isSelected ? "5" : "3.5"}
                                        fill={viewTheme === "cad" ? "#0f172a" : "#ffffff"}
                                        stroke={viewTheme === "cad" ? "#ffffff" : "#0284c7"}
                                        strokeWidth="1.5"
                                    />
                                    <text
                                        x={nx + (node.x > 0 ? 7 : -7)}
                                        y={ny - 5}
                                        textAnchor={node.x > 0 ? "start" : "end"}
                                        fontSize="8"
                                        fontWeight="900"
                                        fontFamily="monospace"
                                        fill={viewTheme === "cad" ? "#0f172a" : "#f8fafc"}
                                        style={{
                                            paintOrder: "stroke fill",
                                            stroke: viewTheme === "cad" ? "#ffffff" : "#020817",
                                            strokeWidth: "2.5px"
                                        }}
                                    >
                                        {node.label}
                                    </text>
                                </g>
                            );
                        })}

                        {/* ─── 9. ACTUAL ANOMALY FLAGS & CALLOUT BANNERS ─── */}
                        {showAnomalies && filteredModel.anomalies.map(anomaly => {
                            const ax = mapX(anomaly.x);
                            const ay = mapY(anomaly.y);
                            const isSelected = selectedAnomaly?.id === anomaly.id;

                            const isP1 = anomaly.priority === "P1";
                            const isP2 = anomaly.priority === "P2";
                            const badgeColor = isP1 ? "#ef4444" : isP2 ? "#f97316" : "#eab308";

                            return (
                                <g
                                    key={anomaly.id}
                                    className="cursor-pointer"
                                    onClick={() => setSelectedAnomaly(anomaly)}
                                    onMouseEnter={() => setHoveredElement({ type: "ANOMALY", id: anomaly.id, label: `${anomaly.priority} Anomaly: ${anomaly.defectType}` })}
                                    onMouseLeave={() => setHoveredElement(null)}
                                >
                                    <circle cx={ax} cy={ay} r="14" fill={badgeColor} opacity="0.25" className="animate-ping" />
                                    <circle cx={ax} cy={ay} r="5" fill={badgeColor} stroke="#ffffff" strokeWidth="1.5" />

                                    <polyline
                                        points={`${ax},${ay} ${ax + 20},${ay - 18} ${ax + 95},${ay - 18}`}
                                        fill="none"
                                        stroke={badgeColor}
                                        strokeWidth="1.5"
                                    />

                                    <rect
                                        x={ax + 20}
                                        y={ay - 30}
                                        width="85"
                                        height="20"
                                        rx="4"
                                        fill={badgeColor}
                                        stroke="#ffffff"
                                        strokeWidth="1"
                                        className="shadow-lg"
                                    />
                                    <text
                                        x={ax + 25}
                                        y={ay - 17}
                                        fontSize="7.5"
                                        fontWeight="900"
                                        fill="#ffffff"
                                        letterSpacing="0.05em"
                                    >
                                        [{anomaly.priority}] {anomaly.defectType.slice(0, 10)}..
                                    </text>
                                </g>
                            );
                        })}

                        {/* ─── 10. TOP COLUMN INDICATOR AXIS CIRCLES ─── */}
                        <g>
                            <g transform={`translate(${mapX(-projectedStructure.topHalfWidth * 0.85)}, ${paddingTop - 45})`}>
                                <line x1="0" y1="16" x2="0" y2={mapY(15.0) - (paddingTop - 45)} stroke={viewTheme === "cad" ? "#0f172a" : "#64748b"} strokeWidth="1.2" strokeDasharray="3,3" />
                                <circle cx="0" cy="0" r="14" fill={viewTheme === "cad" ? "#ffffff" : "#1e293b"} stroke={viewTheme === "cad" ? "#0f172a" : "#38bdf8"} strokeWidth="2" />
                                <text x="0" y="4" textAnchor="middle" fontSize="10" fontWeight="900" fill={viewTheme === "cad" ? "#0f172a" : "#ffffff"}>
                                    {filteredModel.colLeftLabel}
                                </text>
                            </g>
                            <g transform={`translate(${mapX(projectedStructure.topHalfWidth * 0.85)}, ${paddingTop - 45})`}>
                                <line x1="0" y1="16" x2="0" y2={mapY(15.0) - (paddingTop - 45)} stroke={viewTheme === "cad" ? "#0f172a" : "#64748b"} strokeWidth="1.2" strokeDasharray="3,3" />
                                <circle cx="0" cy="0" r="14" fill={viewTheme === "cad" ? "#ffffff" : "#1e293b"} stroke={viewTheme === "cad" ? "#0f172a" : "#38bdf8"} strokeWidth="2" />
                                <text x="0" y="4" textAnchor="middle" fontSize="10" fontWeight="900" fill={viewTheme === "cad" ? "#0f172a" : "#ffffff"}>
                                    {filteredModel.colRightLabel}
                                </text>
                            </g>
                        </g>

                        {/* Centered Drawing Title */}
                        <text
                            x={svgWidth / 2}
                            y={svgHeight - 15}
                            textAnchor="middle"
                            fontSize="12"
                            fontWeight="900"
                            letterSpacing="0.1em"
                            fill={viewTheme === "cad" ? "#0f172a" : "#94a3b8"}
                        >
                            ELEVATION {selectedFace} &middot; {structureName.toUpperCase()} PLATFORM
                        </text>
                    </svg>

                    {/* Bottom Floating Hover Status Bar */}
                    <div className="absolute bottom-3 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
                        <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[11px] font-bold text-slate-300 shadow-md">
                            {hoveredElement ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                    <strong className="text-white">{hoveredElement.type}:</strong> {hoveredElement.label}
                                </span>
                            ) : (
                                <span className="text-slate-400">Hover or click any node, member, anode, clamp, or anomaly flag to inspect</span>
                            )}
                        </div>

                        <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[10px] font-black text-slate-300 flex items-center gap-3">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Member</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> P1 Defect</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Anode</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Clamp</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Riser</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ INTERACTIVE COMPONENT INSPECTION CARD (ON CLICK) ═══ */}
            {(selectedMember || selectedAnomaly || selectedNode || selectedAnode || selectedClamp) && (
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg animate-in fade-in duration-300 relative">
                    <button
                        onClick={() => {
                            setSelectedMember(null);
                            setSelectedAnomaly(null);
                            setSelectedNode(null);
                            setSelectedAnode(null);
                            setSelectedClamp(null);
                        }}
                        className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    {/* Member Details */}
                    {selectedMember && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase",
                                    selectedMember.condition === "CRITICAL" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400" :
                                    selectedMember.condition === "FLOODED" ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400" :
                                    selectedMember.condition === "ATTENTION" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" :
                                    "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
                                )}>
                                    {selectedMember.condition}
                                </span>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                                    {selectedMember.label} ({selectedMember.isLeg ? "Tubular Jacket Leg" : "Bracing Tubular Member"})
                                </h3>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Dimensions</span>
                                    <span className="font-black text-slate-800 dark:text-white">&oslash;{selectedMember.od} mm &times; {selectedMember.wt} mm WT</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Member Length</span>
                                    <span className="font-black text-slate-800 dark:text-white">{selectedMember.length.toFixed(1)} meters</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Connected Nodes</span>
                                    <span className="font-black text-slate-800 dark:text-white">{selectedMember.startNodeId} &rarr; {selectedMember.endNodeId}</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Framing Face</span>
                                    <span className="font-black text-slate-800 dark:text-white">{selectedMember.face}</span>
                                </div>
                            </div>

                            {/* Inspection history */}
                            {selectedMember.inspections && selectedMember.inspections.length > 0 && (
                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5 flex items-center gap-1">
                                        <ClipboardList className="w-3.5 h-3.5 text-blue-500" />
                                        Inspection Records ({selectedMember.inspections.length})
                                    </span>
                                    <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                                        {selectedMember.inspections.slice(0, 3).map((insp: any, idx: number) => (
                                            <div key={idx} className="text-[11px] p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
                                                <div>
                                                    <span className="font-bold text-blue-600 dark:text-blue-400 mr-2">[{insp.inspection_type_code || "INSP"}]</span>
                                                    <span className="text-slate-700 dark:text-slate-300">{insp.description || "Routine inspection conducted"}</span>
                                                </div>
                                                <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                                                    {insp.inspection_date ? new Date(insp.inspection_date).toLocaleDateString("en-GB") : ""}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Anomaly Details */}
                    {selectedAnomaly && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase text-white",
                                    selectedAnomaly.priority === "P1" ? "bg-rose-600" :
                                    selectedAnomaly.priority === "P2" ? "bg-orange-500" : "bg-amber-500"
                                )}>
                                    PRIORITY {selectedAnomaly.priority}
                                </span>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                                    {selectedAnomaly.refNo} &middot; {selectedAnomaly.defectType}
                                </h3>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                                {selectedAnomaly.description}
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Component</span>
                                    <span className="font-black text-slate-800 dark:text-white">{selectedAnomaly.componentName}</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Elevation</span>
                                    <span className="font-black text-slate-800 dark:text-white">{selectedAnomaly.elevation.toFixed(1)}m</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 md:col-span-2">
                                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Mitigation Action Plan</span>
                                    <span className="font-bold text-rose-600 dark:text-rose-400">{selectedAnomaly.mitigationPlan}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Node Details */}
                    {selectedNode && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400">
                                    STRUCTURAL NODE
                                </span>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                                    Node Joint {selectedNode.label} (Elevation {selectedNode.elevation >= 0 ? `+${selectedNode.elevation.toFixed(1)}m` : `${selectedNode.elevation.toFixed(1)}m`})
                                </h3>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Framing Coordinates (X, Y)</span>
                                    <span className="font-black text-slate-800 dark:text-white font-mono">[{selectedNode.x.toFixed(1)}, {selectedNode.y.toFixed(1)}]</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 md:col-span-2">
                                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Framing Member Connections</span>
                                    <span className="font-bold text-slate-800 dark:text-white">{selectedNode.connectedMembers.join(" &middot; ")}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Anode Details */}
                    {selectedAnode && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase text-white",
                                    selectedAnode.status === "OPTIMAL" ? "bg-emerald-600" :
                                    selectedAnode.status === "MARGINAL" ? "bg-amber-500" : "bg-rose-600"
                                )}>
                                    {selectedAnode.status}
                                </span>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                                    Sacrificial Anode {selectedAnode.label} &middot; {selectedAnode.depletionPercent}% Depleted
                                </h3>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-400 block uppercase">CP Potential (Ag/AgCl)</span>
                                    <span className="font-black text-slate-800 dark:text-white">{selectedAnode.potentialMv} mV</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Anode Material</span>
                                    <span className="font-black text-slate-800 dark:text-white">{selectedAnode.type} ALLOY</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Mounting Member / Leg</span>
                                    <span className="font-black text-slate-800 dark:text-white">{selectedAnode.memberId}</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Elevation Level</span>
                                    <span className="font-black text-slate-800 dark:text-white">{selectedAnode.y.toFixed(1)}m</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Clamp Details */}
                    {selectedClamp && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase",
                                    selectedClamp.condition === "TIGHT" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" :
                                    "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400"
                                )}>
                                    {selectedClamp.condition}
                                </span>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                                    {selectedClamp.label} &middot; {selectedClamp.type.replace("_", " ")}
                                </h3>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Supported Pipeline</span>
                                    <span className="font-black text-slate-800 dark:text-white">{selectedClamp.associatedPipe}</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Bolt Integrity</span>
                                    <span className="font-black text-slate-800 dark:text-white">{selectedClamp.boltsIntact} of {selectedClamp.boltsTotal} Tight</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Support Member</span>
                                    <span className="font-black text-slate-800 dark:text-white">{selectedClamp.memberId}</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Elevation</span>
                                    <span className="font-black text-slate-800 dark:text-white">{selectedClamp.y.toFixed(1)}m</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ PRINTABLE 2D REPORT MODAL WITH FORMAL HEADER & FOOTER ═══ */}
            <Dialog open={isPrintModalOpen} onOpenChange={setIsPrintModalOpen}>
                <DialogContent className="max-w-5xl bg-white text-slate-900 border-slate-300 p-0 overflow-y-auto max-h-[92vh] rounded-3xl shadow-2xl print:m-0 print:p-0 print:border-none print:shadow-none print:max-h-none print:overflow-visible">
                    <div className="flex items-center justify-between p-4 bg-slate-900 text-white border-b border-slate-800 print:hidden">
                        <div className="flex items-center gap-2">
                            <Printer className="w-5 h-5 text-blue-400" />
                            <div>
                                <DialogTitle className="text-sm font-black uppercase text-white">
                                    Print 2D Structural Elevation Report
                                </DialogTitle>
                                <DialogDescription className="text-[11px] text-slate-400">
                                    Official asset integrity drawing based on actual database components &amp; inspection findings for {structureName}.
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={triggerBrowserPrint}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-4 h-9 rounded-xl shadow-md flex items-center gap-2"
                            >
                                <Printer className="w-4 h-4" />
                                <span>Print / Save PDF</span>
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setIsPrintModalOpen(false)}
                                className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold h-9 rounded-xl"
                            >
                                Close
                            </Button>
                        </div>
                    </div>

                    <div id="print-area" className="p-8 space-y-6 bg-white text-black font-sans">
                        {/* ─── 1. FORMAL OFFSHORE HEADER ─── */}
                        <div className="border-2 border-black p-4 rounded-xl space-y-3">
                            <div className="flex items-center justify-between border-b-2 border-black pb-3">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 bg-black text-white font-black flex items-center justify-center text-lg rounded-lg">
                                        PET
                                    </div>
                                    <div>
                                        <h1 className="text-lg font-black tracking-tight uppercase leading-none">
                                            OFFSHORE ASSET INTEGRITY MANAGEMENT SYSTEM
                                        </h1>
                                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest block mt-0.5">
                                            STRUCTURAL 2D ELEVATION SCHEMATIC &amp; INSPECTION REPORT
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right text-[10px] font-mono leading-tight">
                                    <div><strong>DOC REF:</strong> STR-2D-{structureName.toUpperCase()}-{selectedFace.replace(/\s+/g, "")}</div>
                                    <div><strong>REV:</strong> 01 &middot; AS-INSPECTED</div>
                                    <div><strong>DATE:</strong> {new Date().toLocaleDateString("en-GB")}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2 text-[10px] pt-1">
                                <div><span className="text-slate-500 uppercase block font-bold">Platform:</span> <strong className="text-xs uppercase">{structureName}</strong></div>
                                <div><span className="text-slate-500 uppercase block font-bold">Field:</span> <strong className="text-xs uppercase">{fieldName}</strong></div>
                                <div><span className="text-slate-500 uppercase block font-bold">Water Depth:</span> <strong className="text-xs">{waterDepth.toFixed(1)}m LAT</strong></div>
                                <div><span className="text-slate-500 uppercase block font-bold">Framing Face:</span> <strong className="text-xs">{selectedFace} ({selectedPhase.replace("_", " ")})</strong></div>
                            </div>
                        </div>

                        {/* ─── 2. HIGH-RES CAD 2D ELEVATION SCHEMATIC ─── */}
                        <div className="border-2 border-black rounded-xl p-4 flex flex-col items-center bg-white">
                            <div className="text-center pb-2 mb-2 border-b border-black w-full flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider">ELEVATION {selectedFace} &middot; ACTUAL PLATFORM GEOMETRY</span>
                                <span className="text-[9px] font-mono text-slate-500">SCALE: 1:150 CAD PROJECTION</span>
                            </div>

                            <svg className="w-full h-auto max-w-[620px]" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
                                {filteredModel.elevations.map(elv => {
                                    const py = mapY(elv.elv);
                                    const isMSL = Math.abs(elv.elv) < 0.01;
                                    return (
                                        <g key={`print-elv-${elv.elv}`}>
                                            <line x1={paddingLeft - 30} y1={py} x2={svgWidth - paddingRight} y2={py} stroke="#000000" strokeWidth="1" strokeDasharray="3,3" />
                                            <text x={paddingLeft - 35} y={py - 3} textAnchor="end" fontSize="9.5" fontWeight="bold" fill="#000000">
                                                {elv.elv >= 0 ? `EL (+) ${elv.elv.toFixed(1)}M` : `EL (-) ${Math.abs(elv.elv).toFixed(1)}M`}
                                            </text>
                                            {isMSL && (
                                                <polygon points={`${paddingLeft - 18},${py} ${paddingLeft - 12},${py + 6} ${paddingLeft - 6},${py}`} fill="#000000" />
                                            )}
                                        </g>
                                    );
                                })}

                                <rect
                                    x={mapX(-projectedStructure.topHalfWidth * 0.9)}
                                    y={mapY(18.0)}
                                    width={mapX(projectedStructure.topHalfWidth * 0.9) - mapX(-projectedStructure.topHalfWidth * 0.9)}
                                    height={mapY(15.0) - mapY(18.0)}
                                    fill="#ffffff"
                                    stroke="#000000"
                                    strokeWidth="2"
                                />
                                <text x={mapX(0)} y={(mapY(18.0) + mapY(15.0)) / 2 + 4} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#000000">
                                    TOPSIDE DECK &middot; {structureName.toUpperCase()}
                                </text>

                                <line x1={mapX(-projectedStructure.bottomHalfWidth * 1.1)} y1={mapY(-waterDepth)} x2={mapX(projectedStructure.bottomHalfWidth * 1.1)} y2={mapY(-waterDepth)} stroke="#000000" strokeWidth="2" strokeDasharray="4,4" />
                                <text x={mapX(0)} y={mapY(-waterDepth) + 20} textAnchor="middle" fontSize="8" fontWeight="bold" fill="#000000">
                                    MUDLINE LEVEL (-{waterDepth.toFixed(1)}M)
                                </text>

                                {filteredModel.risersAndCaissons.map(rc => (
                                    <g key={`print-rc-${rc.id}`}>
                                        <line x1={mapX(rc.x)} y1={mapY(rc.topY)} x2={mapX(rc.x)} y2={mapY(rc.bottomY)} stroke="#000000" strokeWidth="2.5" />
                                        <text x={mapX(rc.x) + 5} y={mapY(-8.0)} fontSize="8" fontWeight="bold" fill="#000000">{rc.label}</text>
                                    </g>
                                ))}

                                {filteredModel.members.map(member => {
                                    const sx = mapX(member.startX);
                                    const sy = mapY(member.startY);
                                    const ex = mapX(member.endX);
                                    const ey = mapY(member.endY);

                                    return (
                                        <g key={`print-m-${member.id}`}>
                                            <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#000000" strokeWidth={member.isLeg ? "4" : "2"} />
                                            {member.isLeg && (
                                                <>
                                                    <line x1={sx - 3} y1={sy} x2={ex - 3} y2={ey} stroke="#000000" strokeWidth="1" />
                                                    <line x1={sx + 3} y1={sy} x2={ex + 3} y2={ey} stroke="#000000" strokeWidth="1" />
                                                </>
                                            )}
                                        </g>
                                    );
                                })}

                                {filteredModel.nodes.map(node => (
                                    <g key={`print-n-${node.id}`}>
                                        <circle cx={mapX(node.x)} cy={mapY(node.y)} r="3.5" fill="#000000" stroke="#ffffff" strokeWidth="1" />
                                        <text
                                            x={mapX(node.x) + (node.x > 0 ? 6 : -6)}
                                            y={mapY(node.y) - 4}
                                            textAnchor={node.x > 0 ? "start" : "end"}
                                            fontSize="8"
                                            fontWeight="bold"
                                            fill="#000000"
                                        >
                                            {node.label}
                                        </text>
                                    </g>
                                ))}

                                {filteredModel.anomalies.map(anomaly => {
                                    const ax = mapX(anomaly.x);
                                    const ay = mapY(anomaly.y);
                                    return (
                                        <g key={`print-a-${anomaly.id}`}>
                                            <circle cx={ax} cy={ay} r="4" fill="#000000" />
                                            <polyline points={`${ax},${ay} ${ax + 20},${ay - 16} ${ax + 90},${ay - 16}`} fill="none" stroke="#000000" strokeWidth="1.5" />
                                            <rect x={ax + 20} y={ay - 28} width="75" height="18" fill="#ffffff" stroke="#000000" strokeWidth="1.5" />
                                            <text x={ax + 24} y={ay - 16} fontSize="7" fontWeight="bold" fill="#000000">
                                                [{anomaly.priority}] {anomaly.defectType.slice(0, 11)}..
                                            </text>
                                        </g>
                                    );
                                })}

                                <g transform={`translate(${mapX(-projectedStructure.topHalfWidth * 0.85)}, ${paddingTop - 45})`}>
                                    <circle cx="0" cy="0" r="14" fill="#ffffff" stroke="#000000" strokeWidth="2" />
                                    <text x="0" y="4" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#000000">{filteredModel.colLeftLabel}</text>
                                </g>
                                <g transform={`translate(${mapX(projectedStructure.topHalfWidth * 0.85)}, ${paddingTop - 45})`}>
                                    <circle cx="0" cy="0" r="14" fill="#ffffff" stroke="#000000" strokeWidth="2" />
                                    <text x="0" y="4" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#000000">{filteredModel.colRightLabel}</text>
                                </g>
                            </svg>
                        </div>

                        {/* ─── 3. ANOMALY REGISTER TABLE (ACTUAL PLATFORM ANOMALIES) ─── */}
                        <div className="border border-black rounded-xl overflow-hidden">
                            <div className="bg-black text-white p-2 text-xs font-black uppercase tracking-wider flex items-center justify-between">
                                <span>Active Structural Anomaly Register &middot; {selectedFace}</span>
                                <span className="text-[10px] font-normal">
                                    {filteredModel.anomalies.length > 0
                                        ? `${filteredModel.anomalies.length} Face Anomalies`
                                        : `${filteredModel.allPlatformAnomalies.length} Platform Anomalies Logged`}
                                </span>
                            </div>
                            {(filteredModel.anomalies.length > 0 ? filteredModel.anomalies : filteredModel.allPlatformAnomalies).length > 0 ? (
                                <table className="w-full text-left text-[10px] border-collapse">
                                    <thead>
                                        <tr className="border-b border-black bg-slate-100 font-bold">
                                            <th className="p-2 border-r border-black">Ref No</th>
                                            <th className="p-2 border-r border-black">Component</th>
                                            <th className="p-2 border-r border-black">Priority</th>
                                            <th className="p-2 border-r border-black">Elevation</th>
                                            <th className="p-2 border-r border-black">Defect Summary</th>
                                            <th className="p-2">Recommended Mitigation</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(filteredModel.anomalies.length > 0 ? filteredModel.anomalies : filteredModel.allPlatformAnomalies).map((anom, idx) => {
                                            const refNo = anom.refNo || anom.display_ref_no || anom.anomaly_ref_no || `ANO-${structureName}-${idx + 1}`;
                                            const compName = anom.componentName || anom.component_qid || anom.component_name || "Platform Member";
                                            const priority = (anom.priority || "P2").toUpperCase();
                                            const elvVal = anom.elevation !== undefined ? Number(anom.elevation).toFixed(1) : "N/A";
                                            const desc = anom.description || anom.defect_description || "Inspection finding";
                                            const action = anom.mitigationPlan || anom.recommended_action || anom.mitigation_plan || "Integrity review";

                                            return (
                                                <tr key={anom.id || idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                                    <td className="p-2 border-r border-black font-mono font-bold">{refNo}</td>
                                                    <td className="p-2 border-r border-black font-bold">{compName}</td>
                                                    <td className="p-2 border-r border-black font-black">
                                                        <span className={cn(
                                                            "px-1.5 py-0.5 rounded text-[9px] font-black",
                                                            priority === "P1" ? "bg-rose-100 text-rose-700" :
                                                            priority === "P2" ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700"
                                                        )}>
                                                            {priority}
                                                        </span>
                                                    </td>
                                                    <td className="p-2 border-r border-black">{elvVal}m</td>
                                                    <td className="p-2 border-r border-black">{desc}</td>
                                                    <td className="p-2 font-bold">{action}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="p-4 text-center text-xs text-slate-500 italic">
                                    No active anomalies reported on {selectedFace} for {structureName}. All components integrity verified.
                                </div>
                            )}
                        </div>

                        {/* ─── 4. FORMAL SIGN-OFF FOOTER ─── */}
                        <div className="border-2 border-black p-4 rounded-xl space-y-4">
                            <div className="grid grid-cols-3 gap-6 text-[10px]">
                                <div className="space-y-4">
                                    <span className="font-bold text-slate-500 uppercase block">Prepared By (Integrity Engineer):</span>
                                    <div className="h-8 border-b border-black flex items-end font-serif italic text-xs">
                                        Subsea Inspection Engineer
                                    </div>
                                    <div className="text-[9px] text-slate-500">Date: {new Date().toLocaleDateString("en-GB")}</div>
                                </div>
                                <div className="space-y-4">
                                    <span className="font-bold text-slate-500 uppercase block">Checked By (Senior Structural Lead):</span>
                                    <div className="h-8 border-b border-black flex items-end font-serif italic text-xs">
                                        Lead Structural Analyst
                                    </div>
                                    <div className="text-[9px] text-slate-500">Date: {new Date().toLocaleDateString("en-GB")}</div>
                                </div>
                                <div className="space-y-4">
                                    <span className="font-bold text-slate-500 uppercase block">Approved By (Asset Integrity OIM):</span>
                                    <div className="h-8 border-b border-black flex items-end font-serif italic text-xs">
                                        Asset Integrity Manager
                                    </div>
                                    <div className="text-[9px] text-slate-500">Date: {new Date().toLocaleDateString("en-GB")}</div>
                                </div>
                            </div>

                            <div className="border-t border-black pt-2 flex items-center justify-between text-[9px] text-slate-500 font-mono">
                                <span>CONFIDENTIALITY: STRICTLY FOR PETRONAS / OFFSHORE ASSET INTEGRITY USE</span>
                                <span>PAGE 1 OF 1</span>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
