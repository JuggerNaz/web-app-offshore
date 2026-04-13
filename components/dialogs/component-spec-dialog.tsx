"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/utils/utils";
import { DataTable } from "@/components/data-table/data-table";
import { comments, attachments } from "@/components/data-table/columns";
import { ComponentCommentDialog } from "./component-comment-dialog";
import { ComponentAttachmentDialog } from "./component-attachment-dialog";
import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";
import { toast } from "sonner";
import specAdditionalDetails from "@/utils/spec-additional-details.json";
import specUiConfig from "@/utils/spec-ui-config.json";
import { Wrench, Settings2, Save, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Component = {
  id: number;
  comp_id: number;
  structure_id: number;
  q_id: string;
  id_no: string;
  code: string | null;
  metadata: any;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  modified_by: string | null;
  created_by_name?: string | null;
  modified_by_name?: string | null;
};

// Helper to build ID No in the format:
// code/[start node-end node (6 digit)]/[distance (5 digit)]/[clock position (2 digit)]
// Example: AN/006025-006015/00000/00
const padNumericString = (value: string | null | undefined, length: number) => {
  const digits = (value ?? "").toString().replace(/\D/g, "");
  const base = digits === "" ? "0" : digits;
  const padded = base.padStart(length, "0");
  return padded.slice(-length);
};

const buildIdNo = (
  code: string | null | undefined,
  s_node: string,
  f_node: string,
  dist: string,
  clk_pos: string
): string => {
  if (!code) return "";
  const startNode = padNumericString(s_node, 6);
  const endNode = padNumericString(f_node, 6);
  const distance = padNumericString(dist, 5);
  const clockPos = padNumericString(clk_pos, 2);
  return `${code}/${startNode}-${endNode}/${distance}/${clockPos}`;
};

// Unit category helpers
const getUnitOptions = (category: string | null, isImperial: boolean) => {
  if (category === 'length') {
    return isImperial ? ['inches', 'feet', 'm', 'cm', 'mm'] : ['m', 'cm', 'mm', 'inches', 'feet'];
  }
  if (category === 'weight') {
    return isImperial ? ['pounds', 'tonne', 'kg', 'g'] : ['tonne', 'kg', 'g', 'pounds'];
  }
  if (category === 'pressure') {
    return ['bars', 'psi'];
  }
  return null;
};

const getDefaultUnit = (category: string | null, isImperial: boolean, fieldName?: string, componentCode?: string) => {
  const code = componentCode?.toLowerCase() || '';
  if (category === 'length') {
    if (isImperial) return 'inches';
    // Maintain legacy special cases for Metric
    if (code === 'ce' || code === 'gs') return 'm';
    return 'mm';
  }
  if (category === 'weight') {
    return isImperial ? 'pounds' : 'tonne';
  }
  if (category === 'pressure') {
    return 'bars';
  }
  return null;
};

type ComponentSpecDialogProps = {
  component: Component | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: 'view' | 'create';
  defaultCode?: string | null;
  typeName?: string | null;
  listKey?: string | null;
  createdFrom?: string;
};

export function ComponentSpecDialog({
  component,
  open,
  onOpenChange,
  mode = 'view',
  defaultCode,
  typeName,
  listKey,
  createdFrom
}: ComponentSpecDialogProps) {
  const isCreateMode = mode === 'create';
  const isEditMode = false; // edit handled by separate dialog
  const [structureId] = useAtom(urlId);
  const [pageType] = useAtom(urlType);
  const [isSaving, setIsSaving] = useState(false);

  const effectiveCode = (isCreateMode ? ("" + (defaultCode || "")).trim() : component?.code || null) || null;

  // Clock position options (POSITION library)
  const { data: positionLib } = useSWR(`/api/library/${"POSITION"}`, fetcher);
  // Structural group options (COMPGRP library)
  const { data: compGroupLib } = useSWR(`/api/library/${"COMPGRP"}`, fetcher);
  // Boat Fender Types options (u_lib_list where lib_code = FEND_TYP)
  const { data: fenderTypeData } = useSWR(`/api/library/FEND_TYP`, fetcher);
  // Boat Bumper Types options (u_lib_list where lib_code = BBUM_TYP)
  const { data: bumperTypeData } = useSWR(`/api/library/BBUM_TYP`, fetcher);
  // Caisson specific options
  const { data: csumTypeData } = useSWR(`/api/library/CSUM_TYP`, fetcher);
  const { data: caisAtData } = useSWR(`/api/library/CAIS_AT`, fetcher);
  const { data: pileTypeData } = useSWR(`/api/library/PILE_TYP`, fetcher);
  const { data: pileMatData } = useSWR(`/api/library/PILE_MAT`, fetcher);
  const { data: pgudTypData } = useSWR(`/api/library/PGUD_TYP`, fetcher);
  const { data: pgudMatData } = useSWR(`/api/library/PGUD_MAT`, fetcher);
  const { data: pgudFasData } = useSWR(`/api/library/PGUD_FAS`, fetcher);

  const { data: corrCtgData } = useSWR(`/api/library/CORR_CTG`, fetcher);
  // Clamp specific options
  const { data: clamTypeData } = useSWR(`/api/library/CLAM_TYP`, fetcher);
  const { data: clamMatData } = useSWR(`/api/library/CLAM_MAT`, fetcher);
  const { data: linerReqData } = useSWR(`/api/library/LINER_REQ`, fetcher);
  const { data: coatTypData } = useSWR(`/api/library/COAT_TYP`, fetcher);
  const { data: cgudTypData } = useSWR(`/api/library/CGUD_TYP`, fetcher);
  const { data: fitgTypData } = useSWR(`/api/library/FITG_TYP`, fetcher);
  const { data: sgudTypData } = useSWR(`/api/library/SGUD_TYP`, fetcher);
  const { data: nominalDiamData } = useSWR(`/api/library/NOM_DIAM`, fetcher);
  const { data: ctryTypData } = useSWR(`/api/library/CTRY_TYP`, fetcher);
  const { data: ctryPosData } = useSWR(`/api/library/CTRY_POS`, fetcher);
  const { data: ctryMatData } = useSWR(`/api/library/CTRY_MAT`, fetcher);
  const { data: ctryFasData } = useSWR(`/api/library/CTRY_FAS`, fetcher);
  const { data: hoseTypData } = useSWR(`/api/library/HOSE_TYP`, fetcher);
  const { data: hoseCntData } = useSWR(`/api/library/HOSE_CNT`, fetcher);
  const { data: flanClsData } = useSWR(`/api/library/FLAN_CLS`, fetcher);
  const { data: weldTypData } = useSWR(`/api/library/WELD_TYP`, fetcher);
  const { data: weldDesData } = useSWR(`/api/library/WELD_DES`, fetcher);
  const { data: weldMatData } = useSWR(`/api/library/WELD_MAT`, fetcher);
  const { data: weldCfgData } = useSWR(`/api/library/WELD_CFG`, fetcher);
  const { data: risrTypData } = useSWR(`/api/library/RISR_TYP`, fetcher);
  const { data: risrMatData } = useSWR(`/api/library/RISR_MAT`, fetcher);
  const { data: pipeRtgData } = useSWR(`/api/library/PIPE_RTG`, fetcher);
  const { data: risgTypData } = useSWR(`/api/library/RISG_TYP`, fetcher);
  const { data: risbTypData } = useSWR(`/api/library/RISB_TYP`, fetcher);
  const { data: stubMatData } = useSWR(`/api/library/STUB_MAT`, fetcher);
  const { data: wsupTypData } = useSWR(`/api/library/WSUP_TYP`, fetcher);
  const { data: membMatData } = useSWR(`/api/library/mast/MEMB_MAT`, fetcher);
  const { data: stdMembMatData } = useSWR(`/api/library/MEMB_MAT`, fetcher);
  // Anode specific options
  const { data: anodeTypeData } = useSWR(`/api/library/ANOD_TYP`, fetcher);
  const { data: anodeMatData } = useSWR(`/api/library/ANOD_MAT`, fetcher);
  const { data: anodeFitData } = useSWR(`/api/library/FITTING`, fetcher);
  // Platform details for legs
  const { data: platformData } = useSWR(
    pageType === "platform" && structureId ? `/api/platform/${structureId}` : null,
    fetcher
  );

  const legOptions = platformData?.data ? Array.from({ length: 20 }, (_, i) => {
    const key = `leg_t${i + 1}`;
    const val = platformData.data[key];
    return val ? { value: val, label: val } : null;
  }).filter(Boolean) : [];

  // All components for association
  const { data: allComponents } = useSWR(
    structureId ? `/api/structure-components/${structureId}` : null,
    fetcher
  );
 
  // Global company settings for units
  const { data: companyData } = useSWR('/api/company-settings', fetcher);
  const defUnit = companyData?.data?.def_unit || "METRIC";
  const isImperial = defUnit === "IMPERIAL";

  const [selectorOpen, setSelectorOpen] = useState(false);

  // Level options
  const { data: levelData } = useSWR(
    pageType === "platform" && structureId ? `/api/platform/level/${structureId}` : null,
    fetcher
  );
  const levelOptions = levelData?.data ? levelData.data.map((x: any) => ({
    value: x.level_name,
    label: x.level_name
  })) : [];

  // Face options
  const { data: faceData } = useSWR(
    pageType === "platform" && structureId ? `/api/platform/faces/${structureId}` : null,
    fetcher
  );
  const faceOptions = faceData?.data ? faceData.data.map((x: any) => ({
    value: x.face,
    label: x.face
  })) : [];

  // Form state for create mode
  const [formData, setFormData] = useState({
    q_id: "",
    id_no: "",
    code: "",
    description: "",
    s_node: "",
    f_node: "",
    s_leg: "",
    f_leg: "",
    dist: "",
    dist_unit: "m",
    elv_1: "",
    elv_1_unit: "m",
    elv_2: "",
    elv_2_unit: "m",
    clk_pos: "",
    lvl: "",
    face: "",
    top_und: "",
    comp_group: "",
    associated_comp_id: null as number | null,
    kp: "",
    kp_unit: "km",
    easting: "",
    easting_unit: "m",
    northing: "",
    northing_unit: "m",
    depth: "",
    depth_unit: "m",
    additionalInfo: {
      wall_thk: "",
      depth: "",
      diameter: "",
    } as Record<string, any>,
  });

  const getTemplate = (code: string | null, type: string) => {
    if (!code) return {};
    const lowerCode = code.toLowerCase();
    let template = {};
    if (lowerCode === "an") {
      const compType = type === "platform" ? "an_comp_plat" : "an_comp_pipe";
      template = specAdditionalDetails.data.find(d => d.componentType === compType)?.additionalDataTemplate || {};
    } else {
      template = specAdditionalDetails.data.find(d => d.code === lowerCode)?.additionalDataTemplate || {};
    }

    const patchedTemplate: Record<string, any> = { ...template };
    if (lowerCode === 'bb' && !('bumper_type' in patchedTemplate)) {
      patchedTemplate.bumper_type = "";
    }
    if (lowerCode === 'fd' && !('fender_type' in patchedTemplate)) {
      patchedTemplate.fender_type = "";
    }
    if (lowerCode === 'cs' && !('csum_typ' in patchedTemplate)) {
      patchedTemplate.csum_typ = "";
      patchedTemplate.cais_at = "";
      patchedTemplate.corr_ctg = "";
    }
    if (lowerCode === 'cl' && !('clam_typ' in patchedTemplate)) {
      patchedTemplate.clam_typ = "";
      patchedTemplate.clam_mat = "";
    }
    if (lowerCode === 'cd' && !('coat_typ' in patchedTemplate)) {
      patchedTemplate.coat_typ = "";
    }
    if (lowerCode === 'cf' && !('cgud_typ' in patchedTemplate)) {
      patchedTemplate.cgud_typ = "";
      patchedTemplate.fitg_typ = "";
    }
    if (lowerCode === 'ct' && !('ctry_typ' in patchedTemplate)) {
      patchedTemplate.ctry_typ = "";
      patchedTemplate.ctry_pos = "";
      patchedTemplate.ctry_mat = "";
      patchedTemplate.ctry_fas = "";
    }
    if (lowerCode === 'fa' && !('face_pos' in patchedTemplate)) {
      patchedTemplate.face_pos = "";
    }
    if ((lowerCode === 'hd' || lowerCode === 'vd' || lowerCode === 'vm' || lowerCode === 'hm' || lowerCode === 'lg') && !('memb_mat' in patchedTemplate)) {
      patchedTemplate.memb_mat = "";
      if (lowerCode !== 'lg') patchedTemplate.corr_ctg = "";
    }
    if (lowerCode === 'hs' && !('hose_typ' in patchedTemplate)) {
      patchedTemplate.hose_typ = "";
      patchedTemplate.hose_man = "";
      patchedTemplate.flan_cls = "";
      patchedTemplate.hose_cnt = "";
    }
    if (lowerCode === 'wn' && !('weld_typ' in patchedTemplate)) {
      patchedTemplate.weld_typ = "";
      patchedTemplate.weld_des = "";
      patchedTemplate.weld_mat = "";
      patchedTemplate.weld_cfg = "";
    }
    if (lowerCode === 'wp' && !('weld_typ' in patchedTemplate)) {
      patchedTemplate.weld_typ = "";
      patchedTemplate.weld_des = "";
      patchedTemplate.weld_mat = "";
      patchedTemplate.weld_cfg = "";
      patchedTemplate.wsup_typ = "";
    }
    if (lowerCode === 'rs' && !('risr_typ' in patchedTemplate)) {
      patchedTemplate.risr_typ = "";
      patchedTemplate.risr_mat = "";
      patchedTemplate.corr_ctg = "";
      patchedTemplate.pipe_rtg = "";
    }
    if ((lowerCode === 'rg' || lowerCode === 'sg') && !('risg_typ' in patchedTemplate)) {
      patchedTemplate.risg_typ = "";
    }
    if (lowerCode === 'rb' && !('risb_typ' in patchedTemplate)) {
      patchedTemplate.risb_typ = "";
    }
    if (lowerCode === 'sd' && !('stub_mat' in patchedTemplate)) {
      patchedTemplate.stub_mat = "";
    }

    return patchedTemplate;
  };
  useEffect(() => {
    if (isCreateMode && effectiveCode) {
      const template = getTemplate(effectiveCode, pageType);
      setFormData(prev => ({
        ...prev,
        additionalInfo: {
          ...template,
          wall_thk: "",
          depth: "",
          diameter: "",
        }
      }));
    }
  }, [effectiveCode, isCreateMode, pageType]);

  // Dynamic unit defaults based on company settings
  useEffect(() => {
    if (companyData?.data && open) {
      setFormData(prev => {
        let changed = false;
        const updates: any = {};
        const isImp = isImperial;

        // Base fields
        if (prev.dist_unit !== (isImp ? "inches" : "m")) { updates.dist_unit = isImp ? "inches" : "m"; changed = true; }
        if (prev.elv_1_unit !== (isImp ? "inches" : "m")) { updates.elv_1_unit = isImp ? "inches" : "m"; changed = true; }
        if (prev.elv_2_unit !== (isImp ? "inches" : "m")) { updates.elv_2_unit = isImp ? "inches" : "m"; changed = true; }
        if (prev.kp_unit !== (isImp ? "mile" : "km")) { updates.kp_unit = isImp ? "mile" : "km"; changed = true; }
        if (prev.depth_unit !== (isImp ? "inches" : "m")) { updates.depth_unit = isImp ? "inches" : "m"; changed = true; }
        if (prev.easting_unit !== (isImp ? "inches" : "m")) { updates.easting_unit = isImp ? "inches" : "m"; changed = true; }
        if (prev.northing_unit !== (isImp ? "inches" : "m")) { updates.northing_unit = isImp ? "inches" : "m"; changed = true; }
        
        if (prev.additionalInfo) {
          const newAdd = { ...prev.additionalInfo };
          let addChanged = false;
          const componentConfig = specUiConfig.components.find(c => c.code.toLowerCase() === effectiveCode?.toLowerCase());

          Object.keys(newAdd).forEach(k => {
             if (k.endsWith('_unit')) {
               const fieldName = k.replace('_unit', '');
               const fieldConfig = componentConfig?.fields.find(f => f.name === fieldName);
               const category = fieldConfig?.unitcategory || null;
               
               // Fallback: if category missing, infer from name as before but prioritized by category
               const resolvedCategory = category || (fieldName.includes('weight') || fieldName.includes('wt') ? 'weight' : 'length');
               
               const newUnit = getDefaultUnit(resolvedCategory, isImp, fieldName, effectiveCode || undefined);
               if (newUnit && newAdd[k] !== newUnit) {
                 newAdd[k] = newUnit;
                 addChanged = true;
               }
             }
          });
          if (addChanged) {
            updates.additionalInfo = newAdd;
            changed = true;
          }
        }
        
        return changed ? { ...prev, ...updates } : prev;
      });
    }
  }, [companyData?.data?.def_unit, open, effectiveCode]);



  // Update code when defaultCode changes (when switching component types)
  useEffect(() => {
    if (isCreateMode && defaultCode) {
      setFormData(prev => ({ ...prev, code: defaultCode }));
    }
  }, [defaultCode, isCreateMode]);

  // Initialize formData from existing component (view mode) or switching back to create mode
  useEffect(() => {
    if (component && !isCreateMode) {
      setFormData({
        q_id: component.q_id || "",
        id_no: component.id_no || "",
        code: component.code || defaultCode || "",
        description: component.metadata?.description ?? "",
        s_node: component.metadata?.s_node ?? "",
        f_node: component.metadata?.f_node ?? "",
        s_leg: component.metadata?.s_leg ?? "",
        f_leg: component.metadata?.f_leg ?? "",
        dist: component.metadata?.dist ?? "",
        dist_unit: component.metadata?.dist_unit ?? "m",
        elv_1: component.metadata?.elv_1 ?? "",
        elv_1_unit: component.metadata?.elv_1_unit ?? "m",
        elv_2: component.metadata?.elv_2 ?? "",
        elv_2_unit: component.metadata?.elv_2_unit ?? "m",
        clk_pos: component.metadata?.clk_pos ?? "",
        lvl: component.metadata?.lvl ?? "",
        face: component.metadata?.face ?? "",
        top_und: component.metadata?.top_und ?? "",
        comp_group: component.metadata?.comp_group ?? "",
        associated_comp_id: component.metadata?.associated_comp_id ?? null,
        kp: component.metadata?.kp ?? "",
        kp_unit: component.metadata?.kp_unit ?? "km",
        easting: component.metadata?.easting ?? "",
        easting_unit: component.metadata?.easting_unit ?? "m",
        northing: component.metadata?.northing ?? "",
        northing_unit: component.metadata?.northing_unit ?? "m",
        depth: component.metadata?.depth ?? "",
        depth_unit: component.metadata?.depth_unit ?? "m",
        additionalInfo: (() => {
          const info = {
            ...getTemplate(component.code, pageType),
            ...component.metadata?.additionalInfo,
          };

          const code = component.code?.trim().toLowerCase();
          const isSpecialComp = ['fd', 'an', 'cs', 'cl', 'cd', 'fa', 'hd', 'hm', 'vd', 'vm', 'hs', 'pl', 'pg', 'bb', 'sg', 'cu', 'cf', 'it', 'lg', 'wn', 'wp', 'rs', 'rg', 'rb', 'ct', 'gp', 'gs', 'bl', 'fv', 'ce', 'sd', 'yp'].includes(code || '');

          if (isSpecialComp) {
            if (code === 'ct') {
              delete info.id_chk;
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
            } else if (['fd', 'an', 'cs', 'fv'].includes(code || '')) {
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
              delete info.id_chk;
              if (code === 'fd') delete info.thetype;
              if (code === 'an') {
                delete info.last_inspno;
                if (pageType === 'pipeline') {
                  delete info.x_cord;
                  delete info.y_cord;
                  delete info.fp;
                }
              }
              if (code === 'cs') delete info.thetype;
            } else if (code === 'cl') {
              delete info.depth;
              delete info.id_chk;
              delete info.thetype;
              delete info.material;
            } else if (code === 'cd') {
              delete info.depth;
              delete info.diameter;
              delete info.id_chk;
              delete info.coating;
              info.wall_thk = component.metadata?.additionalInfo?.wall_thk ?? "";
            } else if (code === 'fa') {
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
              delete info.position;
              delete info.id_chk;
            } else if (code === 'cf') {
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
              delete info.id_chk;
              delete info.thetype;
              delete info.attach_method;
              delete info.top_und;
              delete info.comp_group;
            } else if (code === 'it') {
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
              delete info.x_cord;
              delete info.y_cord;
              delete info.fp;
            } else if (code === 'pl') {
              delete info.id_chk;
            } else if (code === 'pg') {
              delete info.wall_thk;
              delete info.depth;
              delete info.id_chk;
              delete info.thetype;
              delete info.pile;
              delete info.weight;
              delete info.no_undattach;
              delete info.no_topattach;
            } else if (code === 'bb') {
              delete info.wall_thk;
              delete info.depth;
              delete info.id_chk;
              delete info.thetype;
            } else if (code === 'lg') {
              delete info.thetype;
              delete info.id_chk;
              delete info.depth;
            } else if (code === 'sg' || code === 'cu') {
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
              delete info.no_risers;
              delete info.riser_wt;
              delete info.id_chk;
              delete info.risg_typ;
            } else if (['hd', 'hm', 'vd', 'vm'].includes(code || '')) {
              delete info.depth;
              delete info.diameter;
              delete info.material;
              delete info.designation;
              delete info.beam_desig;
              delete info.vertical_ch_desig;
              delete info.angle_desig;
              delete info.nominal_size;
              delete info.channel_desg;
              delete info.horiz_chan_desg;
              delete info.flange_thk;
              delete info.flange_avg_thk;
              delete info.flange_width;
              delete info.web_thk;
              delete info.stem_thk;
              delete info.web_depth;
              delete info.id_chk;
              delete info.coating;
              info.wall_thk = component.metadata?.additionalInfo?.wall_thk ?? "";
            } else if (code === 'hs') {
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
              delete info.hose_type;
              delete info.hose_contents;
              delete info.manufacturer;
              delete info.assoc_str;
              delete info.id_chk;
            } else if (code === 'wn') {
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
              delete info.id_chk;
              delete info.weld_confg;
              delete info.weld_type;
              delete info.desg_code;
              delete info.material;
            } else if (code === 'wp') {
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
              delete info.weld_confg;
              delete info.weld_type;
              delete info.thetype;
              delete info.desg_code;
              delete info.material;
              delete info.id_chk;
            } else if (code === 'rs') {
              delete info.thetype;
              delete info.material;
              delete info.coating;
              delete info.flange_rating;
              delete info.id_chk;
              delete info.assoc_str;
              delete info.depth;
            } else if (code === 'rg') {
              delete info.thetype;
              delete info.riser_wt;
              delete info.id_chk;
              delete info.wall_thk;
              delete info.diameter;
            } else if (code === 'rb') {
              delete info.thetype;
              delete info.id_chk;
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
            } else if (code === 'gs') {
              delete info.wall_thk;
            } else if (code === 'gp') {
              delete info.wall_thk;
              delete info.diameter;
              delete info.depth;
              delete info.qid_member_attached;
            } else if (code === 'bl') {
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
              delete info.thetype;
              delete info.id_chk;
              delete info.width;
            } else if (code === 'fv') {
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
            } else if (code === 'ce') {
              delete info.wall_thk;
              delete info.id_chk;
            } else if (code === 'yp') {
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
            } else if (code === 'sd') {
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
              delete info.id_chk;
              delete info.dist_leg;
              delete info.stub_mat;
            }
          } else {
            info.wall_thk = component.metadata?.additionalInfo?.wall_thk ?? "";
            info.depth = component.metadata?.additionalInfo?.depth ?? "";
            info.diameter = component.metadata?.additionalInfo?.diameter ?? "";
          }

          if (info.electrically_cont !== undefined) {
            info.electrically_cont = info.electrically_cont === true || info.electrically_cont === "true";
          }

          return info;
        })(),
      });
    } else if (isCreateMode) {
      // Ensure a clean slate when switching back to create mode
      setFormData((prev) => ({
        ...prev,
        q_id: "",
        comp_group: "",
        associated_comp_id: null,
        kp: "",
        kp_unit: "km",
        easting: "",
        easting_unit: "m",
        northing: "",
        northing_unit: "m",
        depth: "",
        depth_unit: "m",
        id_no: "",
        code: defaultCode || "",
        additionalInfo: (() => {
          const info = { ...getTemplate(defaultCode || "", pageType) };
          const code = (defaultCode || "").trim().toLowerCase();
          const isSpecialComp = ['fd', 'an', 'cs', 'cl', 'cd', 'fa', 'hd', 'hm', 'vd', 'vm', 'hs', 'pl', 'pg', 'bb', 'sg', 'cu', 'cf', 'it', 'lg', 'wn', 'wp', 'rs', 'rg', 'rb', 'ct', 'gp', 'gs', 'bl', 'fv', 'ce', 'sd', 'yp'].includes(code || '');

          if (isSpecialComp) {
            if (code === 'ct') {
              delete info.id_chk;
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
            } else if (['fd', 'an', 'cs', 'cl', 'fa', 'hs', 'fv'].includes(code || '')) {
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
              delete info.id_chk;
            } else if (code === 'cf') {
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
              delete info.id_chk;
              delete info.thetype;
              delete info.attach_method;
              delete info.top_und;
              delete info.comp_group;
            } else if (code === 'it') {
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
              delete info.x_cord;
              delete info.y_cord;
              delete info.fp;
            } else if (code === 'cd' || ['hd', 'hm', 'vd', 'vm'].includes(code || '')) {
              delete info.depth;
              delete info.diameter;
              delete info.id_chk;
              info.wall_thk = "";
            } else if (code === 'pl') {
              delete info.id_chk;
            } else if (code === 'pg') {
              delete info.wall_thk;
              delete info.depth;
              delete info.id_chk;
              delete info.thetype;
              delete info.pile;
              delete info.weight;
              delete info.no_undattach;
              delete info.no_topattach;
            } else if (code === 'bb') {
              delete info.wall_thk;
              delete info.depth;
              delete info.id_chk;
              delete info.thetype;
            } else if (code === 'sg' || code === 'cu') {
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
              delete info.no_risers;
              delete info.riser_wt;
              delete info.id_chk;
              delete info.risg_typ;
            } else if (code === 'wn') {
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
              delete info.id_chk;
              delete info.weld_confg;
              delete info.weld_type;
              delete info.desg_code;
              delete info.material;
            } else if (code === 'wp') {
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
              delete info.weld_confg;
              delete info.weld_type;
              delete info.thetype;
              delete info.desg_code;
              delete info.material;
              delete info.id_chk;
            } else if (code === 'rs') {
              delete info.thetype;
              delete info.material;
              delete info.coating;
              delete info.flange_rating;
              delete info.id_chk;
              delete info.assoc_str;
              delete info.depth;
            } else if (code === 'rg') {
              delete info.thetype;
              delete info.riser_wt;
              delete info.id_chk;
              delete info.wall_thk;
              delete info.diameter;
            } else if (code === 'rb') {
              delete info.thetype;
              delete info.id_chk;
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
            } else if (code === 'gs') {
              delete info.wall_thk;
            } else if (code === 'gp') {
              delete info.wall_thk;
              delete info.diameter;
              delete info.depth;
              delete info.qid_member_attached;
            } else if (code === 'bl') {
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
              delete info.thetype;
              delete info.id_chk;
              delete info.width;
            } else if (code === 'fv') {
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
            } else if (code === 'ce') {
              delete info.wall_thk;
              delete info.id_chk;
            } else if (code === 'yp') {
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
            } else if (code === 'sd') {
              delete info.wall_thk;
              delete info.depth;
              delete info.diameter;
              delete info.id_chk;
              delete info.dist_leg;
              delete info.stub_mat;
            }
          } else {
            info.wall_thk = "";
            info.depth = "";
            info.diameter = "";
          }

          if (info.electrically_cont !== undefined) {
            info.electrically_cont = info.electrically_cont === true || info.electrically_cont === "true";
          }

          return info;
        })(),
      }));
    }
  }, [isCreateMode, component, defaultCode, pageType]);
  const handleInputChange = (field: string, value: string) => {
    if (isCreateMode || isEditMode) {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleAdditionalInfoChange = (field: string, value: any) => {
    if (isCreateMode || isEditMode) {
      setFormData(prev => ({
        ...prev,
        additionalInfo: {
          ...prev.additionalInfo,
          [field]: value
        }
      }));
    }
  };

  const handleSave = async () => {
    if (!isCreateMode) return;

    const id_no = buildIdNo(
      formData.code || defaultCode || "",
      formData.s_node,
      formData.f_node,
      formData.dist,
      formData.clk_pos
    );

    if (!id_no) {
      toast("ID No is invalid. Please ensure component type is selected.");
      return;
    }

    setIsSaving(true);
    try {
      // Prepare metadata object from form fields
      const metadata = {
        description: formData.description,
        s_node: formData.s_node,
        f_node: formData.f_node,
        s_leg: formData.s_leg,
        f_leg: formData.f_leg,
        dist: formData.dist,
        dist_unit: formData.dist_unit,
        elv_1: formData.elv_1,
        elv_1_unit: formData.elv_1_unit,
        elv_2: formData.elv_2,
        elv_2_unit: formData.elv_2_unit,
        clk_pos: formData.clk_pos,
        lvl: formData.lvl,
        face: formData.face,
        top_und: formData.top_und,
        comp_group: formData.comp_group,
        associated_comp_id: formData.associated_comp_id,
        kp: formData.kp,
        kp_unit: formData.kp_unit,
        easting: formData.easting,
        easting_unit: formData.easting_unit,
        northing: formData.northing,
        northing_unit: formData.northing_unit,
        depth: formData.depth,
        depth_unit: formData.depth_unit,
        additionalInfo: formData.additionalInfo,
        created_from: createdFrom || undefined,
      };

      // Prepare the component data for create
      const componentData = {
        id_no,
        q_id: formData.q_id,
        comp_id: 0,
        structure_id: structureId,
        code: formData.code || defaultCode,
        metadata: metadata,
      };

      // Post to API
      await fetcher(`/api/structure-components/${structureId}`, {
        method: "POST",
        body: JSON.stringify(componentData),
      });

      // Refresh the components list
      if (listKey) {
        mutate(listKey);
      } else {
        mutate(`/api/structure-components/${structureId}`);
      }

      toast("Component created successfully");
      onOpenChange(false);

      // Reset form after create
      const cleanTemplate = getTemplate(defaultCode || "", pageType);
      setFormData({
        q_id: "",
        id_no: "",
        code: defaultCode || "",
        description: "",
        s_node: "",
        f_node: "",
        s_leg: "",
        f_leg: "",
        dist: "",
        dist_unit: "m",
        elv_1: "",
        elv_1_unit: "m",
        elv_2: "",
        elv_2_unit: "m",
        clk_pos: "",
        lvl: "",
        face: "",
        top_und: "",
        comp_group: "",
        associated_comp_id: null,
        kp: "",
        kp_unit: "km",
        easting: "",
        easting_unit: "m",
        northing: "",
        northing_unit: "m",
        depth: "",
        depth_unit: "m",
        additionalInfo: cleanTemplate,
      });
    } catch (error) {
      console.error("Error creating component:", error);
      toast("Failed to create component");
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch comments for this component (only in view mode)
  // Always call useSWR, but with null key when not needed to avoid conditional hooks
  const { data: commentsData, error: commentsError, isLoading: commentsLoading } = useSWR(
    component && !isCreateMode && component.id ? `/api/comment/component/${component.id}` : null,
    fetcher
  );

  // Fetch attachments for this component (only in view mode)
  const { data: attachmentsData, error: attachmentsError, isLoading: attachmentsLoading } = useSWR(
    component && !isCreateMode && component.id ? `/api/attachment/component/${component.id}` : null,
    fetcher
  );

  // Note: always render Dialog so Radix can fully clean up its portal/overlay
  // even when there is no selected component.

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl max-h-[95vh] flex flex-col">
        <DialogHeader className="p-8 bg-slate-50/50 dark:bg-slate-900/50 border-b relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Wrench className="h-24 w-24 -rotate-12" />
          </div>
          <div className="flex items-center gap-4 mb-2">
            <div className="h-12 w-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Wrench className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                {isCreateMode ? "Create New Component" : (isEditMode ? "Edit Component" : "Component Specifications")}
              </DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex flex-col gap-1">
                {isCreateMode ? (
                  <>
                    <span>Configure specifications for the new component</span>
                    {typeName && (
                      <span className="text-blue-600 dark:text-blue-400 font-black mt-1">
                        {typeName}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-2 mt-1">
                      <span className="text-blue-600 font-black text-sm uppercase">
                        {typeName || component?.id_no}
                      </span>
                      {component?.updated_at && (
                        <>
                          <span className="opacity-20 text-slate-400">|</span>
                          <span>Updated: {new Date(component.updated_at).toLocaleDateString()}</span>
                        </>
                      )}
                    </span>
                  </>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-8 pt-6">
          <Tabs defaultValue="specifications" className="w-full">
            <TabsList className={`grid w-full mb-8 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-2xl ${isCreateMode ? 'grid-cols-1' : 'grid-cols-4 h-12'}`}>
              <TabsTrigger value="specifications" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm">Specifications</TabsTrigger>
              {!isCreateMode && (
                <>
                  <TabsTrigger value="specifications2" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm">Association</TabsTrigger>
                  <TabsTrigger value="comments" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm">Comments</TabsTrigger>
                  <TabsTrigger value="attachments" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm">Attachments</TabsTrigger>
                </>
              )}
            </TabsList>

            {/* Specifications Tab */}
            <TabsContent value="specifications" className="space-y-8 mt-0 outline-none">
              <div className="grid grid-cols-12 gap-6 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 rounded-[1.5rem] p-8">
                {/* Row 1: Q ID, Code */}
                <div className="col-span-10 space-y-2">
                  <Label htmlFor="qId" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Q Id</Label>
                  <Input
                    id="qId"
                    className="rounded-xl border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 bg-white dark:bg-slate-950 font-bold h-11"
                    value={isCreateMode || isEditMode ? formData.q_id : (component?.q_id || "")}
                    onChange={(e) => handleInputChange("q_id", e.target.value)}
                    readOnly={!(isCreateMode || isEditMode)}
                  />
                  <p className="text-[10px] font-mono font-bold text-slate-400 ml-1">
                    ID No: {
                      isCreateMode
                        ? (buildIdNo(
                          formData.code || defaultCode || "",
                          formData.s_node,
                          formData.f_node,
                          formData.dist,
                          formData.clk_pos
                        ) || "-")
                        : (component?.id_no || "-")
                    }
                  </p>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="code" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Code</Label>
                  <Input id="code" className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/20 text-center font-black h-11" value={isCreateMode ? formData.code : (defaultCode || component?.code || "")} readOnly />
                </div>

                {/* Row 2: Description */}
                <div className="col-span-12 space-y-2">
                  <Label htmlFor="description" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Description</Label>
                  <Input
                    id="description"
                    className="rounded-xl border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 bg-white dark:bg-slate-950 h-11"
                    value={isCreateMode || isEditMode ? formData.description : (component?.metadata?.description ?? "")}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    readOnly={!(isCreateMode || isEditMode)}
                  />
                </div>

                {/* Platform Specific Fields */}
                {pageType === "platform" && (
                  <>
                    {/* Row 4: Start Node, End Node */}
                    <div className="col-span-6 space-y-2 text-blue-600">
                      <Label htmlFor="sNode" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Start Node</Label>
                      <Input
                        id="sNode"
                        className="rounded-xl border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 bg-white dark:bg-slate-950 font-bold h-11"
                        value={isCreateMode || isEditMode ? formData.s_node : (component?.metadata?.s_node ?? "")}
                        onChange={(e) => handleInputChange("s_node", e.target.value)}
                        readOnly={!(isCreateMode || isEditMode)}
                      />
                    </div>
                    <div className="col-span-6 space-y-2">
                      <Label htmlFor="eNode" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">End Node</Label>
                      <Input
                        id="eNode"
                        className="rounded-xl border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 bg-white dark:bg-slate-950 font-bold h-11"
                        value={isCreateMode || isEditMode ? formData.f_node : (component?.metadata?.f_node ?? "")}
                        onChange={(e) => handleInputChange("f_node", e.target.value)}
                        readOnly={!(isCreateMode || isEditMode)}
                      />
                    </div>

                    {/* Row 5: Start Leg, End Leg, Distance */}
                    <div className="col-span-4 space-y-2">
                      <Label htmlFor="sLeg" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Start Leg</Label>
                      <Select
                        value={isCreateMode ? formData.s_leg : (component?.metadata?.s_leg ?? "")}
                        onValueChange={(val) => handleInputChange("s_leg", val)}
                        disabled={!isCreateMode || legOptions.length === 0}
                      >
                        <SelectTrigger id="sLeg" className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 h-11 font-bold">
                          <SelectValue placeholder="Select start leg" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {legOptions.map((opt: any) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-4 space-y-2">
                      <Label htmlFor="eLeg" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">End Leg</Label>
                      <Select
                        value={isCreateMode ? formData.f_leg : (component?.metadata?.f_leg ?? "")}
                        onValueChange={(val) => handleInputChange("f_leg", val)}
                        disabled={!isCreateMode || legOptions.length === 0}
                      >
                        <SelectTrigger id="eLeg" className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 h-11 font-bold">
                          <SelectValue placeholder="Select end leg" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {legOptions.map((opt: any) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                <div className="col-span-4 space-y-2">
                  <Label htmlFor="distance" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Distance</Label>
                  <div className="relative">
                    <Input
                      id="distance"
                      className="rounded-xl border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 bg-white dark:bg-slate-950 font-bold h-11 pr-20"
                      value={isCreateMode || isEditMode ? formData.dist : (component?.metadata?.dist ?? "")}
                      onChange={(e) => handleInputChange("dist", e.target.value)}
                      readOnly={!(isCreateMode || isEditMode)}
                    />
                    <div className="absolute right-0 top-0 h-full flex items-center pr-1.5 pt-0.5">
                      <Select
                        value={isCreateMode || isEditMode ? formData.dist_unit : (component?.metadata?.dist_unit ?? "m")}
                        onValueChange={(val) => handleInputChange("dist_unit", val)}
                        disabled={!(isCreateMode || isEditMode)}
                      >
                        <SelectTrigger className="h-8 w-[68px] bg-slate-50 dark:bg-slate-900 border-none focus:ring-0 text-[10px] font-black rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {platformData?.data?.def_unit === "IMPERIAL" ? (
                            <>
                              <SelectItem value="inches">inches</SelectItem>
                              <SelectItem value="feet">feet</SelectItem>
                              <SelectItem value="m">m</SelectItem>
                              <SelectItem value="cm">cm</SelectItem>
                              <SelectItem value="mm">mm</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="m">m</SelectItem>
                              <SelectItem value="cm">cm</SelectItem>
                              <SelectItem value="mm">mm</SelectItem>
                              <SelectItem value="inches">inches</SelectItem>
                              <SelectItem value="feet">feet</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Row 6: Elevation 1, Elevation 2, Clock Position */}
                <div className="col-span-4 space-y-2">
                  <Label htmlFor="elevation1" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Elevation 1</Label>
                  <div className="relative">
                    <Input
                      id="elevation1"
                      className="rounded-xl border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 bg-white dark:bg-slate-950 font-bold h-11 pr-20"
                      value={isCreateMode || isEditMode ? formData.elv_1 : (component?.metadata?.elv_1 ?? "")}
                      onChange={(e) => handleInputChange("elv_1", e.target.value)}
                      readOnly={!(isCreateMode || isEditMode)}
                    />
                    <div className="absolute right-0 top-0 h-full flex items-center pr-1.5 pt-0.5">
                      <Select
                        value={isCreateMode || isEditMode ? formData.elv_1_unit : (component?.metadata?.elv_1_unit ?? "m")}
                        onValueChange={(val) => handleInputChange("elv_1_unit", val)}
                        disabled={!(isCreateMode || isEditMode)}
                      >
                        <SelectTrigger className="h-8 w-[68px] bg-slate-50 dark:bg-slate-900 border-none focus:ring-0 text-[10px] font-black rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {platformData?.data?.def_unit === "IMPERIAL" ? (
                            <>
                              <SelectItem value="inches">inches</SelectItem>
                              <SelectItem value="feet">feet</SelectItem>
                              <SelectItem value="m">m</SelectItem>
                              <SelectItem value="cm">cm</SelectItem>
                              <SelectItem value="mm">mm</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="m">m</SelectItem>
                              <SelectItem value="cm">cm</SelectItem>
                              <SelectItem value="mm">mm</SelectItem>
                              <SelectItem value="inches">inches</SelectItem>
                              <SelectItem value="feet">feet</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="col-span-4 space-y-2">
                  <Label htmlFor="elevation2" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Elevation 2</Label>
                  <div className="relative">
                    <Input
                      id="elevation2"
                      className="rounded-xl border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 bg-white dark:bg-slate-950 font-bold h-11 pr-20"
                      value={isCreateMode || isEditMode ? formData.elv_2 : (component?.metadata?.elv_2 ?? "")}
                      onChange={(e) => handleInputChange("elv_2", e.target.value)}
                      readOnly={!(isCreateMode || isEditMode)}
                    />
                    <div className="absolute right-0 top-0 h-full flex items-center pr-1.5 pt-0.5">
                      <Select
                        value={isCreateMode || isEditMode ? formData.elv_2_unit : (component?.metadata?.elv_2_unit ?? "m")}
                        onValueChange={(val) => handleInputChange("elv_2_unit", val)}
                        disabled={!(isCreateMode || isEditMode)}
                      >
                        <SelectTrigger className="h-8 w-[68px] bg-slate-50 dark:bg-slate-900 border-none focus:ring-0 text-[10px] font-black rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {platformData?.data?.def_unit === "IMPERIAL" ? (
                            <>
                              <SelectItem value="inches">inches</SelectItem>
                              <SelectItem value="feet">feet</SelectItem>
                              <SelectItem value="m">m</SelectItem>
                              <SelectItem value="cm">cm</SelectItem>
                              <SelectItem value="mm">mm</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="m">m</SelectItem>
                              <SelectItem value="cm">cm</SelectItem>
                              <SelectItem value="mm">mm</SelectItem>
                              <SelectItem value="inches">inches</SelectItem>
                              <SelectItem value="feet">feet</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="col-span-4 space-y-2">
                  <Label htmlFor="clockPos" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Clock Position</Label>
                  <Select
                    value={
                      (isCreateMode || isEditMode)
                        ? formData.clk_pos
                        : (component?.metadata?.clk_pos ?? "")
                    }
                    onValueChange={(val) => handleInputChange("clk_pos", val)}
                    disabled={!isCreateMode || !positionLib}
                  >
                    <SelectTrigger id="clockPos" className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 h-11 font-bold">
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {positionLib?.data
                        ?.filter((x: any) => x.lib_code === "POSITION")
                        .map((x: any) => (
                          <SelectItem key={x.lib_id} value={String(x.lib_id)}>
                            {x.lib_id}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Row 7: Level, Face, Part */}
                <div className="col-span-4 space-y-2">
                  <Label htmlFor="level" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Level</Label>
                  <Select
                    value={isCreateMode || isEditMode ? formData.lvl : (component?.metadata?.lvl ?? "")}
                    onValueChange={(val) => handleInputChange("lvl", val)}
                    disabled={!(isCreateMode || isEditMode) || levelOptions.length === 0}
                  >
                    <SelectTrigger id="level" className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 h-11 font-bold">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {levelOptions.map((opt: any) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 space-y-2">
                  <Label htmlFor="face" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Face</Label>
                  <Select
                    value={isCreateMode || isEditMode ? formData.face : (component?.metadata?.face ?? "")}
                    onValueChange={(val) => handleInputChange("face", val)}
                    disabled={!(isCreateMode || isEditMode) || faceOptions.length === 0}
                  >
                    <SelectTrigger id="face" className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 h-11 font-bold">
                      <SelectValue placeholder="Select face" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {faceOptions.map((opt: any) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 space-y-2">
                  <Label htmlFor="part" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Part</Label>
                  <Select
                    value={
                      (isCreateMode || isEditMode)
                        ? formData.top_und
                        : (component?.metadata?.top_und ?? "")
                    }
                    onValueChange={(val) => handleInputChange("top_und", val)}
                    disabled={!isCreateMode}
                  >
                    <SelectTrigger id="part" className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 h-11 font-bold">
                      <SelectValue placeholder="Select part" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="TOPSIDE">TOPSIDE</SelectItem>
                      <SelectItem value="SUBSEA">SUBSEA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Row 8: Structural Group (full width) */}
                <div className="col-span-12 space-y-2">
                  <Label htmlFor="structuralGroup" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Structural Group</Label>
                  <Select
                    value={
                      (isCreateMode || isEditMode)
                        ? formData.comp_group
                        : (component?.metadata?.comp_group ?? "")
                    }
                    onValueChange={(val) => handleInputChange("comp_group", val)}
                    disabled={!isCreateMode || !compGroupLib}
                  >
                    <SelectTrigger id="structuralGroup" className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 h-12 font-bold">
                      <SelectValue placeholder="Select structural group" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {compGroupLib?.data
                        ?.filter((x: any) => x.lib_code === "COMPGRP")
                        .map((x: any) => (
                          <SelectItem key={x.lib_id} value={String(x.lib_id)}>
                            {x.lib_desc}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Pipeline Specific Fields */}
            {pageType === "pipeline" && (
              <>
                <div className="col-span-6 space-y-2">
                  <Label htmlFor="kp" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">KP</Label>
                  <div className="relative">
                    <Input
                      id="kp"
                      className="rounded-xl border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 bg-white dark:bg-slate-950 font-bold h-11 pr-20"
                      value={isCreateMode || isEditMode ? formData.kp : (component?.metadata?.kp ?? "")}
                      onChange={(e) => handleInputChange("kp", e.target.value)}
                      readOnly={!(isCreateMode || isEditMode)}
                    />
                    <div className="absolute right-0 top-0 h-full flex items-center pr-1.5 pt-0.5">
                      <Select
                        value={isCreateMode || isEditMode ? formData.kp_unit : (component?.metadata?.kp_unit ?? "km")}
                        onValueChange={(val) => handleInputChange("kp_unit", val)}
                        disabled={!(isCreateMode || isEditMode)}
                      >
                        <SelectTrigger className="h-8 w-[68px] bg-slate-50 dark:bg-slate-900 border-none focus:ring-0 text-[10px] font-black rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="km">km</SelectItem>
                          <SelectItem value="m">m</SelectItem>
                          <SelectItem value="mile">mile</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="col-span-6 space-y-2">
                  <Label htmlFor="depth" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Depth</Label>
                  <div className="relative">
                    <Input
                      id="depth"
                      className="rounded-xl border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 bg-white dark:bg-slate-950 font-bold h-11 pr-20"
                      value={isCreateMode || isEditMode ? formData.depth : (component?.metadata?.depth ?? "")}
                      onChange={(e) => handleInputChange("depth", e.target.value)}
                      readOnly={!(isCreateMode || isEditMode)}
                    />
                    <div className="absolute right-0 top-0 h-full flex items-center pr-1.5 pt-0.5">
                      <Select
                        value={isCreateMode || isEditMode ? formData.depth_unit : (component?.metadata?.depth_unit ?? "m")}
                        onValueChange={(val) => handleInputChange("depth_unit", val)}
                        disabled={!(isCreateMode || isEditMode)}
                      >
                        <SelectTrigger className="h-8 w-[68px] bg-slate-50 dark:bg-slate-900 border-none focus:ring-0 text-[10px] font-black rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="m">m</SelectItem>
                          <SelectItem value="cm">cm</SelectItem>
                          <SelectItem value="ft">ft</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="col-span-6 space-y-2">
                  <Label htmlFor="easting" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Easting</Label>
                  <div className="relative">
                    <Input
                      id="easting"
                      className="rounded-xl border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 bg-white dark:bg-slate-950 font-bold h-11 pr-20"
                      value={isCreateMode || isEditMode ? formData.easting : (component?.metadata?.easting ?? "")}
                      onChange={(e) => handleInputChange("easting", e.target.value)}
                      readOnly={!(isCreateMode || isEditMode)}
                    />
                    <div className="absolute right-0 top-0 h-full flex items-center pr-1.5 pt-0.5">
                      <Select
                        value={isCreateMode || isEditMode ? formData.easting_unit : (component?.metadata?.easting_unit ?? "m")}
                        onValueChange={(val) => handleInputChange("easting_unit", val)}
                        disabled={!(isCreateMode || isEditMode)}
                      >
                        <SelectTrigger className="h-8 w-[68px] bg-slate-50 dark:bg-slate-900 border-none focus:ring-0 text-[10px] font-black rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="m">m</SelectItem>
                          <SelectItem value="km">km</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="col-span-6 space-y-2">
                  <Label htmlFor="northing" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Northing</Label>
                  <div className="relative">
                    <Input
                      id="northing"
                      className="rounded-xl border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 bg-white dark:bg-slate-950 font-bold h-11 pr-20"
                      value={isCreateMode || isEditMode ? formData.northing : (component?.metadata?.northing ?? "")}
                      onChange={(e) => handleInputChange("northing", e.target.value)}
                      readOnly={!(isCreateMode || isEditMode)}
                    />
                    <div className="absolute right-0 top-0 h-full flex items-center pr-1.5 pt-0.5">
                      <Select
                        value={isCreateMode || isEditMode ? formData.northing_unit : (component?.metadata?.northing_unit ?? "m")}
                        onValueChange={(val) => handleInputChange("northing_unit", val)}
                        disabled={!(isCreateMode || isEditMode)}
                      >
                        <SelectTrigger className="h-8 w-[68px] bg-slate-50 dark:bg-slate-900 border-none focus:ring-0 text-[10px] font-black rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="m">m</SelectItem>
                          <SelectItem value="km">km</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </>
            )}

                {/* Dynamic Additional Details */}
                {Object.keys(formData.additionalInfo).length > 0 ? (
                  <div className="col-span-12 pt-8 border-t border-slate-200/60 dark:border-slate-800/60 space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <Settings2 className="h-4 w-4 text-slate-500" />
                      </div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Additional Specifications</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-x-12 gap-y-6 px-1">
                      {Object.entries(formData.additionalInfo)
                        .sort(([a], [b]) => {
                          if (a === 'has_gas_seepage') return 1;
                          if (b === 'has_gas_seepage') return -1;
                          return 0;
                        })
                        .map(([key, value]) => {
                        if (key === 'del') return null;
                        if (key === 'length_unit' || key === 'diameter_unit') return null;

                        let label = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                        const lowerCode = (formData.code || defaultCode || component?.code || "").trim().toLowerCase();

                        if (key === 'wall_thk') label = lowerCode === 'cl' ? "Attach Stub Length" : "Wall Thickness";
                        if (key === 'fender_type') label = "Boat Fender Types";
                        if (key === 'no_subsea') label = "No. Subsea Attachments";
                        if (key === 'no_topside') label = "No. Topside Attachments";
                        if (key === 'no_undattach') label = lowerCode === 'bb' ? "No. Subsea Attach." : "No Undattach";
                        if (key === 'no_topattach') label = lowerCode === 'bb' ? "No. Topside Attach." : "No Topattach";
                        if (key === 'type' && lowerCode === 'an') label = "Installed Type";
                        if (key === 'thetype' && lowerCode === 'an') label = "Anode Types";
                        if (key === 'position' && lowerCode === 'an') label = "Anode Position";
                        if (key === 'material' && lowerCode === 'an') label = "Anode Material Types";
                        if (key === 'fitting' && lowerCode === 'an') label = "Anode Fitting Types";
                        if (key === 'termination_p' && lowerCode === 'cs') label = "Termination Depth";
                        if (key === 'injection_line' && lowerCode === 'cs') label = "Injection Line Fitted";
                        if (key === 'bumper_type') label = "Boat Bumper Types";
                        if (key === 'nc_wall_thk') label = "node can wall thickness";
                        if (key === 'memb_wall_thk') label = "member wall thickness";
                        if (key === 'node_diam') label = "node diameter";
                        if (key === 'memb_diam') label = "member diameter";
                        if (key === 'supp_wt') label = "support wall thickness";
                        if (key === 'memb_wt') label = "member wall thickness";
                        if (key === 'supp_diam') label = "support diameter";
                        if (key === 'csum_typ') label = 'Caisson Type';
                        if (key === 'cais_at') label = 'Caisson Attachment Type';
                        if (key === 'corr_ctg') label = 'Corrosion Coating Type';
                        if (key === 'clam_typ') label = 'Clamp Types';
                        if (key === 'clam_mat') label = 'Clamp Materials';
                        if (key === 'liner_reqd') label = 'Liner Required';
                        if (key === 'bolt_diam') label = 'Bolt Diameter';
                        if (key === 'out_diam') label = 'Outside Diameter';
                        if (key === 'in_diam') label = 'Inside Diameter';
                        if (key === 'coat_typ') label = 'Coating Type';
                        if (key === 'cgud_typ') label = 'Conductor Guide Frame Types';
                        if (key === 'fitg_typ') label = 'Fitting Type';
                        if (key === 'no_caissons') label = 'No. Protected Caissons';
                        if (key === 'no_conductors') label = 'No. Protected Conductor';

                        if (key === 'easting') label = 'Easting';
                        if (key === 'northing') label = 'Northing';
                        if (key === 'equipment') label = 'Equipment';
                        if (key === 'location_no') label = 'Location No.';

                        if (key === 'int_stiff') label = 'Internal Stiffening';
                        if (key === 'ext_stiff') label = 'External Stiffening';

                        if (key === 'nominal_diam') label = 'Nominal Diameter';
                        if (key === 'purch_date') label = 'Purchase Date';
                        if (key === 'electrically_cont') label = 'Electrically Continuous';
                        if (key === 'pile_typ') label = 'Pile Types';
                        if (key === 'pile_mat') label = 'Pile Materials';
                        if (key === 'pgud_typ') label = 'Pile Guide Frame Types';
                        if (key === 'pgud_mat') label = 'Pile Guide Materials';
                        if (key === 'pgud_fas') label = 'Pile Guide Attachment Methods';
                        if (key === 'pile_present') label = 'Pile Present in Guide Frame';
                        if (key === 'thetype' && (lowerCode === 'hd' || lowerCode === 'hm' || lowerCode === 'vd' || lowerCode === 'vm' || lowerCode === 'sg' || lowerCode === 'cu')) label = 'Type';

                        if (key === 'ctry_typ') label = 'Cable Tray Type';
                        if (key === 'ctry_pos') label = 'Cable Tray Position';
                        if (key === 'ctry_mat') label = 'Cable Tray Material';
                        if (key === 'ctry_fas') label = 'Cable Tray Attachment';
                        if (key === 'face_pos') label = 'Face Orientation/Position';
                        if (key === 'memb_mat') label = 'Member Material';
                        if (key === 'corr_ctg') label = 'Corrosion Coating Type';
                        if (key === 'hose_typ') label = 'Hose Types';
                        if (key === 'hose_man') label = 'Hose (all Hose types) Manuf.';
                        if (key === 'flan_cls') label = 'Flange Classes';
                        if (key === 'hose_cnt') label = 'Hose Contents';
                        if (key === 'weld_typ') label = 'Weld Types';
                        if (key === 'weld_des') label = 'Weld Design Code';
                        if (key === 'weld_mat') label = 'Weld Materials';
                        if (key === 'weld_cfg') label = 'Weld Configurations';
                        if (key === 'risr_typ') label = 'Riser Type';
                        if (key === 'risr_mat') label = 'Pipeline End/Riser Material';
                        if (key === 'pipe_rtg') label = 'Pipeline/Riser/Clamp Rating';
                        if (key === 'risg_typ') label = 'Riser Guard Types';
                        if (key === 'risb_typ') label = 'Support Beam Types';
                        if (key === 'stub_mat') label = 'Conical Stub Material';
                        if (key === 'wsup_typ') label = 'Weld-Supported Component Types';
                        if (key === 'desg_press') label = 'design pressure';
                        if (key === 'op_press') label = 'op. pressure';
                        if (key === 'no_risers' && lowerCode === 'rg') label = 'no. protected risers';
                        if (key === 'no_riserslots' && lowerCode === 'rb') label = 'no. riser slots';
                        if (key === 'no_suppbackets' && lowerCode === 'rb') label = 'no. support brackets';
                        if (key === 'has_gas_seepage') label = 'Has Gas Seepage?';
                        if (key === 'easting') label = 'Easting';
                        if (key === 'northing') label = 'Northing';
                        if (key === 'mgp_no') label = 'MGP No.';
                        if (key === 'boatlanding_types') label = 'Boatlanding Types';
                        if (key === 'valve_status') label = 'Status of the Valve';
                        if (key === 'dist_from_legs') label = 'dist. from legs';

                        let unit: string | null = null;
                        let unitOptions: string[] = [];
                        const k = key.toLowerCase();
                        const isImp = isImperial;

                        // Get category from config
                        const componentConfig = specUiConfig.components.find(c => c.code.toLowerCase() === lowerCode);
                        const fieldConfig = componentConfig?.fields.find(f => f.name === key);
                        const category = fieldConfig?.unitcategory || null;

                        // Fallback logic if category is missing in config
                        const resolvedCategory = category || (k.includes('weight') || k.includes('wt') ? 'weight' : (k.includes('length') || k.includes('width') || k.includes('diameter') || k.includes('depth') || k.includes('dim') ? 'length' : null));

                        const options = getUnitOptions(resolvedCategory, isImp);
                        if (options) {
                          unitOptions = options;
                          unit = formData.additionalInfo[`${key}_unit`] || getDefaultUnit(resolvedCategory, isImp, key, lowerCode);
                        } else {
                          // Special cases for fields without a direct category in config
                          if (key === 'angle' && lowerCode === 'yp') { unit = "deg."; unitOptions = ["deg."]; }
                          else if (key === 'life' && lowerCode === 'an') { unit = "years"; unitOptions = ["years"]; }
                          else if ((key === 'desg_press' || key === 'op_press') && lowerCode === 'rs') { unit = "bars"; unitOptions = ["bars", "psi"]; }
                          else {
                            // Default fallback - no unit
                            unit = null;
                            unitOptions = [];
                          }
                        }

                        // Override with existing unit if available
                        if (formData.additionalInfo[`${key}_unit`]) {
                          unit = formData.additionalInfo[`${key}_unit`];
                          if (unit && !unitOptions.includes(unit)) unitOptions.push(unit);
                        }

                        // Render dropdowns
                        const renderSelect = (id: string, placeholder: string, data: any) => (
                          <div key={key} className="space-y-2">
                            <Label htmlFor={id} className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{label}</Label>
                            <Select
                              value={value || ""}
                              onValueChange={(val) => handleAdditionalInfoChange(key, val)}
                              disabled={!(isCreateMode || isEditMode) || !data}
                            >
                              <SelectTrigger id={id} className="h-11 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold">
                                <SelectValue placeholder={placeholder} />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {data?.data?.map((x: any) => (
                                  <SelectItem key={x.lib_id} value={String(x.lib_id)}>
                                    {x.lib_desc}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );

                        if (key === 'fender_type' && lowerCode === 'fd') return renderSelect(key, "Select boat fender type", fenderTypeData);
                        if (key === 'bumper_type' && lowerCode === 'bb') return renderSelect(key, "Select boat bumper type", bumperTypeData);
                        if (key === 'boatlanding_types' && lowerCode === 'bl') return renderSelect(key, "Select boatlanding type", fenderTypeData);
                        if (key === 'valve_status' && lowerCode === 'fv') return (
                          <div key={key} className="space-y-2">
                            <Label htmlFor={key} className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Status of the Valve</Label>
                            <Select
                              value={value || ""}
                              onValueChange={(val) => handleAdditionalInfoChange(key, val)}
                              disabled={!(isCreateMode || isEditMode)}
                            >
                              <SelectTrigger id={key} className="h-11 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold">
                                <SelectValue placeholder="Select valve status" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="Open">Open</SelectItem>
                                <SelectItem value="Close">Close</SelectItem>
                                <SelectItem value="Unable to verify">Unable to verify</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        );
                        if (key === 'csum_typ' && lowerCode === 'cs') return renderSelect(key, "Select caisson type", csumTypeData);
                        if (key === 'cais_at' && lowerCode === 'cs') return renderSelect(key, "Select attachment type", caisAtData);
                        if (key === 'pile_typ' && lowerCode === 'pl') return renderSelect(key, "Select pile type", pileTypeData);
                        if (key === 'pile_mat' && lowerCode === 'pl') return renderSelect(key, "Select pile material", pileMatData);
                        if (key === 'thetype' && lowerCode === 'an') return renderSelect(key, "Select anode type", anodeTypeData);
                        if (key === 'position' && lowerCode === 'an') return renderSelect(key, "Select anode position", positionLib);
                        if (key === 'material' && lowerCode === 'an') return renderSelect(key, "Select anode material type", anodeMatData);
                        if (key === 'fitting' && lowerCode === 'an') return renderSelect(key, "Select anode fitting type", anodeFitData);

                        if (['pgud_typ', 'pgud_mat', 'pgud_fas'].includes(key) && lowerCode === 'pg') {
                          const dataMap: Record<string, { data: any, placeholder: string }> = {
                            pgud_typ: { data: pgudTypData, placeholder: "Select guide type" },
                            pgud_mat: { data: pgudMatData, placeholder: "Select guide material" },
                            pgud_fas: { data: pgudFasData, placeholder: "Select attachment method" }
                          };
                          const { data, placeholder } = dataMap[key];
                          return (
                            <div key={key} className="space-y-2">
                              <Label htmlFor={key} className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{label}</Label>
                              <Select
                                value={value || ""}
                                onValueChange={(val) => handleAdditionalInfoChange(key, val)}
                                disabled={!(isCreateMode || isEditMode) || !data}
                              >
                                <SelectTrigger id={key} className="h-11 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold">
                                  <SelectValue placeholder={placeholder} />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  {data?.data?.map((x: any) => (
                                    <SelectItem key={x.lib_id} value={String(x.lib_id)}>
                                      {x.lib_name || x.lib_desc}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        }
                        if (key === 'corr_ctg' && (lowerCode === 'cs' || lowerCode === 'hd' || lowerCode === 'vd' || lowerCode === 'vm' || lowerCode === 'hm' || lowerCode === 'rs')) return renderSelect(key, "Select coating type", corrCtgData);
                        if (key === 'clam_typ' && lowerCode === 'cl') return renderSelect(key, "Select clamp type", clamTypeData);
                        if (key === 'clam_mat' && lowerCode === 'cl') return renderSelect(key, "Select clamp material", clamMatData);
                        if (key === 'coat_typ' && lowerCode === 'cd') return renderSelect(key, "Select coating type", coatTypData);
                        if (key === 'cgud_typ' && lowerCode === 'cf') return renderSelect(key, "Select guide type", cgudTypData);
                        if (key === 'fitg_typ' && lowerCode === 'cf') return renderSelect(key, "Select fitting type", fitgTypData);
                        if (key === 'sgud_typ' && lowerCode === 'sg') return renderSelect(key, "Select guard type", sgudTypData);
                        if (key === 'memb_mat' && ['hd', 'hm', 'vd', 'vm'].includes(lowerCode)) return renderSelect(key, "Select member material", stdMembMatData);
                        if (key === 'memb_mat' && lowerCode === 'lg') return (
                          <div key={key} className="space-y-2">
                            <Label htmlFor={key} className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{label}</Label>
                            <Select
                              value={value || ""}
                              onValueChange={(val) => handleAdditionalInfoChange(key, val)}
                              disabled={!(isCreateMode || isEditMode) || !membMatData}
                            >
                              <SelectTrigger id={key} className="h-11 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold">
                                <SelectValue placeholder="Select member material" />
                              </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  {membMatData?.data?.map((x: any, index: number) => (
                                    <SelectItem key={x.lib_id || x.lib_name || String(index)} value={x.lib_name}>
                                      {x.lib_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                            </Select>
                          </div>
                        );
                        if (key === 'nominal_diam' && lowerCode === 'an') return renderSelect(key, "Select diameter", nominalDiamData);
                        if (key === 'ctry_typ' && lowerCode === 'ct') return renderSelect(key, "Select tray type", ctryTypData);
                        if (key === 'ctry_pos' && lowerCode === 'ct') return renderSelect(key, "Select position", ctryPosData);
                        if (key === 'ctry_mat' && lowerCode === 'ct') return renderSelect(key, "Select material", ctryMatData);
                        if (key === 'ctry_fas' && lowerCode === 'ct') return renderSelect(key, "Select attachment", ctryFasData);
                        if (key === 'hose_typ' && lowerCode === 'hs') return renderSelect(key, "Select hose type", hoseTypData);
                        if (key === 'hose_cnt' && lowerCode === 'hs') return renderSelect(key, "Select contents", hoseCntData);
                        if (key === 'flan_cls' && lowerCode === 'hs') return renderSelect(key, "Select flange class", flanClsData);
                        if (key === 'weld_typ' && (lowerCode === 'wn' || lowerCode === 'wp')) return renderSelect(key, "Select weld type", weldTypData);
                        if (key === 'weld_des' && (lowerCode === 'wn' || lowerCode === 'wp')) return renderSelect(key, "Select design code", weldDesData);
                        if (key === 'weld_mat' && (lowerCode === 'wn' || lowerCode === 'wp')) return renderSelect(key, "Select material", weldMatData);
                        if (key === 'weld_cfg' && (lowerCode === 'wn' || lowerCode === 'wp')) return renderSelect(key, "Select configuration", weldCfgData);
                        if (key === 'risr_typ' && lowerCode === 'rs') return renderSelect(key, "Select riser type", risrTypData);
                        if (key === 'risr_mat' && lowerCode === 'rs') return renderSelect(key, "Select material", risrMatData);
                        if (key === 'pipe_rtg' && lowerCode === 'rs') return renderSelect(key, "Select rating", pipeRtgData);
                        if (key === 'risg_typ' && lowerCode === 'rg') return renderSelect(key, "Select guard type", risgTypData);
                        if (key === 'risb_typ' && lowerCode === 'rb') return renderSelect(key, "Select beam type", risbTypData);
                        if (key === 'stub_mat' && lowerCode === 'sd') return renderSelect(key, "Select material", stubMatData);
                        if (key === 'wsup_typ' && lowerCode === 'wp') return renderSelect(key, "Select component type", wsupTypData);

                        return (
                          <div key={key} className={cn("space-y-2", key === 'has_gas_seepage' && "col-span-2")}>
                            <Label htmlFor={key} className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{label}</Label>
                            {typeof value === 'boolean' ? (
                              <div className="flex items-center h-11">
                                <Checkbox
                                  id={key}
                                  checked={!!value}
                                  onCheckedChange={(checked: boolean) => handleAdditionalInfoChange(key, checked)}
                                  disabled={!(isCreateMode || isEditMode)}
                                  className="h-5 w-5 rounded-md border-slate-300 dark:border-slate-700"
                                />
                              </div>
                            ) : (
                              <div className="relative">
                                <Input
                                  id={key}
                                  value={value || ""}
                                  onChange={(e) => handleAdditionalInfoChange(key, e.target.value)}
                                  readOnly={!(isCreateMode || isEditMode)}
                                  className={cn(
                                    "h-11 rounded-xl border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 bg-white dark:bg-slate-950 font-mono text-xs text-primary dark:text-primary",
                                    unit && "pr-20"
                                  )}
                                />
                                {unit && (
                                  <div className="absolute right-0 top-0 h-full flex items-center pr-1.5 pt-0.5">
                                    <Select
                                      value={formData.additionalInfo[`${key}_unit`] || unit}
                                      onValueChange={(val) => handleAdditionalInfoChange(`${key}_unit`, val)}
                                      disabled={!(isCreateMode || isEditMode)}
                                    >
                                      <SelectTrigger className="h-8 w-[68px] bg-slate-50 dark:bg-slate-900 border-none focus:ring-0 text-[10px] font-black rounded-lg">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="rounded-xl">
                                        {unitOptions.map((opt) => (
                                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {/* Metadata */}
                {component?.metadata && (
                  <div className="col-span-12 space-y-2 mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/60">
                    <Label htmlFor="metadata" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Metadata RAW</Label>
                    <textarea
                      id="metadata"
                      value={JSON.stringify(component.metadata, null, 2)}
                      readOnly
                      className="w-full p-4 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-[10px] bg-slate-100/30 dark:bg-slate-900/30 min-h-[100px]"
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            {!isCreateMode && (
              <>
                {/* Specifications 2 Tab */}
                <TabsContent value="specifications2" className="space-y-4 mt-0 outline-none">
                  <div className="bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 rounded-[1.5rem] p-8 min-h-[400px]">
                    <div className="space-y-6">
                      <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">
                        Associate Component to other Component
                      </h3>

                      <div className="flex items-center space-x-4">
                        <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider min-w-[120px]">Associated to:</Label>
                        <div className="flex items-center space-x-2 flex-1">
                          <div className="min-w-[200px] h-11 px-4 flex items-center bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                            <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400">
                              {allComponents?.data?.find((c: any) => c.id === (isCreateMode ? formData.associated_comp_id : component?.metadata?.associated_comp_id))?.id_no || "None"}
                            </span>
                          </div>
                          {(isCreateMode || isEditMode) && (
                            <Button
                              variant="secondary"
                              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 px-4 h-11 rounded-xl font-bold"
                              onClick={() => setSelectorOpen(true)}
                            >
                              ...
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
                    <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
                      <DialogHeader className="p-8 bg-slate-50/50 dark:bg-slate-900/50 border-b">
                        <DialogTitle className="text-xl font-black uppercase tracking-tight">Select Component</DialogTitle>
                        <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          Associate with structure ({structureId})
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex-1 overflow-y-auto p-8">
                        <div className="border border-slate-200/60 dark:border-slate-800/60 rounded-2xl overflow-hidden shadow-sm">
                          <DataTable
                            columns={[
                              { accessorKey: "id_no", header: "ID No" },
                              { accessorKey: "q_id", header: "Q ID" },
                              { accessorKey: "code", header: "Code" },
                              {
                                id: "actions",
                                header: "Action",
                                cell: ({ row }) => (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-lg font-bold"
                                    onClick={() => {
                                      handleInputChange("associated_comp_id", (row.original as any).id);
                                      setSelectorOpen(false);
                                    }}
                                  >
                                    Select
                                  </Button>
                                ),
                              },
                            ]}
                            data={allComponents?.data?.filter((c: any) => c.id !== component?.id) || []}
                            disableRowClick={true}
                          />
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </TabsContent>

                {/* Comments Tab */}
                <TabsContent value="comments" className="mt-0 outline-none">
                  <div className="bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 rounded-[1.5rem] p-8">
                    {commentsLoading ? (
                      <div className="h-[200px] flex items-center justify-center text-slate-400 font-bold animate-pulse uppercase tracking-widest text-xs">Loading comments...</div>
                    ) : (
                      <div className="border border-slate-200/60 dark:border-slate-800/60 rounded-2xl overflow-hidden shadow-sm">
                        <DataTable
                          columns={comments}
                          data={commentsData?.data || []}
                          disableRowClick={true}
                          toolbarActions={<ComponentCommentDialog componentId={component?.id || 0} />}
                        />
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Attachments Tab */}
                <TabsContent value="attachments" className="mt-0 outline-none">
                  <div className="bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 rounded-[1.5rem] p-8">
                    {attachmentsLoading ? (
                      <div className="h-[200px] flex items-center justify-center text-slate-400 font-bold animate-pulse uppercase tracking-widest text-xs">Loading attachments...</div>
                    ) : (
                      <div className="border border-slate-200/60 dark:border-slate-800/60 rounded-2xl overflow-hidden shadow-sm">
                        <DataTable
                          columns={attachments}
                          data={attachmentsData?.data || []}
                          disableRowClick={true}
                          toolbarActions={<ComponentAttachmentDialog componentId={component?.id || 0} />}
                        />
                      </div>
                    )}
                  </div>
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>

        <DialogFooter className="p-8 bg-slate-50/50 dark:bg-slate-900/50 border-t shrink-0">
          <div className="flex justify-end gap-3 w-full">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="rounded-xl font-bold px-6 h-11 transition-all"
            >
              Cancel
            </Button>
            {isCreateMode ? (
              <Button
                type="submit"
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-xl font-black px-10 h-11 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 gap-2 uppercase tracking-widest text-[10px]"
              >
                {isSaving ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {isSaving ? "Saving..." : "Create Component"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-xl font-black px-10 h-11 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 uppercase tracking-widest text-[10px]"
              >
                OK
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
