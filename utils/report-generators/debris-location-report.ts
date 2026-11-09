import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { createClient } from "@/utils/supabase/client";
import {
    loadLogoWithTransparency,
    draw3SectionHeader,
    applyWatermarkAndSignaturesGlobal,
    formatPdfDate,
    REPORT_FOOTER_APP_TEXT
} from "./shared-logo";
import type { CompanySettings, ReportConfig } from "./defect-anomaly-report";
import {
    DebrisFlag,
    MaterialClass,
    SketchHeaderMeta,
    SketchMember,
    Vec3,
    chooseElevationAxis,
    drawElevationView,
    drawFlagLegend,
    drawMemberDetail,
    drawPanelTitle,
    drawPlanView,
    findHostStructuralMember,
    formatElev3D,
    isAnodeMember,
    isHorizontalMember,
    isPointMember,
    isWeldMember,
    lerp3,
    memberLength,
    resolveFaceSubtitle,
    toNum
} from "./member-sketch";

/* -------------------------------------------------------------------------- */
/*  Debris classification + auto placement                                    */
/* -------------------------------------------------------------------------- */

const NON_METAL_RE = /non[\s_-]*metal/i;
const METAL_TYPE_RE = /scaffold|pipe|tubular|ladder|grating|drum|handrail|boat\s*landing|steel|chain|wire|stair|anchor|beam/i;
const NON_METAL_TYPE_RE = /rope|net\b|nets\b|tyre|tire|wood|sand\s*bag|rubber|plastic|fishing|block|concrete|rock|boulder|soft\s*line/i;
const TOUCHING_RE = /in\s*contact|touching|entangle|resting\s*on|lying\s*on|attached|wrapped|draped|snagged|caught/i;
const NOT_TOUCHING_RE = /not\s*(in\s*)?contact|no\s*contact|not\s*touching|not\s*entangle/i;
const HANGING_RE = /rope|net\b|nets\b|line\b|hang|dangl|suspend|entangle|wrap|drap|chain|wire/i;

export const classifyMaterial = (material: string, type: string, desc: string): MaterialClass => {
    const mat = `${material}`.trim();
    const all = `${mat} ${type} ${desc}`;
    if (NON_METAL_RE.test(all)) return "non-metallic";
    if (/metal/i.test(mat)) return "metallic";
    if (NON_METAL_TYPE_RE.test(`${type} ${desc}`)) return "non-metallic";
    if (/metal/i.test(`${type} ${desc}`) || METAL_TYPE_RE.test(`${type} ${desc}`)) return "metallic";
    return "unknown";
};

export const parseClockPosition = (raw: any): number | null => {
    if (raw === undefined || raw === null || String(raw).trim() === "") return null;
    const m = String(raw).match(/(\d{1,2})/);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    if (n < 1 || n > 12) return null;
    return (n % 12) * 30;
};

const clockLabel = (deg: number): string => {
    const hr = Math.round(deg / 30) % 12;
    return `${hr === 0 ? 12 : hr} o'clock`;
};

interface DebrisItem {
    record: any;
    flag: DebrisFlag;
    typeText: string;
    materialText: string;
    elevText: string;
    positionLines: string[];
    findingsText: string;
}

const fmtElev = (el: number | null | undefined): string => {
    if (el === null || el === undefined || !Number.isFinite(el)) return "N/A";
    return el < 0 ? `(-) ${Math.abs(el)}m` : `(+) ${el}m`;
};

const cleanText = (v: any) => String(v ?? "").replace(/\s+/g, " ").trim();

/**
 * Builds a numbered flag for every debris record on one member.
 * When clock position or distance along the member is not recorded, a logical
 * position is assumed and the flag is marked as approximate.
 */
