"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Edit3,
  ChevronDown,
  ChevronRight,
  Boxes,
  FileText,
  MessageSquare,
  Check,
  Search,
  ExternalLink,
  ShieldCheck,
  Layers,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PlatformSpecsDialog } from "@/components/dialogs/platform-specs-dialog";
import { CommentDialog } from "@/components/dialogs/comment-dialog";

interface InventoryCheckingProps {
  jobpackId: string;
  structureId: string;
  sowId: string;
  reportNo: string;
}

// Helper to extract start and end nodes from metadata or id_no string
const getComponentNodes = (c: any): { sNode: string; fNode: string } => {
  let sNode = "";
  let fNode = "";

  // 1. Direct metadata fields
  if (c.metadata && typeof c.metadata === "object") {
    sNode = String(c.metadata.s_node ?? c.metadata.start_node ?? "").trim();
    fNode = String(c.metadata.f_node ?? c.metadata.end_node ?? "").trim();
  }

  // 2. Direct top-level fields
  if (!sNode && c.s_node) sNode = String(c.s_node).trim();
  if (!fNode && c.f_node) fNode = String(c.f_node).trim();

  // 3. Parse from id_no format: CODE/START_NODE-END_NODE/DISTANCE/CLOCK
  if ((!sNode || !fNode) && c.id_no) {
    const match = String(c.id_no).match(/^[A-Za-z]+\/([^-/]+)-([^/]+)/);
    if (match) {
      if (!sNode) sNode = match[1].trim();
      if (!fNode) fNode = match[2].trim();
    }
  }

  // Normalize numbers by removing leading zeros for clean comparison (e.g. "001001" vs "1001")
  const normS = sNode.replace(/^0+/, "") || sNode;
  const normF = fNode.replace(/^0+/, "") || fNode;

  return { sNode: normS, fNode: normF };
};

// Helper to extract start and end elevations from component metadata or fields
const getComponentElevations = (c: any): { elv1: number | null; elv2: number | null; hasElevations: boolean } => {
  let e1 = c.elv_1 ?? c.metadata?.elv_1 ?? c.elevation_1 ?? c.metadata?.elevation_1 ?? c.start_elevation ?? c.metadata?.start_elevation ?? null;
  let e2 = c.elv_2 ?? c.metadata?.elv_2 ?? c.elevation_2 ?? c.metadata?.elevation_2 ?? c.end_elevation ?? c.metadata?.end_elevation ?? null;

  if ((e1 === null || e1 === undefined || e1 === "") && c.metadata?.elevation) {
    const parts = String(c.metadata.elevation).split(/[,-]/);
    if (parts.length === 2) {
      e1 = parts[0].trim();
      e2 = parts[1].trim();
    }
  }

  const num1 = e1 !== null && e1 !== undefined && e1 !== "" && !isNaN(Number(e1)) ? Number(e1) : null;
  const num2 = e2 !== null && e2 !== undefined && e2 !== "" && !isNaN(Number(e2)) ? Number(e2) : null;

  return {
    elv1: num1,
    elv2: num2,
    hasElevations: num1 !== null && num2 !== null,
  };
};

// Check if status in SOW / inspection counts as inspected (inspected, completed, or incomplete)
const isInspectedStatus = (statusStr: string | null | undefined): boolean => {
  if (!statusStr) return false;
  const s = String(statusStr).trim().toLowerCase();
  if (s === "pending" || s === "uninspected" || s === "not started" || s === "not_started") return false;
  return (
    s === "inspected" ||
    s === "completed" ||
    s === "incomplete" ||
    s === "in_progress" ||
    s === "in progress" ||
    s === "done" ||
    s === "anomaly" ||
    s === "has_anomaly"
  );
};

// Helper to check if report number matches selected report strictly
const isReportMatch = (itemRpt: string | null | undefined, targetRpt: string): boolean => {
  if (!targetRpt || targetRpt === "null" || !targetRpt.trim()) return true;
  if (!itemRpt || itemRpt === "null" || !itemRpt.trim()) return false;
  const c1 = String(itemRpt).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const c2 = String(targetRpt).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return c1 === c2 || c1.startsWith(c2) || c2.startsWith(c1);
};

