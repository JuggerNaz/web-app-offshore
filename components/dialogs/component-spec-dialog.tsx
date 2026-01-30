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
import { Wrench, Settings2, Save, X, Plus } from "lucide-react";

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

type ComponentSpecDialogProps = {
  component: Component | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: 'view' | 'create';
  defaultCode?: string | null;
};

export function ComponentSpecDialog({ component, open, onOpenChange, mode = 'view', defaultCode }: ComponentSpecDialogProps) {
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
    elv_1: "",
    elv_2: "",
    clk_pos: "",
    lvl: "",
    face: "",
    top_und: "",
    comp_group: "",
    associated_comp_id: null as number | null,
    additionalInfo: {} as Record<string, any>,
  });

  const getTemplate = (code: string | null, type: string) => {
    if (!code) return {};
    const lowerCode = code.toLowerCase();
    if (lowerCode === "an") {
      const compType = type === "platform" ? "an_comp_plat" : "an_comp_pipe";
      return specAdditionalDetails.data.find(d => d.componentType === compType)?.additionalDataTemplate || {};
    }
    return specAdditionalDetails.data.find(d => d.code === lowerCode)?.additionalDataTemplate || {};
  };

  useEffect(() => {
    if (isCreateMode && effectiveCode) {
      const template = getTemplate(effectiveCode, pageType);
      setFormData(prev => ({
        ...prev,
        additionalInfo: { ...template }
      }));
    }
  }, [effectiveCode, isCreateMode, pageType]);

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
        elv_1: component.metadata?.elv_1 ?? "",
        elv_2: component.metadata?.elv_2 ?? "",
        clk_pos: component.metadata?.clk_pos ?? "",
        lvl: component.metadata?.lvl ?? "",
        face: component.metadata?.face ?? "",
        top_und: component.metadata?.top_und ?? "",
        comp_group: component.metadata?.comp_group ?? "",
        associated_comp_id: component.metadata?.associated_comp_id ?? null,
        additionalInfo: component.metadata?.additionalInfo ?? getTemplate(component.code, pageType),
      });
    } else if (isCreateMode) {
      // Ensure a clean slate when switching back to create mode
      setFormData((prev) => ({
        ...prev,
        q_id: "",
        id_no: "",
        code: defaultCode || "",
        additionalInfo: getTemplate(defaultCode || "", pageType),
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
        elv_1: formData.elv_1,
        elv_2: formData.elv_2,
        clk_pos: formData.clk_pos,
        lvl: formData.lvl,
        face: formData.face,
        top_und: formData.top_und,
        comp_group: formData.comp_group,
        associated_comp_id: formData.associated_comp_id,
        additionalInfo: formData.additionalInfo,
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
      mutate(`/api/structure-components/${structureId}`);

      toast("Component created successfully");
      onOpenChange(false);

      // Reset form after create
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
        elv_1: "",
        elv_2: "",
        clk_pos: "",
        lvl: "",
        face: "",
        top_und: "",
        comp_group: "",
        associated_comp_id: null,
        additionalInfo: {},
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
                {isCreateMode ? "Create New Component" : "Component Specifications"}
              </DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                {isCreateMode ? "Structure Asset Management" : (
                  <>
                    <span className="text-blue-600 font-black">{component?.id_no}</span>
                    {component?.updated_at && (
                      <>
                        <span className="opacity-20 text-slate-400">|</span>
                        <span>Updated: {new Date(component.updated_at).toLocaleDateString()}</span>
                      </>
                    )}
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
                {/* Row 1: Q ID, ID No, Code */}
                <div className="col-span-4 space-y-2">
                  <Label htmlFor="qId" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Q Id</Label>
                  <Input
                    id="qId"
                    className="rounded-xl border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 bg-white dark:bg-slate-950 font-bold h-11"
                    value={isCreateMode || isEditMode ? formData.q_id : (component?.q_id || "")}
                    onChange={(e) => handleInputChange("q_id", e.target.value)}
                    readOnly={!(isCreateMode || isEditMode)}
                  />
                </div>
                <div className="col-span-6 space-y-2">
                  <Label htmlFor="idNo" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">ID No</Label>
                  <Input
                    id="idNo"
                    className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/20 font-mono text-blue-600 dark:text-blue-400 h-11"
                    value={
                      isCreateMode
                        ? buildIdNo(
                          formData.code || defaultCode || "",
                          formData.s_node,
                          formData.f_node,
                          formData.dist,
                          formData.clk_pos
                        )
                        : (component?.id_no || "")
                    }
                    readOnly
                  />
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
                  {pageType === "platform" ? (
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
                  ) : (
                    <Select disabled><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger></Select>
                  )}
                </div>
                <div className="col-span-4 space-y-2">
                  <Label htmlFor="eLeg" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">End Leg</Label>
                  {pageType === "platform" ? (
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
                  ) : (
                    <Select disabled><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger></Select>
                  )}
                </div>
                <div className="col-span-4 space-y-2">
                  <Label htmlFor="distance" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Distance</Label>
                  <div className="relative">
                    <Input
                      id="distance"
                      className="rounded-xl border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 bg-white dark:bg-slate-950 font-bold h-11 pr-8"
                      value={isCreateMode || isEditMode ? formData.dist : (component?.metadata?.dist ?? "")}
                      onChange={(e) => handleInputChange("dist", e.target.value)}
                      readOnly={!(isCreateMode || isEditMode)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">M</span>
                  </div>
                </div>

                {/* Row 6: Elevation 1, Elevation 2, Clock Position */}
                <div className="col-span-4 space-y-2">
                  <Label htmlFor="elevation1" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Elevation 1</Label>
                  <div className="relative">
                    <Input
                      id="elevation1"
                      className="rounded-xl border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 bg-white dark:bg-slate-950 font-bold h-11 pr-8"
                      value={isCreateMode || isEditMode ? formData.elv_1 : (component?.metadata?.elv_1 ?? "")}
                      onChange={(e) => handleInputChange("elv_1", e.target.value)}
                      readOnly={!(isCreateMode || isEditMode)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">M</span>
                  </div>
                </div>
                <div className="col-span-4 space-y-2">
                  <Label htmlFor="elevation2" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Elevation 2</Label>
                  <div className="relative">
                    <Input
                      id="elevation2"
                      className="rounded-xl border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 bg-white dark:bg-slate-950 font-bold h-11 pr-8"
                      value={isCreateMode || isEditMode ? formData.elv_2 : (component?.metadata?.elv_2 ?? "")}
                      onChange={(e) => handleInputChange("elv_2", e.target.value)}
                      readOnly={!(isCreateMode || isEditMode)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">M</span>
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
                  {pageType === "platform" ? (
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
                  ) : (
                    <Select disabled><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger></Select>
                  )}
                </div>
                <div className="col-span-4 space-y-2">
                  <Label htmlFor="face" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Face</Label>
                  {pageType === "platform" ? (
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
                  ) : (
                    <Select disabled><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger></Select>
                  )}
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
                      {Object.entries(formData.additionalInfo).map(([key, value]) => {
                        if (key === 'del') return null;
                        const label = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                        return (
                          <div key={key} className="space-y-2">
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
                              <Input
                                id={key}
                                value={value || ""}
                                onChange={(e) => handleAdditionalInfoChange(key, e.target.value)}
                                readOnly={!(isCreateMode || isEditMode)}
                                className="h-11 rounded-xl border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 bg-white dark:bg-slate-950 font-mono text-xs text-cyan-600 dark:text-cyan-400"
                              />
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
                Got it
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
