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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-blue-500">🔧</span>
            {isCreateMode ? "Create New Component" : `${component?.code || "Component"} Specifications [${component?.id_no}]`}
          </DialogTitle>
          {!isCreateMode && component && (
            <DialogDescription className="text-xs text-muted-foreground">
              {`Created: ${component.created_at ? new Date(component.created_at).toLocaleString() : "N/A"} • Updated: ${component.updated_at ? new Date(component.updated_at).toLocaleString() : "N/A"} • Created by: ${component.created_by_name || component.created_by || "N/A"
                } • Modified by: ${component.modified_by_name || component.modified_by || "N/A"
                }`}
            </DialogDescription>
          )}
        </DialogHeader>

        <Tabs defaultValue="specifications" className="w-full">
          <TabsList className={`grid w-full ${isCreateMode ? 'grid-cols-1' : 'grid-cols-4'}`}>
            <TabsTrigger value="specifications">Specifications</TabsTrigger>
            {!isCreateMode && (
              <>
                <TabsTrigger value="specifications2">Specifications 2</TabsTrigger>
                <TabsTrigger value="comments">Comments</TabsTrigger>
                <TabsTrigger value="attachments">Attachments</TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Specifications Tab */}
          <TabsContent value="specifications" className="space-y-4 mt-4">
            <div className="border rounded-lg p-6 space-y-4 bg-slate-50 dark:bg-slate-900">
              {/* Row 1: Q ID, ID No, Code */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="qId">Q Id:</Label>
                  <Input
                    id="qId"
                    value={isCreateMode || isEditMode ? formData.q_id : (component?.q_id || "")}
                    onChange={(e) => handleInputChange("q_id", e.target.value)}
                    readOnly={!(isCreateMode || isEditMode)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="idNo">ID No:</Label>
                  <Input
                    id="idNo"
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
                <div className="space-y-2">
                  <Label htmlFor="code">Code:</Label>
                  <Input id="code" value={isCreateMode ? formData.code : (defaultCode || component?.code || "")} readOnly />
                </div>
              </div>

              {/* Row 2: Description (full width, floating label) */}
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    id="description"
                    placeholder=" "
                    className="peer pt-4"
                    value={isCreateMode || isEditMode ? formData.description : (component?.metadata?.description ?? "")}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    readOnly={!(isCreateMode || isEditMode)}
                  />
                  <Label
                    htmlFor="description"
                    className="pointer-events-none absolute left-3 top-0 -translate-y-1/2 bg-background px-1 text-xs text-muted-foreground transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:-translate-y-1/2 peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-xs"
                  >
                    Description
                  </Label>
                </div>
              </div>


              {/* Row 4: Start Node, End Node */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sNode">Start Node:</Label>
                  <Input
                    id="sNode"
                    value={isCreateMode || isEditMode ? formData.s_node : (component?.metadata?.s_node ?? "")}
                    onChange={(e) => handleInputChange("s_node", e.target.value)}
                    readOnly={!(isCreateMode || isEditMode)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eNode">End Node:</Label>
                  <Input
                    id="eNode"
                    value={isCreateMode || isEditMode ? formData.f_node : (component?.metadata?.f_node ?? "")}
                    onChange={(e) => handleInputChange("f_node", e.target.value)}
                    readOnly={!(isCreateMode || isEditMode)}
                  />
                </div>
              </div>

              {/* Row 5: Start Leg, End Leg, Distance */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sLeg">Start Leg:</Label>
                  {pageType === "platform" ? (
                    <Select
                      value={isCreateMode ? formData.s_leg : (component?.metadata?.s_leg ?? "")}
                      onValueChange={(val) => handleInputChange("s_leg", val)}
                      disabled={!isCreateMode || legOptions.length === 0}
                    >
                      <SelectTrigger id="sLeg">
                        <SelectValue placeholder="Select start leg" />
                      </SelectTrigger>
                      <SelectContent>
                        {legOptions.map((opt: any) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select disabled><SelectTrigger><SelectValue /></SelectTrigger></Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eLeg">End Leg:</Label>
                  {pageType === "platform" ? (
                    <Select
                      value={isCreateMode ? formData.f_leg : (component?.metadata?.f_leg ?? "")}
                      onValueChange={(val) => handleInputChange("f_leg", val)}
                      disabled={!isCreateMode || legOptions.length === 0}
                    >
                      <SelectTrigger id="eLeg">
                        <SelectValue placeholder="Select end leg" />
                      </SelectTrigger>
                      <SelectContent>
                        {legOptions.map((opt: any) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select disabled><SelectTrigger><SelectValue /></SelectTrigger></Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="distance">Distance:</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="distance"
                      value={isCreateMode || isEditMode ? formData.dist : (component?.metadata?.dist ?? "")}
                      onChange={(e) => handleInputChange("dist", e.target.value)}
                      readOnly={!(isCreateMode || isEditMode)}
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground">m</span>
                  </div>
                </div>
              </div>

              {/* Row 6: Elevation 1, Elevation 2, Clock Position */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="elevation1">Elevation 1:</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="elevation1"
                      value={isCreateMode || isEditMode ? formData.elv_1 : (component?.metadata?.elv_1 ?? "")}
                      onChange={(e) => handleInputChange("elv_1", e.target.value)}
                      readOnly={!(isCreateMode || isEditMode)}
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground">m</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="elevation2">Elevation 2:</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="elevation2"
                      value={isCreateMode || isEditMode ? formData.elv_2 : (component?.metadata?.elv_2 ?? "")}
                      onChange={(e) => handleInputChange("elv_2", e.target.value)}
                      readOnly={!(isCreateMode || isEditMode)}
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground">m</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clockPos">Clock Position:</Label>
                  <Select
                    value={
                      (isCreateMode || isEditMode)
                        ? formData.clk_pos
                        : (component?.metadata?.clk_pos ?? "")
                    }
                    onValueChange={(val) => handleInputChange("clk_pos", val)}
                    disabled={!isCreateMode || !positionLib}
                  >
                    <SelectTrigger id="clockPos">
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
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
              </div>

              {/* Row 7: Level, Face, Part */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="level">Level:</Label>
                  {pageType === "platform" ? (
                    <Select
                      value={isCreateMode || isEditMode ? formData.lvl : (component?.metadata?.lvl ?? "")}
                      onValueChange={(val) => handleInputChange("lvl", val)}
                      disabled={!(isCreateMode || isEditMode) || levelOptions.length === 0}
                    >
                      <SelectTrigger id="level">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        {levelOptions.map((opt: any) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select disabled><SelectTrigger><SelectValue /></SelectTrigger></Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="face">Face:</Label>
                  {pageType === "platform" ? (
                    <Select
                      value={isCreateMode || isEditMode ? formData.face : (component?.metadata?.face ?? "")}
                      onValueChange={(val) => handleInputChange("face", val)}
                      disabled={!(isCreateMode || isEditMode) || faceOptions.length === 0}
                    >
                      <SelectTrigger id="face">
                        <SelectValue placeholder="Select face" />
                      </SelectTrigger>
                      <SelectContent>
                        {faceOptions.map((opt: any) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select disabled><SelectTrigger><SelectValue /></SelectTrigger></Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="part">Part:</Label>
                  <Select
                    value={
                      (isCreateMode || isEditMode)
                        ? formData.top_und
                        : (component?.metadata?.top_und ?? "")
                    }
                    onValueChange={(val) => handleInputChange("top_und", val)}
                    disabled={!isCreateMode}
                  >
                    <SelectTrigger id="part">
                      <SelectValue placeholder="Select part" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TOPSIDE">TOPSIDE</SelectItem>
                      <SelectItem value="SUBSEA">SUBSEA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 8: Structural Group (full width) */}
              <div className="space-y-2">
                <Label htmlFor="structuralGroup">Structural Group:</Label>
                <Select
                  value={
                    (isCreateMode || isEditMode)
                      ? formData.comp_group
                      : (component?.metadata?.comp_group ?? "")
                  }
                  onValueChange={(val) => handleInputChange("comp_group", val)}
                  disabled={!isCreateMode || !compGroupLib}
                >
                  <SelectTrigger id="structuralGroup">
                    <SelectValue placeholder="Select structural group" />
                  </SelectTrigger>
                  <SelectContent>
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
                <div className="pt-4 border-t space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider italic">Additional Details</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    {Object.entries(formData.additionalInfo).map(([key, value]) => {
                      if (key === 'del') return null;
                      const label = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                      return (
                        <div key={key} className="flex items-center gap-4">
                          <Label htmlFor={key} className="text-xs font-medium min-w-[100px] text-right">{label}:</Label>
                          {typeof value === 'boolean' ? (
                            <Checkbox
                              id={key}
                              checked={!!value}
                              onCheckedChange={(checked: boolean) => handleAdditionalInfoChange(key, checked)}
                              disabled={!(isCreateMode || isEditMode)}
                            />
                          ) : (
                            <Input
                              id={key}
                              value={value || ""}
                              onChange={(e) => handleAdditionalInfoChange(key, e.target.value)}
                              readOnly={!(isCreateMode || isEditMode)}
                              className="h-8 text-xs text-cyan-600 dark:text-cyan-400 font-mono shadow-sm"
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
                <div className="space-y-2 mt-4 pt-4 border-t">
                  <Label htmlFor="metadata">Metadata:</Label>
                  <textarea
                    id="metadata"
                    value={JSON.stringify(component.metadata, null, 2)}
                    readOnly
                    className="w-full p-2 border rounded-md font-mono text-xs bg-muted min-h-[100px]"
                  />
                </div>
              )}
            </div>
          </TabsContent>

          {!isCreateMode && (
            <>
              {/* Specifications 2 Tab */}
              <TabsContent value="specifications2" className="space-y-4 mt-4">
                <div className="border rounded-lg p-8 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-8 min-h-[400px]">
                  <div className="space-y-6">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Associate Component to other Component:
                    </h3>

                    <div className="flex items-center space-x-4">
                      <Label className="text-sm font-medium min-w-[120px]">Associated to:</Label>
                      <div className="flex items-center space-x-2 flex-1">
                        <div className="min-w-[200px] h-10 px-3 flex items-center bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md">
                          <span className="text-sm font-mono text-cyan-600 dark:text-cyan-400">
                            {allComponents?.data?.find((c: any) => c.id === (isCreateMode ? formData.associated_comp_id : component?.metadata?.associated_comp_id))?.id_no || "None"}
                          </span>
                        </div>
                        {(isCreateMode || isEditMode) && (
                          <Button
                            variant="secondary"
                            className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 px-4 h-10 font-bold"
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
                  <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                      <DialogTitle>Select Component to Associate</DialogTitle>
                      <DialogDescription>
                        Choose a component from the same structure ({structureId}) to associate with this component.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto mt-4 border rounded-md">
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
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* Comments Tab */}
              <TabsContent value="comments" className="p-4 mt-4">
                {commentsLoading ? (
                  <div>Loading comments...</div>
                ) : commentsError ? (
                  <div>Failed to load comments</div>
                ) : (
                  <DataTable
                    columns={comments}
                    data={commentsData?.data || []}
                    disableRowClick={true}
                    toolbarActions={<ComponentCommentDialog componentId={component?.id || 0} />}
                  />
                )}
              </TabsContent>

              {/* Attachments Tab */}
              <TabsContent value="attachments" className="p-4 mt-4">
                {attachmentsLoading ? (
                  <div>Loading attachments...</div>
                ) : attachmentsError ? (
                  <div>Failed to load attachments</div>
                ) : (
                  <DataTable
                    columns={attachments}
                    data={attachmentsData?.data || []}
                    disableRowClick={true}
                    toolbarActions={<ComponentAttachmentDialog componentId={component?.id || 0} />}
                  />
                )}
              </TabsContent>
            </>
          )}
        </Tabs>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {isCreateMode || isEditMode ? (
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : isCreateMode ? "Save" : "Save Changes"}
            </Button>
          ) : (
            <Button onClick={() => onOpenChange(false)}>
              OK
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