export default function InventoryCheckingSection({
  jobpackId,
  structureId,
  sowId,
  reportNo,
}: InventoryCheckingProps) {
  const cleanJobpackId = useMemo(() => String(jobpackId || "").replace(/^(jobpack)-/, "").trim(), [jobpackId]);
  const cleanStructId = useMemo(() => String(structureId || "").replace(/^(platform|pipeline)-/, "").trim(), [structureId]);
  const cleanReportNo = useMemo(() => String(reportNo || "").trim(), [reportNo]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [platformData, setPlatformData] = useState<any>(null);
  const [registeredComponents, setRegisteredComponents] = useState<any[]>([]);
  const [sowItemsList, setSowItemsList] = useState<any[]>([]);
  const [inspectedRecords, setInspectedRecords] = useState<any[]>([]);
  const [platformComments, setPlatformComments] = useState<any[]>([]);

  // Dialog controls
  const [specsDialogOpen, setSpecsDialogOpen] = useState(false);
  const [quickEditDialogOpen, setQuickEditDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [newSpecCount, setNewSpecCount] = useState<string>("");
  const [isSavingCount, setIsSavingCount] = useState(false);

  // Expanded categories row accordion
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Filtering & search
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "mismatch" | "matched">("all");

  const supabase = createClient();

  useEffect(() => {
    if (structureId) {
      fetchInventoryData();
    }
  }, [structureId, jobpackId, sowId, reportNo]);

  const fetchInventoryData = async () => {
    setLoading(true);
    try {
      const cleanStructId = String(structureId).replace(/^(platform|pipeline)-/, "");
      const cleanJobpackId = String(jobpackId).replace(/^(jobpack)-/, "");

      // 1. Fetch Platform Spec Data
      const { data: plat, error: platErr } = await supabase
        .from("platform")
        .select("*")
        .eq("plat_id", Number(cleanStructId))
        .single();

      if (platErr && platErr.code !== "PGRST116") {
        console.warn("Failed to fetch platform spec:", platErr);
      }
      setPlatformData(plat || null);

      // 2. Fetch Active Registered Components for this platform (Multi-strategy)
      let regComps: any[] = [];

      // Strategy A: Official structure-components API route
      try {
        const res = await fetch(`/api/structure-components?structure_id=${cleanStructId}`);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data) && json.data.length > 0) {
            regComps = json.data;
          }
        }
      } catch (e) {
        console.warn("API /api/structure-components error:", e);
      }

      // Strategy B: Lookup API endpoint
      if (regComps.length === 0) {
        try {
          const res = await fetch(`/api/structure-components/lookup?structure_id=${cleanStructId}&pageSize=1000`);
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json.data) && json.data.length > 0) {
              regComps = json.data;
            }
          }
        } catch (e) {
          console.warn("API /api/structure-components/lookup error:", e);
        }
      }

      // Strategy C: Direct Supabase query on structure_components
      if (regComps.length === 0) {
        try {
          const { data } = await supabase
            .from("structure_components")
            .select("id, comp_id, q_id, id_no, code, name, metadata, is_deleted")
            .eq("structure_id", Number(cleanStructId));
          if (data && data.length > 0) {
            regComps = data;
          }
        } catch (e) {
          console.warn("Direct structure_components query error:", e);
        }
      }

      // Strategy D: Fallback on component table
      if (regComps.length === 0) {
        try {
          const { data } = await supabase
            .from("component")
            .select("id, comp_id, q_id, id_no, code, name, metadata, is_deleted")
            .eq("structure_id", Number(cleanStructId));
          if (data && data.length > 0) {
            regComps = data;
          }
        } catch (e) {
          console.warn("Direct component query error:", e);
        }
      }

      // Filter active (non-deleted, non-archived) components
      const activeComps = (regComps || []).filter((c) => {
        if (c.is_deleted === true || c.is_archived === true || c.archived === true) return false;
        const meta = c.metadata || {};
        if (meta.is_deleted === true || meta.deleted === true || meta.del === true) return false;
        if (meta.is_archived === true || meta.archived === true || meta.archive === true) return false;
        return true;
      });

      setRegisteredComponents(activeComps);

      // 3. Fetch SOW Items for this SOW and Structure (Multi-strategy)
      let sowItems: any[] = [];
      let resolvedSowId = sowId;

      // Strategy 1: Fetch via /api/sow?jobpack_id=...&structure_id=...
      if (cleanJobpackId && cleanStructId) {
        try {
          const res = await fetch(`/api/sow?jobpack_id=${cleanJobpackId}&structure_id=${cleanStructId}`);
          if (res.ok) {
            const json = await res.json();
            if (json.data) {
              if (json.data.id) resolvedSowId = String(json.data.id);
              if (Array.isArray(json.data.items) && json.data.items.length > 0) {
                sowItems = json.data.items;
              }
            }
          }
        } catch (e) {
          console.warn("API /api/sow by jobpack/structure error:", e);
        }
      }

      // Strategy 2: If sowId exists or resolved, fetch /api/sow?sow_id=...
      if (sowItems.length === 0 && resolvedSowId) {
        try {
          const res = await fetch(`/api/sow?sow_id=${resolvedSowId}`);
          if (res.ok) {
            const json = await res.json();
            if (json.data?.items && Array.isArray(json.data.items) && json.data.items.length > 0) {
              sowItems = json.data.items;
            }
          }
        } catch (e) {
          console.warn("API /api/sow by sow_id error:", e);
        }
      }

      // Strategy 3: /api/sow/items?sow_id=...
      if (sowItems.length === 0 && resolvedSowId) {
        try {
          const res = await fetch(`/api/sow/items?sow_id=${resolvedSowId}`);
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json.data) && json.data.length > 0) {
              sowItems = json.data;
            }
          }
        } catch (e) {
          console.warn("fetch /api/sow/items error:", e);
        }
      }

      // Strategy 4: Direct supabase query on u_sow_items
      if (sowItems.length === 0 && resolvedSowId) {
        try {
          const { data: directItems } = await supabase
            .from("u_sow_items")
            .select("*")
            .eq("sow_id", Number(resolvedSowId));
          if (directItems && directItems.length > 0) {
            sowItems = directItems;
          }
        } catch (e) {
          console.warn("direct u_sow_items query error:", e);
        }
      }
      setSowItemsList(sowItems);

      // 4. Fetch Inspected Records from insp_records as additional cross-reference
      let inspData: any[] = [];
      if (cleanJobpackId && cleanStructId) {
        try {
          let recQuery = supabase
            .from("insp_records")
            .select("insp_id, component_id, status, description, created_at, inspection_data, inspection_type:inspection_type_id(id, name, code), sow_report_no")
            .eq("jobpack_id", Number(cleanJobpackId))
            .eq("structure_id", Number(cleanStructId));

          if (reportNo && reportNo.trim()) {
            recQuery = recQuery.ilike("sow_report_no", reportNo.trim());
          }

          const { data: records } = await recQuery;
          if (records && records.length > 0) {
            inspData = records;
          }
        } catch (err) {
          console.warn("Failed to fetch inspection records:", err);
        }
      }
      setInspectedRecords(inspData);

      // 5. Fetch Platform Comments
      try {
        const comRes = await fetch(`/api/comment/platform/${cleanStructId}`);
        if (comRes.ok) {
          const comJson = await comRes.json();
          setPlatformComments(comJson.data || []);
        }
      } catch (err) {
        console.warn("Failed to fetch platform comments:", err);
      }
    } catch (err: any) {
      console.error("Inventory fetch error:", err);
      toast.error("Failed to load inventory checking data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchInventoryData();
  };

  // Active SOW items (strictly filtered by selected reportNo for the selected jobpack and structure)
  const activeSowItems = useMemo(() => {
    if (!cleanReportNo || sowItemsList.length === 0) return sowItemsList;
    const cleanTarget = cleanReportNo.toUpperCase().replace(/[^A-Z0-9]/g, "");

    // 1. Strict match on report_number for selected report
    const strictlyMatching = sowItemsList.filter((i) => {
      if (!i.report_number || i.report_number === "null" || !String(i.report_number).trim()) return false;
      const c1 = String(i.report_number).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      return c1 === cleanTarget || c1.startsWith(cleanTarget) || cleanTarget.startsWith(c1);
    });

    if (strictlyMatching.length > 0) {
      return strictlyMatching;
    }

    // 2. Check if SOW items have report numbers tagged
    const anyTaggedReport = sowItemsList.some(
      (i) => i.report_number && i.report_number !== "null" && String(i.report_number).trim().length > 0
    );

    // If SOW has report tags and none match this reportNo, then 0 items were inspected under this report
    if (anyTaggedReport) {
      return [];
    }

    // 3. Fallback only if SOW items are completely untagged
    return sowItemsList;
  }, [sowItemsList, cleanReportNo]);

  // Build inspected QIDs and component IDs map (from SOW items where status is inspected or incomplete)
  const { inspectedQIdMap, inspectedCompIdMap } = useMemo(() => {
    const qidMap = new Map<string, { status: string; inspectionTypes: string[]; items: any[] }>();
    const compIdMap = new Map<string | number, { status: string; inspectionTypes: string[]; items: any[] }>();

    const registerItem = (qid: string, compId: any, statusStr: string, inspType: string, rawItem: any) => {
      const statusLabel = String(statusStr || "inspected").toLowerCase();

      if (qid) {
        const normQ = qid.trim().toUpperCase();
        if (!qidMap.has(normQ)) {
          qidMap.set(normQ, { status: statusLabel, inspectionTypes: [], items: [] });
        }
        const entry = qidMap.get(normQ)!;
        if (inspType && !entry.inspectionTypes.includes(inspType)) {
          entry.inspectionTypes.push(inspType);
        }
        if (statusLabel === "completed") entry.status = "completed";
        entry.items.push(rawItem);
      }

      if (compId !== undefined && compId !== null && compId !== "") {
        const idStr = String(compId);
        const idNum = Number(compId);
        
        [idStr, idNum].forEach((k) => {
          if (!compIdMap.has(k)) {
            compIdMap.set(k, { status: statusLabel, inspectionTypes: [], items: [] });
          }
          const entry = compIdMap.get(k)!;
          if (inspType && !entry.inspectionTypes.includes(inspType)) {
            entry.inspectionTypes.push(inspType);
          }
          if (statusLabel === "completed") entry.status = "completed";
          entry.items.push(rawItem);
        });
      }
    };

    // 1. Process SOW items: status can be inspected or incomplete, any inspection type
    activeSowItems.forEach((item) => {
      const isDone =
        isInspectedStatus(item.status) ||
        (Array.isArray(item.elevation_data) &&
          item.elevation_data.some((el: any) => isInspectedStatus(el?.status)));

      if (!isDone) return;

      const qid = item.component_qid || "";
      const compId = item.component_id;
      const inspType = item.inspection_code || item.inspection_name || "Inspection";

      registerItem(qid, compId, item.status, inspType, item);
    });

    // 2. Also incorporate completed / inspected / incomplete insp_records
    inspectedRecords.forEach((rec) => {
      const isDone = isInspectedStatus(rec.status);
      if (!isDone) return;

      const typeCode = rec.inspection_type?.code || rec.inspection_type?.name || "Inspection";
      const qid = rec.inspection_data?.q_id || rec.inspection_data?.qid || "";
      const compId = rec.component_id;

      registerItem(qid, compId, rec.status, typeCode, rec);
    });

    return { inspectedQIdMap: qidMap, inspectedCompIdMap: compIdMap };
  }, [activeSowItems, inspectedRecords]);

  // Check if a registered component is inspected in SOW (by ID or QID)
  const getComponentInspectionInfo = (comp: any): { isInspected: boolean; status: string; inspectionTypes: string[] } => {
    // 1. Check direct attached inspections (strictly matching selected jobpack and reportNo)
    if (Array.isArray(comp.inspections) && comp.inspections.length > 0) {
      const doneInsps = comp.inspections.filter((r: any) => {
        if (!isInspectedStatus(r.status)) return false;

        // Strictly check jobpack
        if (cleanJobpackId && r.jobpack_id) {
          if (String(r.jobpack_id) !== String(cleanJobpackId)) return false;
        }

        // Strictly check SOW report no
        if (cleanReportNo) {
          const rptMatch = isReportMatch(r.sow_report_no, cleanReportNo);
          if (!rptMatch) return false;
        }

        return true;
      });

      if (doneInsps.length > 0) {
        const hasCompleted = doneInsps.some((r: any) => String(r.status).toLowerCase() === "completed");
        const types = Array.from(new Set(doneInsps.map((r: any) => r.inspection_type_code || r.inspection_type?.code || "Inspection")));
        return {
          isInspected: true,
          status: hasCompleted ? "completed" : "incomplete",
          inspectionTypes: types as string[],
        };
      }
    }

    // 2. Check by component ID (number or string)
    if (comp.id !== undefined && inspectedCompIdMap.has(comp.id)) {
      const info = inspectedCompIdMap.get(comp.id)!;
      return { isInspected: true, status: info.status, inspectionTypes: info.inspectionTypes };
    }
    if (comp.id !== undefined && inspectedCompIdMap.has(String(comp.id))) {
      const info = inspectedCompIdMap.get(String(comp.id))!;
      return { isInspected: true, status: info.status, inspectionTypes: info.inspectionTypes };
    }
    if (comp.comp_id !== undefined && inspectedCompIdMap.has(comp.comp_id)) {
      const info = inspectedCompIdMap.get(comp.comp_id)!;
      return { isInspected: true, status: info.status, inspectionTypes: info.inspectionTypes };
    }

    // 3. Check by QID / Tag
    const qidsToCheck = [comp.q_id, comp.qid, comp.id_no].filter(Boolean);
    for (const q of qidsToCheck) {
      const normQ = String(q).trim().toUpperCase();
      if (inspectedQIdMap.has(normQ)) {
        const info = inspectedQIdMap.get(normQ)!;
        return { isInspected: true, status: info.status, inspectionTypes: info.inspectionTypes };
      }
    }

    return { isInspected: false, status: "pending", inspectionTypes: [] };
  };

  // =========================================================================
  // ONLY LIST CATEGORIES SPECIFIED ON PLATFORM SPECIFICATION
  // With exact business rules 4, 5, 6, 7, 8, 9, 10
  // NO DUPLICATE COUNTING FOR INSPECTED QIDs
  // =========================================================================
  const categoryAnalysis = useMemo(() => {
    if (!platformData && registeredComponents.length === 0) return [];

    // Helper: Normalize code
    const getCode = (c: any) => (c.code || "").toUpperCase().trim();

    // 1. CONDUCTORS (Rule 4: CD type only, no associated components, non-deleted/non-archived)
    const conductorsComps = registeredComponents.filter((c) => getCode(c) === "CD");

    // 2. INTERNAL PILES (Rule 9: PL type only, Start node === End node, non-deleted/non-archived)
    const internalPilesComps = registeredComponents.filter((c) => {
      if (getCode(c) !== "PL") return false;
      const { sNode, fNode } = getComponentNodes(c);
      if (sNode && fNode) {
        return sNode === fNode;
      }
      // Fallback if node not specified: metadata pile_typ
      const ptyp = String(c.metadata?.pile_typ || c.metadata?.pile_type || "").toLowerCase();
      return ptyp.includes("int") || ptyp.includes("main");
    });

    // 3. SKIRT PILES (Rule 10: PL type only, Start node !== End node, non-deleted/non-archived)
    const skirtPilesComps = registeredComponents.filter((c) => {
      if (getCode(c) !== "PL") return false;
      const { sNode, fNode } = getComponentNodes(c);
      if (sNode && fNode) {
        return sNode !== fNode;
      }
      // Fallback if node not specified: metadata pile_typ
      const ptyp = String(c.metadata?.pile_typ || c.metadata?.pile_type || "").toLowerCase();
      return ptyp.includes("skirt") || ptyp.includes("skt");
    });

    // 4. SLOTS (Rule 6: slot for the conductor)
    const explicitSlots = registeredComponents.filter((c) => ["SL", "CSL", "SLOT"].includes(getCode(c)));
    let slotComps: any[] = explicitSlots;
    if (slotComps.length === 0) {
      const conductorsWithSlot = conductorsComps.filter(
        (c) => c.metadata?.slot || c.metadata?.slot_no || c.metadata?.cslot
      );
      if (conductorsWithSlot.length > 0) {
        slotComps = conductorsWithSlot;
      }
    }

    // 5. BOAT LANDING (Rule 7: Check BL count, if empty check FD count, non-deleted/non-archived)
    const blComps = registeredComponents.filter((c) => getCode(c) === "BL");
    const fdComps = registeredComponents.filter((c) => getCode(c) === "FD");
    const boatlandingComps = blComps.length > 0 ? blComps : fdComps;
    const boatlandingCodeUsed = blComps.length > 0 ? "BL" : fdComps.length > 0 ? "FD (Fallback)" : "BL / FD";

    // 6. RISERS (RS type where QID starts with R, top to bottom elevations where elv_1 !== elv_2, no associated components, non-deleted/non-archived)
    const risersComps = registeredComponents.filter((c) => {
      // Must not be deleted or archived
      if (c.is_deleted === true || c.is_archived === true || c.metadata?.is_deleted || c.metadata?.del) return false;

      // Exclude associated components
      if (c.associated_comp_id || c.metadata?.associated_comp_id) return false;

      const code = getCode(c);
      if (code !== "RS") return false;

      const qid = String(c.q_id || c.qid || "").trim().toUpperCase();

      // QID must start with R (e.g. R1-..., R2-..., RS-...)
      if (!qid.startsWith("R")) return false;

      // Check text for terminator, support, clamp, guide, bracket
      const text = `${c.q_id || ""} ${c.id_no || ""} ${c.name || ""} ${c.metadata?.description || ""}`.toLowerCase();
      if (
        text.includes("terminator") ||
        text.includes("termination") ||
        text.includes("-term") ||
        text.includes("guide") ||
        text.includes("clamp") ||
        text.includes("bracket") ||
        text.includes("supp") ||
        text.includes("support")
      ) {
        return false;
      }

      // Extract elevations: elv_1 and elv_2 (start elevation to end elevation is top and bottom)
      const { elv1, elv2, hasElevations } = getComponentElevations(c);
      if (hasElevations && elv1 !== null && elv2 !== null && elv1 === elv2) {
        // Same elevation indicates terminator / support / clamp - exclude!
        return false;
      }

      return true;
    });

    // 7. SUMPS (CS type where QID starts with CS-S and elv1 to elv2 is top to bottom, or SM type, non-deleted/non-archived, no associated components)
    const sumpsComps = registeredComponents.filter((c) => {
      // Exclude associated components
      if (c.associated_comp_id || c.metadata?.associated_comp_id) return false;

      const code = getCode(c);
      const qid = String(c.q_id || c.qid || "").trim().toUpperCase();

      // Check if text indicates a terminator, support, guide, clamp, or bracket
      const text = `${c.q_id || ""} ${c.id_no || ""} ${c.name || ""} ${c.metadata?.description || ""}`.toLowerCase();
      if (
        text.includes("terminator") ||
        text.includes("termination") ||
        text.includes("-term") ||
        text.includes("guide") ||
        text.includes("clamp") ||
        text.includes("bracket") ||
        text.includes("supp")
      ) {
        return false;
      }

      // Check elevations: start elevation to end elevation is top and bottom (not same elevation)
      const { elv1, elv2, hasElevations } = getComponentElevations(c);
      if (hasElevations && elv1 !== null && elv2 !== null && elv1 === elv2) {
        return false; // same elevation is terminator
      }

      // Rule: Component is CS and QID starts with CS-S (and elevation is top to bottom)
      if (code === "CS" && qid.startsWith("CS-S")) {
        return true;
      }

      // Or standard Sump code SM / explicitly classified as sump
      if (code === "SM" || (code === "CS" && String(c.metadata?.csum_typ || "").toLowerCase().includes("sump"))) {
        return true;
      }

      return false;
    });

    // 8. CAISSONS (CS type where QID starts with CS-C, top to bottom elevations where elv_1 !== elv_2, exclude terminators where elv_1 === elv_2, no associated components, non-deleted/non-archived)
    const caissonsComps = registeredComponents.filter((c) => {
      const code = getCode(c);
      if (code !== "CS") return false;

      // Exclude associated components
      if (c.associated_comp_id || c.metadata?.associated_comp_id) return false;

      const qid = String(c.q_id || c.qid || "").trim().toUpperCase();

      // QID starting with CS-S is a Sump, exclude from Caissons
      if (qid.startsWith("CS-S")) return false;

      // Exclude if explicitly classified as sump
      if (String(c.metadata?.csum_typ || "").toLowerCase().includes("sump")) return false;

      // QID must start with CS-C (as per rule: CS type but QID starts with CS-C)
      if (!qid.startsWith("CS-C")) return false;

      // Extract elevations: elv_1 and elv_2
      const { elv1, elv2, hasElevations } = getComponentElevations(c);
      if (hasElevations && elv1 !== null && elv2 !== null && elv1 === elv2) {
        // Same elevation indicates Caisson terminator - exclude!
        return false;
      }

      // Check if description, id_no, name, or QID explicitly marks it as a terminator or associated component
      const text = `${c.q_id || ""} ${c.id_no || ""} ${c.name || ""} ${c.metadata?.description || ""} ${c.metadata?.csum_typ || ""}`.toLowerCase();
      if (
        text.includes("terminator") ||
        text.includes("termination") ||
        text.includes("-term") ||
        text.includes("guide") ||
        text.includes("clamp") ||
        text.includes("bracket") ||
        text.includes("supp") ||
        text.includes("support")
      ) {
        return false;
      }

      return true;
    });

    // 9. ANODES (AN type only, non-deleted/non-archived)
    const anodesComps = registeredComponents.filter((c) => getCode(c) === "AN");

    // 10. CRANES (CR type only, non-deleted/non-archived)
    const cranesComps = registeredComponents.filter((c) => getCode(c) === "CR");

    // 11. PLATFORM LEGS (LG type only, non-deleted/non-archived)
    const legsComps = registeredComponents.filter((c) => getCode(c) === "LG");

    // Definition of EXACT Platform Spec Inventory items
    const SPEC_LIST = [
      {
        id: "conductors",
        name: "Conductors",
        specField: "conduct",
        ruleDescription: "CD type count only",
        codeDisplay: "CD",
        components: conductorsComps,
        isSlotField: false,
      },
      {
        id: "internal_piles",
        name: "Internal Piles",
        specField: "pileint",
        ruleDescription: "PL type where Start Node = End Node",
        codeDisplay: "PL (Start = End)",
        components: internalPilesComps,
        isSlotField: false,
      },
      {
        id: "slots",
        name: "Slots",
        specField: "cslot",
        ruleDescription: "Slots for conductor",
        codeDisplay: "Conductor Slots",
        components: slotComps,
        isSlotField: true,
      },
      {
        id: "boatlanding",
        name: "Boatlanding",
        specField: "fender",
        ruleDescription: "BL count (or FD if BL empty)",
        codeDisplay: boatlandingCodeUsed,
        components: boatlandingComps,
        isSlotField: false,
      },
      {
        id: "risers",
        name: "Risers",
        specField: "riser",
        ruleDescription: "RS type with QID starting with R (top to bottom elv)",
        codeDisplay: "RS (R* Top to Bottom)",
        components: risersComps,
        isSlotField: false,
      },
      {
        id: "sumps",
        name: "Sumps",
        specField: "sump",
        ruleDescription: "CS type with QID CS-S (top to bottom elv) or SM",
        codeDisplay: "CS (CS-S) / SM",
        components: sumpsComps,
        isSlotField: false,
      },
      {
        id: "skirt_piles",
        name: "Skirt Piles",
        specField: "pileskt",
        ruleDescription: "PL type where Start Node <> End Node",
        codeDisplay: "PL (Start <> End)",
        components: skirtPilesComps,
        isSlotField: false,
      },
      {
        id: "caissons",
        name: "Caissons",
        specField: "caisson",
        ruleDescription: "CS type with QID CS-C (top to bottom elv, excl. terminators)",
        codeDisplay: "CS (CS-C Top to Bottom)",
        components: caissonsComps,
        isSlotField: false,
      },
      {
        id: "anodes",
        name: "Anodes",
        specField: "an_qty",
        ruleDescription: "AN type count only",
        codeDisplay: "AN",
        components: anodesComps,
        isSlotField: false,
      },
      {
        id: "cranes",
        name: "Cranes",
        specField: "crane",
        ruleDescription: "CR type count only",
        codeDisplay: "CR",
        components: cranesComps,
        isSlotField: false,
      },
      {
        id: "legs",
        name: "Platform Legs",
        specField: "plegs",
        ruleDescription: "LG type count only",
        codeDisplay: "LG",
        components: legsComps,
        isSlotField: false,
      },
    ];

    return SPEC_LIST.map((item) => {
      // 1. Read spec count from platform
      let rawSpecVal: any = undefined;
      if (platformData) {
        rawSpecVal = platformData[item.specField];
        if (item.id === "slots" && rawSpecVal === undefined) {
          rawSpecVal = platformData["cslot"];
        }
      }

      const isNaSpec =
        rawSpecVal === "N/A" ||
        rawSpecVal === "n/a" ||
        (item.id === "slots" && (rawSpecVal === undefined || rawSpecVal === null));
      const specCount = isNaSpec ? "N/A" : Number(rawSpecVal) || 0;

      // 2. Count registered
      const registeredCount = item.components.length;

      // 3. Count inspected WITHOUT DUPLICATES (Unique QIDs in SOW with status inspected or incomplete)
      const uniqueInspectedQids = new Set<string>();

      // A. Check registered components in this category that are marked inspected/incomplete in SOW or inspection records
      item.components.forEach((c) => {
        const info = getComponentInspectionInfo(c);
        if (info.isInspected) {
          const qid = String(c.q_id || c.qid || c.id_no || `ID_${c.id}`).trim().toUpperCase();
          uniqueInspectedQids.add(qid);
        }
      });

      // B. Also incorporate active SOW items directly belonging to this category (deduplicating by unique QID)
      activeSowItems.forEach((sItem) => {
        const isDone =
          isInspectedStatus(sItem.status) ||
          (Array.isArray(sItem.elevation_data) &&
            sItem.elevation_data.some((el: any) => isInspectedStatus(el?.status)));
        if (!isDone) return;

        const rawQid = String(sItem.component_qid || "").trim().toUpperCase();
        const cType = String(sItem.component_type || "").trim().toLowerCase();
        const targetQid = rawQid || (sItem.component_id ? `ID_${sItem.component_id}` : "");
        if (!targetQid) return;

        // When registered components exist for this category, strictly match SOW items against them
        if (item.components.length > 0) {
          const matchesRegistered = item.components.some(
            (c) =>
              c.id === sItem.component_id ||
              c.comp_id === sItem.component_id ||
              String(c.id) === String(sItem.component_id) ||
              (c.q_id && c.q_id.toUpperCase() === rawQid) ||
              (c.qid && c.qid.toUpperCase() === rawQid)
          );
          if (matchesRegistered) {
            uniqueInspectedQids.add(targetQid);
          }
          return;
        }

        // Fallback for categories with 0 registered components in DB (e.g. Slots or un-registered items)
        if (item.id === "conductors") {
          const isAssociatedConductor =
            rawQid.startsWith("CG") ||
            rawQid.startsWith("CF") ||
            rawQid.startsWith("CU") ||
            cType.includes("guide") ||
            cType.includes("framing") ||
            cType.includes("underdeck");
          if (!isAssociatedConductor && (rawQid.startsWith("CD") || cType.includes("conductor"))) {
            uniqueInspectedQids.add(targetQid);
          }
        } else if (item.id === "internal_piles") {
          if (rawQid.startsWith("PL") || cType.includes("pile")) {
            const sN = String(sItem.s_node ?? "").trim();
            const fN = String(sItem.f_node ?? "").trim();
            if ((sN && fN && sN === fN) || cType.includes("internal") || cType.includes("main")) {
              uniqueInspectedQids.add(targetQid);
            }
          }
        } else if (item.id === "skirt_piles") {
          if (rawQid.startsWith("PL") || cType.includes("skirt")) {
            const sN = String(sItem.s_node ?? "").trim();
            const fN = String(sItem.f_node ?? "").trim();
            if ((sN && fN && sN !== fN) || cType.includes("skirt") || cType.includes("skt")) {
              uniqueInspectedQids.add(targetQid);
            }
          }
        } else if (item.id === "slots") {
          if (rawQid.startsWith("SL") || rawQid.startsWith("CSL") || cType.includes("slot")) {
            uniqueInspectedQids.add(targetQid);
          }
        } else if (item.id === "boatlanding") {
          if (rawQid.startsWith("BL") || rawQid.startsWith("FD") || cType.includes("boat") || cType.includes("fender")) {
            uniqueInspectedQids.add(targetQid);
          }
        } else if (item.id === "risers") {
          const isAssociatedRiser =
            rawQid.startsWith("RG") ||
            rawQid.startsWith("RB") ||
            rawQid.includes("SUPP") ||
            rawQid.includes("CLAMP") ||
            rawQid.includes("GUIDE") ||
            rawQid.includes("BRACKET") ||
            rawQid.includes("TERM") ||
            cType.includes("guide") ||
            cType.includes("clamp") ||
            cType.includes("bracket") ||
            cType.includes("support");

          if (
            !isAssociatedRiser &&
            rawQid.startsWith("R") &&
            (cType === "rs" || cType.includes("riser") || rawQid.startsWith("RS") || /^R\d/i.test(rawQid))
          ) {
            const { elv1, elv2, hasElevations } = getComponentElevations(sItem);
            if (!(hasElevations && elv1 !== null && elv2 !== null && elv1 === elv2)) {
              uniqueInspectedQids.add(targetQid);
            }
          }
        } else if (item.id === "sumps") {
          const isAssociatedOrTerminator =
            rawQid.includes("GUIDE") ||
            rawQid.includes("CLAMP") ||
            rawQid.includes("BRACKET") ||
            rawQid.includes("TERM") ||
            rawQid.includes("TERMINATION") ||
            rawQid.includes("SUPP") ||
            rawQid.startsWith("SG") ||
            rawQid.startsWith("CB") ||
            rawQid.startsWith("CL") ||
            cType.includes("guide") ||
            cType.includes("clamp") ||
            cType.includes("bracket") ||
            cType.includes("terminator") ||
            cType.includes("termination") ||
            cType.includes("associated") ||
            cType.includes("support");

          if (
            !isAssociatedOrTerminator &&
            (rawQid.startsWith("CS-S") || rawQid.startsWith("SM") || cType === "sm" || cType.includes("sump"))
          ) {
            const { elv1, elv2, hasElevations } = getComponentElevations(sItem);
            if (!(hasElevations && elv1 !== null && elv2 !== null && elv1 === elv2)) {
              uniqueInspectedQids.add(targetQid);
            }
          }
        } else if (item.id === "caissons") {
          const isAssociatedOrTerminator =
            rawQid.includes("GUIDE") ||
            rawQid.includes("CLAMP") ||
            rawQid.includes("BRACKET") ||
            rawQid.includes("TERM") ||
            rawQid.includes("TERMINATION") ||
            rawQid.includes("SUPP") ||
            rawQid.startsWith("SG") ||
            rawQid.startsWith("CB") ||
            rawQid.startsWith("CL") ||
            cType.includes("guide") ||
            cType.includes("clamp") ||
            cType.includes("bracket") ||
            cType.includes("terminator") ||
            cType.includes("termination") ||
            cType.includes("associated") ||
            cType.includes("support") ||
            cType.includes("sump");

          if (
            !isAssociatedOrTerminator &&
            !rawQid.startsWith("CS-S") &&
            (rawQid.startsWith("CS-C") || (cType === "caisson" && !rawQid.startsWith("CS-S")))
          ) {
            const { elv1, elv2, hasElevations } = getComponentElevations(sItem);
            if (!(hasElevations && elv1 !== null && elv2 !== null && elv1 === elv2)) {
              uniqueInspectedQids.add(targetQid);
            }
          }
        } else if (item.id === "anodes") {
          if (rawQid.startsWith("AN") || cType.includes("anode")) {
            uniqueInspectedQids.add(targetQid);
          }
        } else if (item.id === "cranes") {
          if (rawQid.startsWith("CR") || cType.includes("crane")) {
            uniqueInspectedQids.add(targetQid);
          }
        } else if (item.id === "legs") {
          if (rawQid.startsWith("LG") || cType.includes("leg")) {
            uniqueInspectedQids.add(targetQid);
          }
        }
      });

      const inspectedCount = uniqueInspectedQids.size;

      // 4. Comparison Match Logic
      const isSpecMatch =
        specCount === "N/A"
          ? registeredCount === 0 || registeredCount > 0
          : specCount === registeredCount;

      const variance = specCount === "N/A" ? 0 : registeredCount - (specCount as number);

      return {
        ...item,
        specCount,
        registeredCount,
        inspectedCount,
        uniqueInspectedQids,
        isSpecMatch,
        variance,
      };
    });
  }, [platformData, registeredComponents, inspectedQIdMap, inspectedCompIdMap, activeSowItems]);

  // Filtered Categories
  const filteredCategories = useMemo(() => {
    return categoryAnalysis.filter((cat) => {
      // Search term
      const matchesSearch =
        cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cat.codeDisplay.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cat.ruleDescription.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      // Filter Mode
      if (filterMode === "mismatch") return !cat.isSpecMatch;
      if (filterMode === "matched") return cat.isSpecMatch;

      return true;
    });
  }, [categoryAnalysis, searchTerm, filterMode]);

  // Toggle category breakdown accordion
  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  // Quick Edit Spec Count
  const handleOpenQuickEdit = (category: any) => {
    setEditingCategory(category);
    setNewSpecCount(category.registeredCount.toString());
    setQuickEditDialogOpen(true);
  };

  const handleSaveQuickSpec = async () => {
    if (!editingCategory || !platformData?.plat_id) return;
    setIsSavingCount(true);
    try {
      const field = editingCategory.specField === "cslota" ? "cslot" : editingCategory.specField;
      const count = parseInt(newSpecCount, 10);
      if (isNaN(count) || count < 0) {
        toast.error("Please enter a valid positive number");
        setIsSavingCount(false);
        return;
      }

      const updatePayload: Record<string, any> = {
        [field]: count,
      };

      const res = await fetch(`/api/platform/${platformData.plat_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || "Failed to update platform specification");
      }

      toast.success(`${editingCategory.name} inventory count updated to ${count}`);
      setQuickEditDialogOpen(false);
      fetchInventoryData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to update inventory count");
    } finally {
      setIsSavingCount(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardContent className="p-16 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm font-semibold text-slate-500">Cross-checking platform inventory statistics...</p>
        </CardContent>
      </Card>
    );
  }

  const mismatchCount = categoryAnalysis.filter((c) => !c.isSpecMatch).length;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Action Banner & Direct Platform Structure Spec Editor Option */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white">
                Platform Spec Inventory Statistics Cross-Check
              </span>
              <Badge variant="outline" className="text-[10px] font-bold text-blue-600 border-blue-200">
                {platformData?.title || `Platform ID #${structureId}`}
              </Badge>
              {mismatchCount > 0 ? (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-bold text-[10px] gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  <span>{mismatchCount} Spec Mismatches</span>
                </Badge>
              ) : (
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold text-[10px] gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>All Specs Matched</span>
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cross-checking platform inventory statistics against registered components and SOW inspected data for Report <span className="font-semibold text-slate-700 dark:text-slate-300">{reportNo}</span>.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-1.5 rounded-xl border-slate-200 dark:border-slate-700 h-9 font-bold text-xs"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              <span>Refresh</span>
            </Button>

            <Button
              onClick={() => setSpecsDialogOpen(true)}
              size="sm"
              className="gap-2 rounded-xl h-9 px-4 font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
            >
              <Edit3 className="h-4 w-4" />
              <span>Edit Platform Specs & Comments</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search category or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Button
            variant={filterMode === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterMode("all")}
            className="h-8 rounded-lg text-xs font-bold"
          >
            All Spec Categories ({categoryAnalysis.length})
          </Button>
          <Button
            variant={filterMode === "mismatch" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterMode("mismatch")}
            className={cn(
              "h-8 rounded-lg text-xs font-bold",
              filterMode === "mismatch"
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
            )}
          >
            Mismatches Only ({mismatchCount})
          </Button>
          <Button
            variant={filterMode === "matched" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterMode("matched")}
            className="h-8 rounded-lg text-xs font-bold"
          >
            Matched ({categoryAnalysis.length - mismatchCount})
          </Button>
        </div>
      </div>

      {/* 3. Three-List Component Comparison Table */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
        <CardHeader className="py-4 px-6 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Boxes className="h-4 w-4 text-blue-500" />
              <span>Platform Spec Inventory Cross-Check</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Comparing Spec Inventory Statistics against Registered Components in DB and Unique Inspected QIDs in SOW (Status: Inspected or Incomplete, Any Inspection Type)
            </CardDescription>
          </div>
          <Badge variant="secondary" className="font-mono text-xs">
            {filteredCategories.length} Categories Listed
          </Badge>
        </CardHeader>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-800/60">
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead className="font-bold text-xs">Category & Counting Rule</TableHead>
                <TableHead className="font-bold text-xs text-center w-[160px]">
                  1. Spec Inventory Count
                </TableHead>
                <TableHead className="font-bold text-xs text-center w-[160px]">
                  2. Registered Count
                </TableHead>
                <TableHead className="font-bold text-xs text-center w-[180px]">
                  <div className="flex flex-col items-center">
                    <span>3. Total Inspected</span>
                    <span className="text-[10px] text-slate-400 font-normal">Unique QIDs (SOW)</span>
                  </div>
                </TableHead>
                <TableHead className="font-bold text-xs text-center w-[190px]">
                  Validation Status
                </TableHead>
                <TableHead className="font-bold text-xs text-right w-[150px]">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCategories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                    No categories found matching your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCategories.map((cat) => {
                  const isExpanded = !!expandedCategories[cat.id];
                  const hasDiscrepancy = !cat.isSpecMatch;

                  return (
                    <React.Fragment key={cat.id}>
                      <TableRow
                        className={cn(
                          "hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors",
                          hasDiscrepancy && "bg-amber-50/20 dark:bg-amber-950/10"
                        )}
                      >
                        {/* Accordion Expand Button */}
                        <TableCell className="p-2 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleCategory(cat.id)}
                            className="h-7 w-7 text-slate-400 hover:text-slate-600"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>

                        {/* Category Name & Rule */}
                        <TableCell className="py-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                              {cat.name}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] text-slate-500 font-mono">
                                Rule: {cat.ruleDescription} ({cat.codeDisplay})
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">
                                spec.{cat.specField}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* 1. Spec Count */}
                        <TableCell className="text-center font-bold text-sm">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <span
                              className={cn(
                                "font-mono text-base px-2.5 py-0.5 rounded-lg",
                                hasDiscrepancy
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-black"
                                  : "text-slate-900 dark:text-slate-100"
                              )}
                            >
                              {cat.specCount}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenQuickEdit(cat)}
                              title="Update Spec Count"
                              className="h-6 w-6 text-slate-400 hover:text-blue-600 rounded-md"
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>

                        {/* 2. Registered Count */}
                        <TableCell className="text-center font-bold text-sm">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <span
                              className={cn(
                                "font-mono text-base px-2.5 py-0.5 rounded-lg",
                                cat.registeredCount === 0
                                  ? "text-slate-400"
                                  : "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-black"
                              )}
                            >
                              {cat.registeredCount}
                            </span>
                          </div>
                        </TableCell>

                        {/* 3. Total Inspected (Unique QIDs in SOW with status Inspected or Incomplete) */}
                        <TableCell className="text-center font-bold text-sm">
                          <div className="flex flex-col items-center">
                            <span
                              className={cn(
                                "font-mono text-base px-2.5 py-0.5 rounded-lg",
                                cat.inspectedCount > 0
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-black"
                                  : "text-slate-400"
                              )}
                            >
                              {cat.inspectedCount}
                            </span>
                            {cat.registeredCount > 0 && (
                              <span className="text-[10px] text-slate-400 mt-0.5">
                                {Math.round((cat.inspectedCount / cat.registeredCount) * 100)}% of registered
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Validation Status */}
                        <TableCell className="text-center">
                          {hasDiscrepancy ? (
                            <div className="flex flex-col items-center gap-1">
                              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300 font-bold text-[11px] gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                <span>Spec Mismatch</span>
                              </Badge>
                              <span className="text-[10px] text-amber-600 font-mono font-bold">
                                {cat.variance > 0 ? `+${cat.variance} in DB` : `${cat.variance} in DB`}
                              </span>
                            </div>
                          ) : cat.registeredCount === 0 && (cat.specCount === 0 || cat.specCount === "N/A") ? (
                            <Badge variant="outline" className="text-slate-400 border-slate-200 text-[10px]">
                              {cat.specCount === "N/A" ? "N/A in Spec" : "None (0 in Spec & DB)"}
                            </Badge>
                          ) : cat.inspectedCount >= cat.registeredCount && cat.registeredCount > 0 ? (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300 font-bold text-[11px] gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>100% Inspected & Matched</span>
                            </Badge>
                          ) : cat.inspectedCount > 0 ? (
                            <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 font-bold text-[11px] gap-1">
                              <Check className="h-3 w-3" />
                              <span>Spec & Registered Matched</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-500 border-slate-300 font-medium text-[11px]">
                              Spec Matched (Uninspected)
                            </Badge>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {hasDiscrepancy && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenQuickEdit(cat)}
                                className="h-7 px-2 text-[11px] font-bold border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                              >
                                Sync Spec
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleCategory(cat.id)}
                              className="h-7 px-2 text-[11px] font-bold text-slate-600 dark:text-slate-400"
                            >
                              {isExpanded ? "Hide Items" : "View Items"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Accordion: List of Components */}
                      {isExpanded && (
                        <TableRow className="bg-slate-50/50 dark:bg-slate-900/50">
                          <TableCell colSpan={7} className="p-4">
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                    Components in {cat.name} ({cat.components.length} Registered, {cat.inspectedCount} Unique QIDs Inspected)
                                  </span>
                                  <Badge variant="secondary" className="text-[10px]">
                                    SOW Status: Inspected / Incomplete
                                  </Badge>
                                </div>
                                {hasDiscrepancy && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenQuickEdit(cat)}
                                    className="h-7 text-xs font-bold gap-1 text-blue-600 border-blue-200"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                    <span>Update Spec Count to {cat.registeredCount}</span>
                                  </Button>
                                )}
                              </div>

                              {cat.components.length === 0 ? (
                                <p className="text-xs text-slate-400 py-3 text-center">
                                  No registered components found matching {cat.ruleDescription}.
                                </p>
                              ) : (
                                <div className="max-h-72 overflow-y-auto">
                                  <Table>
                                    <TableHeader className="bg-slate-100/50 dark:bg-slate-900/50 text-[11px]">
                                      <TableRow>
                                        <TableHead className="font-bold py-2">Q-ID / Tag</TableHead>
                                        <TableHead className="font-bold py-2">ID No / Location</TableHead>
                                        <TableHead className="font-bold py-2">{cat.id === "caissons" || cat.id === "sumps" || cat.id === "risers" ? "Top Elv (1)" : "Start Node"}</TableHead>
                                        <TableHead className="font-bold py-2">{cat.id === "caissons" || cat.id === "sumps" || cat.id === "risers" ? "Bottom Elv (2)" : "End Node"}</TableHead>
                                        <TableHead className="font-bold py-2">Code</TableHead>
                                        <TableHead className="font-bold py-2">SOW Status</TableHead>
                                        <TableHead className="font-bold py-2">Inspection Types</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody className="text-xs">
                                      {cat.components.map((comp: any) => {
                                        const inspInfo = getComponentInspectionInfo(comp);
                                        const { sNode, fNode } = getComponentNodes(comp);
                                        const { elv1, elv2 } = getComponentElevations(comp);

                                        return (
                                          <TableRow key={comp.id || comp.q_id} className="hover:bg-slate-50/50">
                                            <TableCell className="font-mono font-bold py-2 text-slate-900 dark:text-slate-100">
                                              {comp.q_id || `ID #${comp.id}`}
                                            </TableCell>
                                            <TableCell className="font-mono text-[11px] text-slate-500 py-2">
                                              {comp.id_no || comp.name || "—"}
                                            </TableCell>
                                            <TableCell className="font-mono text-[11px] text-slate-600 py-2">
                                              {cat.id === "caissons" || cat.id === "sumps" || cat.id === "risers"
                                                ? elv1 !== null
                                                  ? `${elv1}m`
                                                  : sNode || "—"
                                                : sNode || "—"}
                                            </TableCell>
                                            <TableCell className="font-mono text-[11px] text-slate-600 py-2">
                                              {cat.id === "caissons" || cat.id === "sumps" || cat.id === "risers"
                                                ? elv2 !== null
                                                  ? `${elv2}m`
                                                  : fNode || "—"
                                                : fNode || "—"}
                                            </TableCell>
                                            <TableCell className="font-mono py-2">
                                              <Badge variant="outline" className="text-[10px] font-bold">
                                                {comp.code || "—"}
                                              </Badge>
                                            </TableCell>
                                            <TableCell className="py-2">
                                              {inspInfo.isInspected ? (
                                                <Badge
                                                  className={cn(
                                                    "font-bold text-[10px] gap-1",
                                                    inspInfo.status === "incomplete"
                                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                                  )}
                                                >
                                                  <Check className="h-3 w-3" />
                                                  <span className="capitalize">{inspInfo.status}</span>
                                                </Badge>
                                              ) : (
                                                <Badge variant="outline" className="text-slate-400 text-[10px]">
                                                  Pending / Not in SOW
                                                </Badge>
                                              )}
                                            </TableCell>
                                            <TableCell className="py-2">
                                              {inspInfo.isInspected && inspInfo.inspectionTypes.length > 0 ? (
                                                <div className="flex flex-wrap items-center gap-1">
                                                  {inspInfo.inspectionTypes.map((tCode: string, idx: number) => (
                                                    <Badge
                                                      key={idx}
                                                      variant="secondary"
                                                      className="text-[10px] font-mono font-bold"
                                                    >
                                                      {tCode}
                                                    </Badge>
                                                  ))}
                                                </div>
                                              ) : (
                                                <span className="text-slate-400 text-[11px] italic">—</span>
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* 4. Platform Comments & Spec Notes Preview Card */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
        <CardHeader className="py-4 px-6 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-indigo-500" />
              <span>Platform Comments & Spec Audit Notes</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Review and record QA-QC audit observations or specification notes for this platform
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <CommentDialog />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSpecsDialogOpen(true)}
              className="text-xs font-bold gap-1 rounded-xl h-9"
            >
              <span>View All in Platform Specs</span>
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {platformComments.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs">
              <p>No comments recorded for this platform yet.</p>
              <p className="mt-1">Use the "+ Comment" button above to add QA-QC inventory verification notes.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {platformComments.slice(0, 3).map((c: any, i: number) => (
                <div
                  key={c.id || i}
                  className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {c.author || c.user_name || "Auditor"}
                    </span>
                    <span>{c.created_at ? new Date(c.created_at).toLocaleDateString() : ""}</span>
                  </div>
                  <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{c.text || c.comment}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Quick Edit Dialog for Single Category Spec Count */}
      <Dialog open={quickEditDialogOpen} onOpenChange={setQuickEditDialogOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-blue-500" />
              <span>Update Spec Inventory Count</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update the platform structure specification inventory statistic entry for {editingCategory?.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Current Platform Spec Entry:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {editingCategory?.specCount ?? 0}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Registered Components in DB:</span>
                <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                  {editingCategory?.registeredCount ?? 0}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Unique Inspected QIDs (SOW):</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {editingCategory?.inspectedCount ?? 0}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                New Spec Count for {editingCategory?.name} (spec.{editingCategory?.specField}):
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  value={newSpecCount}
                  onChange={(e) => setNewSpecCount(e.target.value)}
                  className="rounded-xl h-10 font-mono text-base font-bold"
                />
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setNewSpecCount(editingCategory?.registeredCount?.toString() || "0")}
                  className="shrink-0 text-xs font-bold h-10 px-3"
                  title="Copy registered count"
                >
                  Use Registered ({editingCategory?.registeredCount})
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setQuickEditDialogOpen(false)}
              className="rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveQuickSpec}
              disabled={isSavingCount}
              className="rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              {isSavingCount ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              <span>Save to Platform Spec</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. Full Platform Specs Dialog (with Specs, Inventory Statistics, Extended Data & Comments) */}
      {specsDialogOpen && platformData && (
        <PlatformSpecsDialog
          open={specsDialogOpen}
          onOpenChange={setSpecsDialogOpen}
          platformDetails={platformData}
          onSuccess={() => {
            fetchInventoryData();
            toast.success("Platform specs successfully synchronized with QA-QC module");
          }}
        />
      )}
    </div>
  );
}