export const buildDebrisItems = (records: any[], member: SketchMember | null): DebrisItem[] => {
    const len = member ? memberLength(member) : 0;
    const pointLike = member ? isPointMember(member) : false;
    const horizontal = member ? isHorizontalMember(member) : false;
    const swap = member && !horizontal && member.end[1] > member.start[1] + 0.05;

    const items: DebrisItem[] = records.map((record, idx) => {
        const type = cleanText(record.debris_type);
        const materialText = cleanText(record.debris_material);
        const desc = cleanText(record.debris_desc);
        const findings = cleanText(record.findings);
        const mixedText = `${materialText} ${findings} ${desc}`;

        const material = classifyMaterial(materialText, type, desc);
        const touching = TOUCHING_RE.test(mixedText) && !NOT_TOUCHING_RE.test(mixedText);
        const hazardous = /hazard/i.test(mixedText);

        // Around the member
        const recordedClock = parseClockPosition(record.clock_raw);
        const hanging = HANGING_RE.test(`${type} ${desc} ${findings}`);
        const clockDeg = recordedClock !== null ? recordedClock : hanging ? 180 : 0;
        const clockApprox = recordedClock === null;

        let t = 0.5;
        let alongApprox = true;

        const elev: number | null = record.elevation !== null && record.elevation !== undefined && Number.isFinite(Number(record.elevation))
            ? Number(record.elevation)
            : null;

        if (member && !pointLike && !horizontal && elev !== null) {
            const y0 = member.start[1];
            const y1 = member.end[1];
            // Clamped to the member when the recorded elevation falls slightly outside its range
            const raw = (elev - y0) / (y1 - y0);
            t = Math.min(1, Math.max(0, raw));
            alongApprox = false;
        } else if (member && pointLike) {
            t = 0.5;
            alongApprox = false; // the member is a single node
        }

        const explicitRef = cleanText(record.display_ref_no || record.anomaly_ref_no || record.ref_no);
        const qidShort = cleanText(member?.qid || record.component_qid);
        const calloutLabel = explicitRef
            || (records.length === 1 && qidShort ? qidShort : `D-${String(idx + 1).padStart(3, "0")}`);

        const flag: DebrisFlag = {
            n: idx + 1,
            t,
            clockDeg,
            material,
            touching,
            hazardous,
            approx: alongApprox || clockApprox,
            label: calloutLabel
        };

        return {
            record,
            flag,
            typeText: type || "Debris",
            materialText,
            elevText: fmtElev(elev),
            positionLines: [],
            findingsText: findings || desc
        };
    });

    // Spread flags that had no usable position evenly along the member
    const needSpread = items.filter(i => {
        if (!member || pointLike) return false;
        const hasElevPosition = !horizontal && i.record.elevation !== null && i.record.elevation !== undefined && Number.isFinite(Number(i.record.elevation));
        return !hasElevPosition;
    });
    needSpread.forEach((it, k) => {
        it.flag.t = (k + 1) / (needSpread.length + 1);
        it.flag.approx = true;
    });

    // Point components (single node): several items would sit on the same spot, so fan out
    // flags whose clock position was assumed and would otherwise coincide
    if (member && pointLike) {
        const seen = new Map<number, number>();
        items.forEach(it => {
            if (parseClockPosition(it.record.clock_raw) !== null) return;
            const k = seen.get(it.flag.clockDeg) || 0;
            seen.set(it.flag.clockDeg, k + 1);
            if (k > 0) it.flag.clockDeg = (it.flag.clockDeg + k * 40) % 360;
        });
    }

    // Keep markers readable: nudge flags that land almost on top of each other
    const byT = [...items].sort((a, b) => a.flag.t - b.flag.t);
    for (let i = 1; i < byT.length; i++) {
        if (byT[i].flag.t - byT[i - 1].flag.t < 0.025) {
            byT[i].flag.t = Math.min(0.98, byT[i - 1].flag.t + 0.03);
        }
    }

    // Describe each position in words (matches what is drawn)
    items.forEach(it => {
        const f = it.flag;
        const rec = it.record;
        const recordedClock = parseClockPosition(rec.clock_raw) !== null;
        const elevOk = !horizontal && member && !pointLike && rec.elevation !== null && rec.elevation !== undefined;
        if (member && !pointLike && len > 0) {
            const dist = (swap ? 1 - f.t : f.t) * len;
            const from = horizontal ? "start node" : "upper end";
            const evidence = elevOk ? "from recorded elevation" : "assumed";
            it.positionLines.push(`Along member: ${Math.round(dist * 10) / 10} m from ${from} (${evidence})`);
        } else if (member && pointLike) {
            it.positionLines.push("At node / point component");
        }
        it.positionLines.push(`Clock: ${clockLabel(f.clockDeg)} (${recordedClock ? "recorded" : "assumed"})`);
        if (rec.face) it.positionLines.push(`Face: ${cleanText(rec.face)}`);
    });

    return items;
};

/* -------------------------------------------------------------------------- */
/*  Report                                                                    */
/* -------------------------------------------------------------------------- */

