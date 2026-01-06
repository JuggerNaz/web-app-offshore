"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";
import { fetcher } from "@/utils/utils";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import specAdditionalDetails from "@/utils/spec-additional-details.json";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/data-table/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { comments, attachments } from "@/components/data-table/columns";
import { ComponentCommentDialog } from "./component-comment-dialog";
import { ComponentAttachmentDialog } from "./component-attachment-dialog";

// Keep in sync with other component types
export type EditableComponent = {
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
};

interface ComponentEditDialogProps {
  component: EditableComponent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listKey?: string | null; // SWR key for revalidation (e.g., /api/structure-components/...)
}

// Helper to build ID No in the same format as in ComponentSpecDialog
const padNumericStringEdit = (value: string | null | undefined, length: number) => {
  const digits = (value ?? "").toString().replace(/\D/g, "");
  const base = digits === "" ? "0" : digits;
  const padded = base.padStart(length, "0");
  return padded.slice(-length);
};

const buildIdNoEdit = (
  code: string | null | undefined,
  s_node: string,
  f_node: string,
  dist: string,
  clk_pos: string
): string => {
  if (!code) return "";
  const startNode = padNumericStringEdit(s_node, 6);
  const endNode = padNumericStringEdit(f_node, 6);
  const distance = padNumericStringEdit(dist, 5);
  const clockPos = padNumericStringEdit(clk_pos, 2);
  return `${code}/${startNode}-${endNode}/${distance}/${clockPos}`;
};

