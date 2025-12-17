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
import { urlId } from "@/utils/client-state";
import { toast } from "sonner";

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
  const [structureId] = useAtom(urlId);
  const [isSaving, setIsSaving] = useState(false);
  
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
  });

  // Update code when defaultCode changes (when switching component types)
  useEffect(() => {
    if (isCreateMode && defaultCode) {
      setFormData(prev => ({ ...prev, code: defaultCode }));
    }
  }, [defaultCode, isCreateMode]);

  const handleInputChange = (field: string, value: string) => {
    if (isCreateMode) {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSave = async () => {
    if (!isCreateMode) return;
    
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
      };

      // Prepare the component data
      const componentData = {
        id_no: formData.id_no,
        q_id: formData.q_id,
        comp_id: 0,
        structure_id: structureId,
        code: formData.code,
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
      
      // Reset form
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

  // Early return after all hooks have been called
  if (!component && !isCreateMode) return null;

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
              {`Created: ${component.created_at ? new Date(component.created_at).toLocaleString() : "N/A"} • Updated: ${component.updated_at ? new Date(component.updated_at).toLocaleString() : "N/A"} • Created by: ${component.created_by || "N/A"} • Modified by: ${component.modified_by || "N/A"}`}
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
                    value={isCreateMode ? formData.q_id : (component?.q_id || "")} 
                    onChange={(e) => handleInputChange("q_id", e.target.value)}
                    readOnly={!isCreateMode} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="idNo">ID No:</Label>
                  <Input 
                    id="idNo" 
                    value={isCreateMode ? formData.id_no : (component?.id_no || "")} 
                    onChange={(e) => handleInputChange("id_no", e.target.value)}
                    readOnly={!isCreateMode} 
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
                    value={isCreateMode ? formData.description : (component?.metadata?.description ?? "")}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    readOnly={!isCreateMode}
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
                    value={isCreateMode ? formData.s_node : (component?.metadata?.s_node ?? "")} 
                    onChange={(e) => handleInputChange("s_node", e.target.value)}
                    readOnly={!isCreateMode} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eNode">End Node:</Label>
                  <Input 
                    id="eNode" 
                    value={isCreateMode ? formData.f_node : (component?.metadata?.f_node ?? "")} 
                    onChange={(e) => handleInputChange("f_node", e.target.value)}
                    readOnly={!isCreateMode} 
                  />
                </div>
              </div>

              {/* Row 5: Start Leg, End Leg, Distance */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sLeg">Start Leg:</Label>
                  <Input 
                    id="sLeg" 
                    value={isCreateMode ? formData.s_leg : (component?.metadata?.s_leg ?? "")} 
                    onChange={(e) => handleInputChange("s_leg", e.target.value)}
                    readOnly={!isCreateMode} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eLeg">End Leg:</Label>
                  <Input 
                    id="eLeg" 
                    value={isCreateMode ? formData.f_leg : (component?.metadata?.f_leg ?? "")} 
                    onChange={(e) => handleInputChange("f_leg", e.target.value)}
                    readOnly={!isCreateMode} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="distance">Distance:</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      id="distance" 
                      value={isCreateMode ? formData.dist : (component?.metadata?.dist ?? "")} 
                      onChange={(e) => handleInputChange("dist", e.target.value)}
                      readOnly={!isCreateMode}
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
                      value={isCreateMode ? formData.elv_1 : (component?.metadata?.elv_1 ?? "")} 
                      onChange={(e) => handleInputChange("elv_1", e.target.value)}
                      readOnly={!isCreateMode}
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
                      value={isCreateMode ? formData.elv_2 : (component?.metadata?.elv_2 ?? "")} 
                      onChange={(e) => handleInputChange("elv_2", e.target.value)}
                      readOnly={!isCreateMode}
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground">m</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clockPos">Clock Position:</Label>
                  <Input 
                    id="clockPos" 
                    value={isCreateMode ? formData.clk_pos : (component?.metadata?.clk_pos ?? "")} 
                    onChange={(e) => handleInputChange("clk_pos", e.target.value)}
                    readOnly={!isCreateMode} 
                  />
                </div>
              </div>

              {/* Row 7: Level, Face, Part */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="level">Level:</Label>
                  <Input 
                    id="level" 
                    value={isCreateMode ? formData.lvl : (component?.metadata?.lvl ?? "")} 
                    onChange={(e) => handleInputChange("lvl", e.target.value)}
                    readOnly={!isCreateMode} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="face">Face:</Label>
                  <Input 
                    id="face" 
                    value={isCreateMode ? formData.face : (component?.metadata?.face ?? "")} 
                    onChange={(e) => handleInputChange("face", e.target.value)}
                    readOnly={!isCreateMode} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="part">Part:</Label>
                  <Input 
                    id="part" 
                    value={isCreateMode ? formData.top_und : (component?.metadata?.top_und ?? "")} 
                    onChange={(e) => handleInputChange("top_und", e.target.value)}
                    readOnly={!isCreateMode} 
                  />
                </div>
              </div>

              {/* Row 8: Structural Group (full width) */}
              <div className="space-y-2">
                <Label htmlFor="structuralGroup">Structural Group:</Label>
                <Input 
                  id="structuralGroup" 
                  value={isCreateMode ? formData.comp_group : (component?.metadata?.comp_group ?? "")} 
                  onChange={(e) => handleInputChange("comp_group", e.target.value)}
                  readOnly={!isCreateMode} 
                />
              </div>

              {/* Metadata */}
              {component?.metadata && (
                <div className="space-y-2">
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
                <div className="border rounded-lg p-6">
                  <p className="text-muted-foreground">Additional specifications content here...</p>
                </div>
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
          {isCreateMode ? (
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
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
