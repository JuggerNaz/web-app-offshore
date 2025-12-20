"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAtom } from "jotai";
import { urlId } from "@/utils/client-state";
import { fetcher } from "@/utils/utils";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";

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

export function ComponentEditDialog({ component, open, onOpenChange, listKey }: ComponentEditDialogProps) {
  const [structureId] = useAtom(urlId);
  const [isSaving, setIsSaving] = useState(false);

  // POSITION options
  const { data: positionLib } = useSWR(`/api/library/${"POSITION"}`, fetcher);

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
  });

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
      });
    }
  }, [open, component]);

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!component) return;

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
      };

      const updateData = {
        id_no: formData.id_no,
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

  if (!open || !component) return null;

  // Simple inline modal implementation (no Radix Portal) to avoid any
  // interaction with global overlays / aria-hidden behavior.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 pointer-events-auto"
        onClick={() => onOpenChange(false)}
      />
      {/* Modal content */}
      <div className="relative z-10 max-w-4xl max-h-[90vh] w-full bg-background border rounded-lg shadow-lg overflow-y-auto p-6 pointer-events-auto">
        <div className="flex flex-col gap-1 mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Edit Component [{component.id_no}] {component.code ? `- ${component.code}` : ""}
          </h2>
          <p className="text-xs text-muted-foreground">
            {`Created: ${
              component.created_at
                ? new Date(component.created_at).toLocaleString()
                : "N/A"
            } • Updated: ${
              component.updated_at
                ? new Date(component.updated_at).toLocaleString()
                : "N/A"
            }`}
          </p>
        </div>

        <div className="space-y-4 mt-2">
          {/* Row 1: Q ID, ID No, Code */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-qId">Q Id</Label>
              <Input
                id="edit-qId"
                value={formData.q_id}
                onChange={(e) => handleChange("q_id", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-idNo">ID No</Label>
              <Input
                id="edit-idNo"
                value={formData.id_no}
                onChange={(e) => handleChange("id_no", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-code">Code</Label>
              <Input
                id="edit-code"
                value={formData.code}
                onChange={(e) => handleChange("code", e.target.value)}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Input
              id="edit-description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
            />
          </div>

          {/* Start/End Node */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-sNode">Start Node</Label>
              <Input
                id="edit-sNode"
                value={formData.s_node}
                onChange={(e) => handleChange("s_node", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-eNode">End Node</Label>
              <Input
                id="edit-eNode"
                value={formData.f_node}
                onChange={(e) => handleChange("f_node", e.target.value)}
              />
            </div>
          </div>

          {/* Distance, Elevations, Clock Pos */}
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-dist">Distance</Label>
              <Input
                id="edit-dist"
                value={formData.dist}
                onChange={(e) => handleChange("dist", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-elv1">Elevation 1</Label>
              <Input
                id="edit-elv1"
                value={formData.elv_1}
                onChange={(e) => handleChange("elv_1", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-elv2">Elevation 2</Label>
              <Input
                id="edit-elv2"
                value={formData.elv_2}
                onChange={(e) => handleChange("elv_2", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-clockPos">Clock Position</Label>
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

          {/* Level / Face / Part / Group */}
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-level">Level</Label>
              <Input
                id="edit-level"
                value={formData.lvl}
                onChange={(e) => handleChange("lvl", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-face">Face</Label>
              <Input
                id="edit-face"
                value={formData.face}
                onChange={(e) => handleChange("face", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-part">Part</Label>
              <Input
                id="edit-part"
                value={formData.top_und}
                onChange={(e) => handleChange("top_und", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-group">Structural Group</Label>
              <Input
                id="edit-group"
                value={formData.comp_group}
                onChange={(e) => handleChange("comp_group", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