/** Pull every 3D member of the structure (webapp_3d coordinates enriched by the platform API) */
const fetchStructureMembers = async (structureId: string | number | undefined) => {
    const all: (SketchMember & { compId: number | null; isFoundation?: boolean })[] = [];
    if (!structureId || String(structureId) === "0") return all;
    try {
        const res = await fetch(`/api/platform/webapp-3d/${structureId}`, { cache: "no-store" });
        if (!res.ok) return all;
        const json = await res.json();
        const comps: any[] = json?.data?.components || [];
        comps.forEach(c => {
            const start: Vec3 = [toNum(c.start_x), toNum(c.start_y), toNum(c.start_z)];
            const end: Vec3 = [toNum(c.end_x, start[0]), toNum(c.end_y, start[1]), toNum(c.end_z, start[2])];
            const compIdRaw = c.comp_id ?? c.id ?? c.component_id;
            const compId = Number(String(compIdRaw ?? "").split("-seg-")[0]);
            const sc = c.structure_components || {};
            const md = c.metadata || sc.metadata || {};
            const qid = String(c.q_id || sc.q_id || "").trim();
            const code = String(c.code || sc.code || "").trim();

            let sNode = String(md.s_node || md.start_node || md.Node_1 || md.node_1 || c.s_node || sc.s_node || "").trim();
            let fNode = String(md.f_node || md.end_node || md.Node_2 || md.node_2 || c.f_node || sc.f_node || "").trim();
            if (!sNode && !fNode) {
                const pairMatch = qid.match(/\b(N?\d+)\s*-\s*(N?\d+)\b/i);
                if (pairMatch) {
                    sNode = pairMatch[1].toUpperCase();
                    fNode = pairMatch[2].toUpperCase();
                } else if (/^(?:WN|WP|ND|NODE)\b/i.test(qid) || ["WN", "WP", "ND"].includes(code.toUpperCase())) {
                    const wnMatch = qid.match(/(?:WN|WP|ND|NODE)\s*[-_]?\s*(N?\d+[A-Z]?)/i);
                    if (wnMatch) {
                        sNode = wnMatch[1].toUpperCase();
                        fNode = sNode;
                    }
                }
            }

            let sLeg = String(md.s_leg || md.leg || md.start_leg || c.s_leg || sc.s_leg || "").trim().toUpperCase();
            let fLeg = String(md.f_leg || md.end_leg || c.f_leg || sc.f_leg || "").trim().toUpperCase();
            if (!sLeg && !fLeg) {
                const legsInQid = qid.match(/\b([A-Z]\d+)\b/gi);
                if (legsInQid && legsInQid.length >= 1) {
                    sLeg = legsInQid[0].toUpperCase();
                    fLeg = (legsInQid[1] || legsInQid[0]).toUpperCase();
                }
            }
            const face = String(md.face || c.face || sc.face || "").trim().toUpperCase();
            const assocRaw = md.associated_comp_id ?? c.associated_comp_id ?? sc.associated_comp_id;
            const assocId = Number(assocRaw);
            const hasAnomaly = Boolean(c.has_anomaly || c.inspection_color === "red");

            all.push({
                qid,
                code,
                start,
                end,
                sNode,
                fNode,
                sLeg,
                fLeg,
                face,
                compId: Number.isFinite(compId) && compId > 0 ? compId : null,
                associatedCompId: Number.isFinite(assocId) && assocId > 0 ? assocId : null,
                hasAnomaly,
                clkPos: md.clk_pos ?? c.clk_pos ?? null,
                dist: md.dist !== undefined && md.dist !== "" ? toNum(md.dist, 0) : null,
                elv1: md.elv_1 !== undefined && md.elv_1 !== "" ? toNum(md.elv_1, start[1]) : null,
                elv2: md.elv_2 !== undefined && md.elv_2 !== "" ? toNum(md.elv_2, end[1]) : null,
                thickness: toNum(c.thickness ?? c.dimensions?.thickness, 0.2)
            });
        });
        const foundation: any[] = json?.data?.foundationMembers || [];
        foundation.forEach(f => {
            const s = Array.isArray(f.start) ? f.start : [];
            const e = Array.isArray(f.end) ? f.end : s;
            const start: Vec3 = [toNum(s[0]), toNum(s[1]), toNum(s[2])];
            const end: Vec3 = [toNum(e[0], start[0]), toNum(e[1], start[1]), toNum(e[2], start[2])];
            const isLeg = String(f.id || "").startsWith("leg-");
            const lbl = String(f.label || "").trim();
            all.push({
                qid: lbl,
                code: isLeg ? "LG" : "FA",
                start,
                end,
                sLeg: isLeg ? lbl.toUpperCase() : undefined,
                fLeg: isLeg ? lbl.toUpperCase() : undefined,
                face: !isLeg ? lbl.toUpperCase() : undefined,
                compId: null,
                isFoundation: true
            });
        });
    } catch (e) {
        console.warn("[DebrisLocationReport] Failed to load 3D geometry:", e);
    }
    return all;
};

/** Resolve the relevant elevation(s) for a component's debris records */
export const resolveRelevantElevations = (
    records: any[],
    member: SketchMember | null,
    flags: DebrisFlag[]
): number[] => {
    const recElevs = records
        .map(r => r?.elevation)
        .filter(e => e !== null && e !== undefined && String(e).trim() !== "" && Number.isFinite(Number(e)))
        .map(Number);

    const rawElevs = recElevs.length > 0
        ? recElevs
        : member
            ? (isHorizontalMember(member) || isPointMember(member)
                ? [Math.round(((member.start[1] + member.end[1]) / 2) * 100) / 100]
                : (flags.length > 0
                    ? flags.map(f => Math.round(lerp3(member.start, member.end, f.t)[1] * 100) / 100)
                    : [Math.round(((member.start[1] + member.end[1]) / 2) * 100) / 100]))
            : [];

    const unique: number[] = [];
    for (const e of rawElevs) {
        if (!unique.some(u => Math.abs(u - e) < 0.5)) {
            unique.push(e);
        }
    }
    return unique;
};