export function ComponentEditDialog({ component, open, onOpenChange, listKey }: ComponentEditDialogProps) {
  const [structureId] = useAtom(urlId);
  const [pageType] = useAtom(urlType);
  const [isSaving, setIsSaving] = useState(false);

  // POSITION options
  const { data: positionLib } = useSWR(`/api/library/${"POSITION"}`, fetcher);
  // Structural group options
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
      return specAdditionalDetails.data.find((d: any) => d.componentType === compType)?.additionalDataTemplate || {};
    }
    return specAdditionalDetails.data.find((d: any) => d.code === lowerCode)?.additionalDataTemplate || {};
  };

  // Initialize form from component when opened
  useEffect(() => {
    if (open && component) {
      setFormData({
        q_id: component.q_id || "",
        id_no: component.id_no || "",
        code: component.code || "",
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
    }
  }, [open, component]);

  const handleChange = (field: keyof typeof formData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAdditionalInfoChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      additionalInfo: {
        ...prev.additionalInfo,
        [field]: value
      }
    }));
  };

  const generatedIdNo = buildIdNoEdit(
    formData.code || component?.code || "",
    formData.s_node,
    formData.f_node,
    formData.dist,
    formData.clk_pos
  );

  const handleSave = async () => {
    if (!component) return;

    if (!generatedIdNo) {
      toast("ID No is invalid. Please ensure component type is set.");
      return;
    }

    setIsSaving(true);
    try {
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

      const updateData = {
        id_no: generatedIdNo,
        q_id: formData.q_id,
        code: formData.code,
        metadata,
      };

      await fetcher(`/api/structure-components/item/${component.id}`, {
        method: "PATCH",
        body: JSON.stringify(updateData),
      });

      // Revalidate the list view
      if (listKey) {
        mutate(listKey);
      } else if (structureId) {
        mutate(`/api/structure-components/${structureId}`);
      }

      toast("Component updated successfully");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update component", error);
      toast("Failed to update component");
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch comments and attachments for the tabs
  const { data: commentsData, isLoading: commentsLoading } = useSWR(
    component && component.id ? `/api/comment/component/${component.id}` : null,
    fetcher
  );

  const { data: attachmentsData, isLoading: attachmentsLoading } = useSWR(
    component && component.id ? `/api/attachment/component/${component.id}` : null,
    fetcher
  );

  if (!open || !component) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-blue-500">🔧</span>
            Edit Component Spec [{component?.id_no}]
          </DialogTitle>
          {component && (
            <DialogDescription className="text-xs text-muted-foreground">
              {`Created: ${component.created_at ? new Date(component.created_at).toLocaleString() : "N/A"
                } • Updated: ${component.updated_at ? new Date(component.updated_at).toLocaleString() : "N/A"
                }`}
            </DialogDescription>
          )}
        </DialogHeader>

        <Tabs defaultValue="specifications" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="specifications">Specifications</TabsTrigger>
            <TabsTrigger value="specifications2">Specifications 2</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="attachments">Attachments</TabsTrigger>
          </TabsList>

          <TabsContent value="specifications" className="space-y-4 mt-4">
            <div className="border rounded-lg p-6 space-y-4 bg-slate-50 dark:bg-slate-900">
              {/* Row 1: Q ID, ID No, Code */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-qId">Q Id:</Label>
                  <Input
                    id="edit-qId"
                    value={formData.q_id}
                    onChange={(e) => handleChange("q_id", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-idNo">ID No:</Label>
                  <Input
                    id="edit-idNo"
                    value={generatedIdNo || component?.id_no || ""}
                    readOnly
                    className="bg-muted font-mono text-cyan-600 dark:text-cyan-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-code">Code:</Label>
                  <Input
                    id="edit-code"
                    value={formData.code}
                    onChange={(e) => handleChange("code", e.target.value)}
                  />
                </div>
              </div>

              {/* Row 2: Description (full width, floating label style) */}
              <div className="space-y-2 pt-2">
                <div className="relative">
                  <Input
                    id="edit-description"
                    placeholder=" "
                    className="peer pt-4"
                    value={formData.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                  />
                  <Label
                    htmlFor="edit-description"
                    className="pointer-events-none absolute left-3 top-0 -translate-y-1/2 bg-background px-1 text-xs text-muted-foreground transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:-translate-y-1/2 peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-xs"
                  >
                    Description
                  </Label>
                </div>
              </div>

              {/* Row 3: Nodes */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-sNode">Start Node:</Label>
                  <Input
                    id="edit-sNode"
                    value={formData.s_node}
                    onChange={(e) => handleChange("s_node", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-eNode">End Node:</Label>
                  <Input
                    id="edit-eNode"
                    value={formData.f_node}
                    onChange={(e) => handleChange("f_node", e.target.value)}
                  />
                </div>
              </div>

              {/* Row 4: Legs */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-sLeg">Start Leg:</Label>
                  {pageType === "platform" ? (
                    <Select
                      value={formData.s_leg}
                      onValueChange={(val) => handleChange("s_leg", val)}
                      disabled={legOptions.length === 0}
                    >
                      <SelectTrigger id="edit-sLeg">
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
                  <Label htmlFor="edit-eLeg">End Leg:</Label>
                  {pageType === "platform" ? (
                    <Select
                      value={formData.f_leg}
                      onValueChange={(val) => handleChange("f_leg", val)}
                      disabled={legOptions.length === 0}
                    >
                      <SelectTrigger id="edit-eLeg">
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
                  <Label htmlFor="edit-dist">Distance:</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="edit-dist"
                      value={formData.dist}
                      onChange={(e) => handleChange("dist", e.target.value)}
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground">m</span>
                  </div>
                </div>
              </div>

              {/* Row 5: elevations and clock pos */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-elv1">Elevation 1:</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="edit-elv1"
                      value={formData.elv_1}
                      onChange={(e) => handleChange("elv_1", e.target.value)}
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground">m</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-elv2">Elevation 2:</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="edit-elv2"
                      value={formData.elv_2}
                      onChange={(e) => handleChange("elv_2", e.target.value)}
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground">m</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-clockPos">Clock Position:</Label>
                  <Select
                    value={formData.clk_pos}
                    onValueChange={(val) => handleChange("clk_pos", val)}
                    disabled={!positionLib}
                  >
                    <SelectTrigger id="edit-clockPos">
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

              {/* Row 6: Level / Face / Part */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-level">Level:</Label>
                  {pageType === "platform" ? (
                    <Select
                      value={formData.lvl}
                      onValueChange={(val) => handleChange("lvl", val)}
                      disabled={levelOptions.length === 0}
                    >
                      <SelectTrigger id="edit-level">
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
                  <Label htmlFor="edit-face">Face:</Label>
                  {pageType === "platform" ? (
                    <Select
                      value={formData.face}
                      onValueChange={(val) => handleChange("face", val)}
                      disabled={faceOptions.length === 0}
                    >
                      <SelectTrigger id="edit-face">
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
                  <Label htmlFor="edit-part">Part:</Label>
                  <Select
                    value={formData.top_und}
                    onValueChange={(val) => handleChange("top_und", val)}
                  >
                    <SelectTrigger id="edit-part">
                      <SelectValue placeholder="Select part" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TOPSIDE">TOPSIDE</SelectItem>
                      <SelectItem value="SUBSEA">SUBSEA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 7: Group */}
              <div className="space-y-2">
                <Label htmlFor="edit-group">Structural Group:</Label>
                <Select
                  value={formData.comp_group}
                  onValueChange={(val) => handleChange("comp_group", val)}
                  disabled={!compGroupLib}
                >
                  <SelectTrigger id="edit-group">
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

              {/* Additional Details */}
              {Object.keys(formData.additionalInfo).length > 0 && (
                <div className="pt-4 border-t space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider italic">Additional Details</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    {Object.entries(formData.additionalInfo).map(([key, value]) => {
                      if (key === 'del') return null;
                      const label = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                      return (
                        <div key={key} className="flex items-center gap-4">
                          <Label htmlFor={`edit-${key}`} className="text-xs font-medium min-w-[100px] text-right">{label}:</Label>
                          {typeof value === 'boolean' ? (
                            <Checkbox
                              id={`edit-${key}`}
                              checked={!!value}
                              onCheckedChange={(checked: boolean) => handleAdditionalInfoChange(key, checked)}
                            />
                          ) : (
                            <Input
                              id={`edit-${key}`}
                              value={value || ""}
                              onChange={(e) => handleAdditionalInfoChange(key, e.target.value)}
                              className="h-8 text-xs text-cyan-600 dark:text-cyan-400 font-mono shadow-sm"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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

          <TabsContent value="specifications2" className="space-y-4 mt-4">
            <div className="border rounded-lg p-8 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-8 min-h-[400px]">
              <div className="space-y-6">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 italic">
                  Associate Component to other Component:
                </h3>

                <div className="flex items-center space-x-4">
                  <Label className="text-sm font-medium min-w-[120px]">Associated to:</Label>
                  <div className="flex items-center space-x-2 flex-1">
                    <div className="min-w-[200px] h-10 px-3 flex items-center bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md">
                      <span className="text-sm font-mono text-cyan-600 dark:text-cyan-400">
                        {allComponents?.data?.find((c: any) => c.id === formData.associated_comp_id)?.id_no || "None"}
                      </span>
                    </div>
                    <Button
                      variant="secondary"
                      className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 px-4 h-10 font-bold"
                      onClick={() => setSelectorOpen(true)}
                    >
                      ...
                    </Button>
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
                        cell: ({ row }: { row: any }) => (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              handleChange("associated_comp_id", (row.original as any).id);
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

          <TabsContent value="comments" className="space-y-4 mt-4">
            <div className="p-4">
              {commentsLoading ? (
                <div>Loading comments...</div>
              ) : (
                <DataTable
                  columns={comments}
                  data={commentsData?.data || []}
                  disableRowClick={true}
                  toolbarActions={<ComponentCommentDialog componentId={component?.id || 0} />}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="attachments" className="space-y-4 mt-4">
            <div className="p-4">
              {attachmentsLoading ? (
                <div>Loading attachments...</div>
              ) : (
                <DataTable
                  columns={attachments}
                  data={attachmentsData?.data || []}
                  disableRowClick={true}
                  toolbarActions={<ComponentAttachmentDialog componentId={component?.id || 0} />}
                />
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