export const generateDebrisLocationReport = async (
    jobPack: any,
    structure: any,
    sowReportNo: string,
    companySettings: CompanySettings,
    config: ReportConfig
) => {
    const supabase = createClient();
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;
    const isBlank = Boolean((config as any).isBlankReport);
    const isPrintFriendly = config.printFriendly === true;

    const structureIdVal = structure?.id || structure?.str_id || structure?.plat_id || (structure as any)?.structure_id || config?.structureId;

    // 1. Debris records for the selected campaign
    let records: any[] = [];
    if (!isBlank) {
        try {
            let url = `/api/reports/debris-location?`;
            if (jobPack?.id && jobPack.id !== "0") url += `jobpack_id=${jobPack.id}&`;
            if (sowReportNo && !["all", "ALL", "N/A"].includes(sowReportNo)) url += `sow_report_no=${encodeURIComponent(sowReportNo)}&`;
            if (structureIdVal && String(structureIdVal) !== "0") url += `structure_id=${structureIdVal}&`;
            url += `_t=${Date.now()}`;
            const res = await fetch(url, { cache: "no-store" });
            const json = await res.json();
            if (json.data && json.data.length > 0) records = json.data;
            else console.warn("No debris records returned for query:", url);
        } catch (e) {
            console.error("Error fetching debris location data", e);
        }

        if (records.length === 0) {
            if (typeof window !== "undefined" && !config.returnBlob) {
                alert("No debris records found on structure members for the selected campaign.");
            }
            return null;
        }
    }

    // 2. 3D geometry (all members) - used for the context drawing and to locate each QID
    const allMembers = isBlank ? [] : await fetchStructureMembers(structureIdVal);
    const byCompId = new Map<number, SketchMember>();
    const byQid = new Map<string, SketchMember>();
    allMembers.forEach(m => {
        if (m.compId && !byCompId.has(m.compId)) byCompId.set(m.compId, m);
        else if (m.compId && memberLength(byCompId.get(m.compId)!) < 0.05 && memberLength(m) >= 0.05) byCompId.set(m.compId, m);
        const key = m.qid.toUpperCase();
        if (key && !m.isFoundation && !byQid.has(key)) byQid.set(key, m);
    });

    // 2b. Enrich members where anomalies / debris have been identified so their locations are highlighted
    if (!isBlank && allMembers.length > 0) {
        const markMemberAnomaly = (compId?: number | null, qid?: string | null, refLabel?: string | null) => {
            const cid = Number(compId);
            const cleanRef = String(refLabel || "").split("/").pop()?.trim() || "";
            const mById = Number.isFinite(cid) && cid > 0 ? byCompId.get(cid) : undefined;
            const mByQid = qid ? byQid.get(String(qid).trim().toUpperCase()) : undefined;
            const matched = mById || mByQid;
            if (matched) {
                matched.hasAnomaly = true;
                if (cleanRef && !matched.anomalyLabel) matched.anomalyLabel = cleanRef;
            }
        };

        // Mark all components present in the campaign's debris records
        records.forEach(r => {
            markMemberAnomaly(r.component_id, r.component_qid, r.display_ref_no || r.anomaly_ref);
        });

        // Also query open anomalies on this structure from v_anomaly_details
        if (structureIdVal && String(structureIdVal) !== "0") {
            try {
                let anomQuery = supabase
                    .from("v_anomaly_details")
                    .select("component_id, component_qid, display_ref_no, status, jobpack_id")
                    .eq("structure_id", Number(structureIdVal));
                if (jobPack?.id && String(jobPack.id) !== "0") {
                    anomQuery = anomQuery.eq("jobpack_id", Number(jobPack.id));
                }
                const { data: anomRows } = await anomQuery;
                if (Array.isArray(anomRows)) {
                    anomRows.forEach((a: any) => {
                        if (String(a.status || "").toLowerCase() !== "closed") {
                            markMemberAnomaly(a.component_id, a.component_qid, a.display_ref_no);
                        }
                    });
                }
            } catch (e) {
                console.warn("[DebrisLocationReport] Optional anomaly enrichment skipped:", e);
            }
        }

        // Propagate anomaly highlight from attached anodes (AN) / node welds (WN) to their host structural members
        const structuralPool = allMembers.filter(m => !isAnodeMember(m) && !isWeldMember(m) && !isPointMember(m));
        allMembers.forEach(m => {
            if (m.hasAnomaly && (isAnodeMember(m) || isWeldMember(m))) {
                const host = findHostStructuralMember(m, structuralPool);
                if (host) {
                    host.hasAnomaly = true;
                    if (!host.anomalyLabel) {
                        host.anomalyLabel = m.anomalyLabel ? `${m.qid} ${m.anomalyLabel}` : m.qid;
                    }
                }
            }
        });
    }

    const contextMembers: SketchMember[] = allMembers
        .filter(m => !isPointMember(m) || isAnodeMember(m) || isWeldMember(m))
        .slice(0, 5000);

    // 3. Group records by component QID (one page per QID)
    interface Group { qid: string; compId: number | null; records: any[]; member: SketchMember | null; }
    let groups: Group[] = [];
    if (isBlank) {
        groups = [{ qid: "", compId: null, records: [], member: null }];
    } else {
        const map = new Map<string, Group>();
        records.forEach(r => {
            const key = String(r.component_id || r.component_qid);
            if (!map.has(key)) {
                const compId = Number(r.component_id);
                const qid = String(r.component_qid || "").trim();
                const member = byCompId.get(compId) || byQid.get(qid.toUpperCase()) || null;
                map.set(key, { qid, compId: Number.isFinite(compId) ? compId : null, records: [], member });
            }
            map.get(key)!.records.push(r);
        });
        groups = Array.from(map.values());
        groups.forEach(g => g.records.sort((a, b) => Number(a.insp_id) - Number(b.insp_id)));
        groups.sort((a, b) => a.qid.localeCompare(b.qid, undefined, { numeric: true, sensitivity: "base" }));
    }

    // 4. Logos (same strategy as the Defect / Anomaly report)
    let clientLogo: any = null;
    try {
        const primary = await loadLogoWithTransparency("/api/company-settings/logo");
        if (primary) clientLogo = primary;
        else if (companySettings.logo_url) {
            const proxied = await loadLogoWithTransparency(`/api/attachment/download?path=${encodeURIComponent(companySettings.logo_url)}&bucket=company-assets`);
            clientLogo = proxied || await loadLogoWithTransparency(companySettings.logo_url);
        }
    } catch (e) {
        console.warn("Failed to load company logo:", e);
    }

    let contractorLogo: any = null;
    if (config.showContractorLogo) {
        try {
            if (!jobPack?.metadata || !jobPack.metadata.contrac) {
                if (jobPack?.id) {
                    const { data: jpData } = await supabase.from("jobpack").select("metadata").eq("id", jobPack.id).single();
                    if (jpData) jobPack.metadata = { ...(jobPack.metadata || {}), ...jpData.metadata };
                }
            }
            const contractorId = jobPack?.metadata?.contrac;
            if (contractorId) {
                const cid = String(contractorId);
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid);
                let q = supabase.from("u_lib_list").select("logo_url, lib_desc").eq("lib_code", "CONTR_NAM");
                q = isUUID ? q.or(`id.eq.${cid},lib_id.eq.${cid}`) : q.eq("lib_id", cid);
                const { data } = await q.maybeSingle();
                if (data?.logo_url) contractorLogo = await loadLogoWithTransparency(data.logo_url);
            }
        } catch (e) {
            console.warn("Failed to load contractor logo", e);
        }
    }

    // 5. Page furniture
    const headerH = 25;
    const footerH = 22;
    const footerY = pageHeight - margin - footerH;
    const maxYForContent = (config.showSignatures !== false ? footerY : pageHeight - margin - 6) - 3;
    const labelColWidth = 32;
    const valueColWidth = (contentWidth - labelColWidth * 2) / 2;
    const headStyles: any = isPrintFriendly
        ? { fillColor: [255, 255, 255], textColor: [7, 78, 136], fontStyle: "bold", lineWidth: 0.1, lineColor: [200, 200, 200] }
        : { fillColor: [7, 78, 136], textColor: [255, 255, 255], fontStyle: "bold", lineWidth: 0.1, lineColor: [200, 200, 200] };

    const structName = structure?.str_name ? `${structure.str_name}${structure.title ? ` - ${structure.title}` : ""}` : jobPack?.name;
    const reportNoDisplay = sowReportNo || records[0]?.sow_report_no || jobPack?.metadata?.report_no || (config as any)?.reportNoPrefix || "N/A";
    const regionDisplay = structure?.region || structure?.area || jobPack?.metadata?.region || "";
    const fieldDisplay = structure?.field_name || structure?.field || jobPack?.metadata?.field || "";
    const shortStructDisplay = structure?.str_name || jobPack?.name || "";

    const drawHeader = () => {
        draw3SectionHeader(doc, {
            reportTitle: "Debris Location Report",
            reportNo: reportNoDisplay,
            structureName: structName,
            companySettings,
            config,
            contractorLogoData: contractorLogo,
            clientLogoData: clientLogo,
            isPrintFriendly,
            margin: 10,
            headerY: 7,
            headerH: 25,
            orientation: "portrait"
        });
    };

    const drawSubBar = (text: string) => {
        const subBarH = 6;
        const subBarY = margin + headerH + 2;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.1);
        if (isPrintFriendly) {
            doc.setFillColor(240, 240, 240);
            doc.rect(margin, subBarY, contentWidth, subBarH, "FD");
            doc.setTextColor(7, 78, 136);
        } else {
            doc.setFillColor(7, 78, 136);
            doc.rect(margin, subBarY, contentWidth, subBarH, "FD");
            doc.setTextColor(255, 255, 255);
        }
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.text(text, margin + 3, subBarY + 4.2);
        doc.setTextColor(0, 0, 0);
    };

    const drawSignatories = () => {
        const gap = 2;
        const colW = (contentWidth - gap * 2) / 3;
        const names = [
            { title: "PREPARED BY", p: config.preparedBy },
            { title: "REVIEWED BY", p: config.reviewedBy },
            { title: "APPROVED BY", p: config.approvedBy }
        ];
        names.forEach((entry, idx) => {
            const x = margin + idx * (colW + gap);
            const y = footerY;
            doc.setDrawColor(7, 78, 136);
            doc.setLineWidth(0.1);
            doc.rect(x, y, colW, footerH);
            if (!isPrintFriendly) {
                doc.setFillColor(7, 78, 136);
                doc.rect(x, y, colW, 4.5, "F");
                doc.setTextColor(255, 255, 255);
            } else {
                doc.setFillColor(240, 240, 240);
                doc.rect(x, y, colW, 4.5, "F");
                doc.setTextColor(7, 78, 136);
            }
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7);
            doc.text(entry.title, x + 2.5, y + 3.2);
            doc.setTextColor(30, 41, 59);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.5);
            const lx = x + 2.5;
            const dateY = y + footerH - 1.5;
            const posY = dateY - 2.6;
            const nameY = posY - 2.6;
            doc.text(entry.p?.name ? `Name: ${entry.p.name}` : "Name:", lx, nameY);
            doc.text(entry.p?.position ? `Position: ${entry.p.position}` : "Position:", lx, posY);
            doc.text(entry.p?.date ? `Date: ${formatPdfDate(entry.p.date)}` : "Date:", lx, dateY);
        });
    };

    const groupPageRanges: { start: number; end: number }[] = [];
    const pageNoCells: { [g: number]: { x: number; y: number; w: number; h: number } } = {};

    // 6. One page (or more) per component QID
    for (let gi = 0; gi < groups.length; gi++) {
        const group = groups[gi];
        const items = buildDebrisItems(group.records, group.member);

        if (gi > 0) doc.addPage();
        const startPage = doc.getNumberOfPages();
        drawHeader();

        const first = group.records[0] || {};
        const uniq = (vals: any[]) => Array.from(new Set(vals.map(v => String(v ?? "").trim()).filter(Boolean)));
        const join = (vals: any[], fallback = "N/A") => {
            const u = uniq(vals);
            return u.length === 0 ? fallback : u.slice(0, 3).join(", ") + (u.length > 3 ? ", ..." : "");
        };
        const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("en-GB") : "");
        const diverOrRov = first.diver_name
            ? { label: "Diver:", val: join(group.records.map(r => r.diver_name)) }
            : { label: "ROV / Pilot:", val: join(group.records.map(r => r.rov_name)) };
        const diveNo = join(group.records.map(r => r.dive_no || r.deployment_no));
        const memberElev = group.member
            ? (Math.abs(group.member.start[1] - group.member.end[1]) < 0.05
                ? fmtElev(Math.round(group.member.start[1] * 100) / 100)
                : `${fmtElev(Math.round(group.member.start[1] * 100) / 100)} to ${fmtElev(Math.round(group.member.end[1] * 100) / 100)}`)
            : join(group.records.map(r => (r.elevation === null || r.elevation === undefined ? "" : fmtElev(Number(r.elevation)))));
        const metallicCount = items.filter(i => i.flag.material === "metallic").length;
        const nonMetallicCount = items.filter(i => i.flag.material === "non-metallic").length;
        const itemsSummary = isBlank
            ? ""
            : `${items.length} item${items.length === 1 ? "" : "s"} (${metallicCount} metallic, ${nonMetallicCount} non-metallic)`;
        const recording = join(group.records.map(r => {
            let t = String(r.tape_no || "");
            const ref = r.video_ref;
            if (ref && !isNaN(Number(ref)) && Number(ref) >= 0) {
                const s = Number(ref);
                const pad = (n: number) => n.toString().padStart(2, "0");
                t += ` (${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(Math.floor(s % 60))})`;
            }
            return t.trim();
        }));

        autoTable(doc, {
            startY: margin + headerH + 2,
            head: [],
            body: [
                [
                    { content: "Jobpack:", styles: headStyles }, { content: jobPack?.name || "N/A" },
                    { content: "Report No.:", styles: headStyles }, { content: String(reportNoDisplay) }
                ],
                [
                    { content: "Field:", styles: headStyles }, { content: structure?.field_name || "N/A" },
                    { content: "Structure Title:", styles: headStyles }, { content: structure?.str_name || "N/A" }
                ],
                [
                    { content: "Component QID:", styles: headStyles }, { content: group.qid || "" },
                    { content: "Member Elevation:", styles: headStyles }, { content: isBlank ? "" : memberElev }
                ],
                [
                    { content: "Debris Items:", styles: headStyles }, { content: itemsSummary },
                    { content: "Date:", styles: headStyles }, { content: isBlank ? "" : join(group.records.map(r => fmtDate(r.inspection_date))) }
                ],
                [
                    { content: diverOrRov.label, styles: headStyles }, { content: isBlank ? "" : diverOrRov.val },
                    { content: "Dive no.:", styles: headStyles }, { content: isBlank ? "" : diveNo }
                ],
                [
                    { content: "Supervisor:", styles: headStyles }, { content: isBlank ? "" : join(group.records.map(r => r.supervisor || r.rov_name || r.diver_name)) },
                    { content: "Rep. cord:", styles: headStyles }, { content: isBlank ? "" : join(group.records.map(r => r.report_coordinator)) }
                ],
                [
                    { content: "DVD/Recording No.:", styles: headStyles }, { content: isBlank ? "" : recording },
                    { content: "Page No.:", styles: headStyles }, { content: "" }
                ]
            ] as any,
            theme: "grid",
            tableLineWidth: 0.1,
            tableLineColor: [200, 200, 200],
            styles: { fontSize: 8, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.1, textColor: [0, 0, 0] },
            columnStyles: {
                0: { cellWidth: labelColWidth },
                1: { cellWidth: valueColWidth },
                2: { cellWidth: labelColWidth },
                3: { cellWidth: valueColWidth }
            },
            margin: { left: margin, right: margin, top: margin + headerH + 2 },
            didDrawCell: (data: any) => {
                if (data.row.index === 6 && data.column.index === 3 && !pageNoCells[gi]) {
                    pageNoCells[gi] = { x: data.cell.x, y: data.cell.y, w: data.cell.width, h: data.cell.height };
                }
            }
        });

        let lastY = (doc as any).lastAutoTable.finalY + 4;

        // --- Sketch block (3D Face View + 3D Framing Plan + Member Detail) ------
        const member = group.member;
        const flags = items.map(i => i.flag);
        const panelH = 74;
        const detailH = 38;

        if (member || isBlank) {
            const gap = 3;
            const halfW = (contentWidth - gap) / 2;
            const elevBox = { x: margin, y: lastY, w: halfW, h: panelH };
            const planBox = { x: margin + halfW + gap, y: lastY, w: halfW, h: panelH };
            const detailBox = { x: margin, y: lastY + panelH + gap, w: contentWidth, h: detailH };

            const baseHeaderMeta: SketchHeaderMeta = {
                region: regionDisplay || undefined,
                field: fieldDisplay || undefined,
                structure: shortStructDisplay || undefined
            };

            if (member) {
                const axis = chooseElevationAxis(member);
                const relevantElevs = resolveRelevantElevations(group.records, member, flags);
                const faceSubtitle = resolveFaceSubtitle(member, contextMembers, axis);
                const planElevSubtitle = relevantElevs.length > 0
                    ? `ELEVATION ${relevantElevs.map(e => formatElev3D(e)).join(", ")}`
                    : `ELEVATION ${formatElev3D((member.start[1] + member.end[1]) / 2)}`;

                drawPanelTitle(doc, elevBox, "DEBRIS LOCATION - 3D FACE VIEW", isPrintFriendly, {
                    ...baseHeaderMeta,
                    subtitle: faceSubtitle
                });
                drawElevationView(doc, elevBox, contextMembers, member, flags, axis, relevantElevs, allMembers);

                drawPanelTitle(doc, planBox, "DEBRIS LOCATION - 3D FRAMING PLAN", isPrintFriendly, {
                    ...baseHeaderMeta,
                    subtitle: planElevSubtitle
                });
                drawPlanView(doc, planBox, contextMembers, member, flags, relevantElevs, allMembers);

                // Redraw outer panel borders so content never hides them
                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(0.12);
                doc.rect(elevBox.x, elevBox.y, elevBox.w, elevBox.h);
                doc.rect(planBox.x, planBox.y, planBox.w, planBox.h);

                drawPanelTitle(doc, detailBox, "MEMBER DETAIL - FLAG LOCATIONS ALONG MEMBER AND AROUND ITS CIRCUMFERENCE", isPrintFriendly);
                drawMemberDetail(doc, detailBox, member, flags);
            } else {
                drawPanelTitle(doc, elevBox, "DEBRIS LOCATION - 3D FACE VIEW", isPrintFriendly, {
                    ...baseHeaderMeta,
                    subtitle: "FACE VIEW"
                });
                drawPanelTitle(doc, planBox, "DEBRIS LOCATION - 3D FRAMING PLAN", isPrintFriendly, {
                    ...baseHeaderMeta,
                    subtitle: "FRAMING PLAN"
                });
                drawPanelTitle(doc, detailBox, "MEMBER DETAIL - FLAG LOCATIONS ALONG MEMBER AND AROUND ITS CIRCUMFERENCE", isPrintFriendly);
            }
            drawFlagLegend(doc, margin, lastY + panelH + gap + detailH + 4.5);
            lastY += panelH + gap + detailH + 8;
        } else {
            // QID not present in the 3D model: keep the report complete without a sketch
            const noteH = 14;
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.1);
            doc.rect(margin, lastY, contentWidth, noteH);
            doc.setFont("helvetica", "italic");
            doc.setFontSize(8);
            doc.setTextColor(120, 120, 120);
            doc.text(
                `3D geometry is not available for component ${group.qid || "(unknown)"}. Flag locations are listed in the table below.`,
                margin + 3,
                lastY + 8
            );
            doc.setTextColor(0, 0, 0);
            lastY += noteH + 4;
        }

        // --- Debris description table (no picture attachments rendered) ----------
        const tableStartPage = doc.getNumberOfPages();
        const contBarText = `Debris Location  |  Structure: ${structure?.str_name || "N/A"}  |  Component: ${group.qid || "N/A"}`;
        const rows = isBlank
            ? [["", "", "", "", ""]]
            : items.map(it => {
                const f = it.flag;
                const materialClass = f.material === "metallic" ? "Metallic" : f.material === "non-metallic" ? "Non-metallic" : "Unclassified";
                const flagsText = [f.touching ? "In contact" : "Not in contact", f.hazardous ? "Hazardous" : ""].filter(Boolean).join(" | ");
                return [
                    String(f.n),
                    `${it.typeText}${it.materialText ? `\n${it.materialText}` : ""}\n${materialClass} | ${flagsText}`,
                    it.elevText,
                    it.positionLines.join("\n"),
                    it.findingsText || "-"
                ];
            });

        autoTable(doc, {
            startY: lastY,
            head: [["No.", "Debris Type / Material", "Elevation", "Assumed / Recorded Position", "Findings"]],
            body: rows,
            theme: "grid",
            showHead: "everyPage",
            headStyles: isPrintFriendly
                ? { fillColor: [240, 240, 240], textColor: [7, 78, 136], fontStyle: "bold", fontSize: 7.5 }
                : { fillColor: [7, 78, 136], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
            styles: { fontSize: 7, cellPadding: 1.8, lineColor: [200, 200, 200], lineWidth: 0.1, textColor: [0, 0, 0], valign: "top" },
            columnStyles: {
                0: { cellWidth: 9, halign: "center", fontStyle: "bold" },
                1: { cellWidth: 48 },
                2: { cellWidth: 20 },
                3: { cellWidth: 52 },
                4: { cellWidth: "auto" }
            },
            margin: { left: margin, right: margin, top: margin + headerH + 10, bottom: pageHeight - maxYForContent },
            didDrawPage: (data: any) => {
                if (data.pageNumber > tableStartPage) {
                    drawHeader();
                    drawSubBar(contBarText);
                }
            }
        });

        if (config.showSignatures !== false) drawSignatories();

        groupPageRanges.push({ start: startPage, end: doc.getNumberOfPages() });
    }

    // 7. Per-QID page numbers + document footer
    const totalPages = doc.getNumberOfPages();
    const printedDateStr = `Printed: ${new Date().toLocaleDateString("en-GB")}`;
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        const rangeIdx = groupPageRanges.findIndex(r => i >= r.start && i <= r.end);
        if (rangeIdx !== -1) {
            const range = groupPageRanges[rangeIdx];
            const localPage = i - range.start + 1;
            const localTotal = range.end - range.start + 1;
            if (i === range.start) {
                const cell = pageNoCells[rangeIdx];
                if (cell) {
                    doc.setFontSize(8);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(0, 0, 0);
                    doc.text(`Page ${localPage} of ${localTotal}`, cell.x + 2, cell.y + 4.8);
                }
            } else {
                const subBarY = margin + headerH + 2;
                doc.setFontSize(7.5);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(255, 255, 255);
                if (isPrintFriendly) doc.setTextColor(7, 78, 136);
                doc.text(`Page ${localPage} of ${localTotal}`, pageWidth - margin - 3, subBarY + 4.2, { align: "right" });
                doc.setTextColor(0, 0, 0);
            }
        }

        if (config.showPageNumbers !== false) {
            const footerLineY = pageHeight - 10;
            const isSignatoryPage = config.showSignatures !== false && groupPageRanges.some(r => r.end === i);
            if (!isSignatoryPage) {
                doc.setDrawColor(180, 180, 180);
                doc.setLineWidth(0.3);
                doc.line(margin, footerLineY, pageWidth - margin, footerLineY);
            }
            doc.setFontSize(7);
            doc.setTextColor(100, 100, 100);
            doc.setFont("helvetica", "normal");
            doc.text(REPORT_FOOTER_APP_TEXT, margin, footerLineY + 4);
            doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, footerLineY + 4, { align: "center" });
            doc.text(printedDateStr, pageWidth - margin, footerLineY + 4, { align: "right" });
        }
    }

    if (config.returnBlob) {
        applyWatermarkAndSignaturesGlobal(doc, config);
        return doc.output("blob");
    } else {
        applyWatermarkAndSignaturesGlobal(doc, config);
        doc.save(`${config.reportNoPrefix}_DebrisLocationReport.pdf`);
    }
};
