"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Component = {
  compId: string;
  qId: string;
  description: string;
  componentType: string;
  sNode: string;
  eNode: string;
  sLeg: string;
  eLeg: string;
  elevation1: string;
  elevation2: string;
  distance: string;
  clockPos: string;
};

type ComponentSpecDialogProps = {
  component: Component | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ComponentSpecDialog({ component, open, onOpenChange }: ComponentSpecDialogProps) {
  if (!component) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-blue-500">🔧</span>
            {component.componentType} Specifications [{component.compId}]
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="specifications" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="specifications">Specifications</TabsTrigger>
            <TabsTrigger value="specifications2">Specifications 2</TabsTrigger>
          </TabsList>

          {/* Specifications Tab */}
          <TabsContent value="specifications" className="space-y-4 mt-4">
            <div className="border rounded-lg p-6 space-y-6 bg-slate-50 dark:bg-slate-900">
              {/* Q ID and Description Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="qId">Q Id:</Label>
                  <Input id="qId" value={component.qId} readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description:</Label>
                  <div className="flex items-center gap-2">
                    <Input id="description" value={component.description} readOnly className="flex-1" />
                    <div className="flex items-center gap-2">
                      <Checkbox id="detailedId" defaultChecked />
                      <Label htmlFor="detailedId" className="text-sm">Detailed ID</Label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Node/Leg and Elevation Row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="startNode">Start Node:</Label>
                    <Input id="startNode" value={component.sNode} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endNode">End Node:</Label>
                    <Input id="endNode" value={component.eNode} readOnly />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="startLeg">Start Leg:</Label>
                    <Input id="startLeg" value={component.sLeg} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endLeg">End Leg:</Label>
                    <Input id="endLeg" value={component.eLeg} readOnly />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="elevation1">Elevation 1:</Label>
                    <div className="flex items-center gap-2">
                      <Input id="elevation1" value={component.elevation1} readOnly className="flex-1" />
                      <span className="text-sm text-muted-foreground">m</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="elevation2">Elevation 2:</Label>
                    <div className="flex items-center gap-2">
                      <Input id="elevation2" value={component.elevation2} readOnly className="flex-1" />
                      <span className="text-sm text-muted-foreground">m</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Distance, Clock Position and Details */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="distance">Distance:</Label>
                  <div className="flex items-center gap-2">
                    <Input id="distance" value={component.distance} readOnly className="flex-1" />
                    <span className="text-sm text-muted-foreground">m</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clockPosition">Clock Position:</Label>
                  <Input id="clockPosition" value={component.clockPos} readOnly />
                </div>
                <div className="space-y-4 border-l pl-4">
                  <div className="space-y-2">
                    <Label htmlFor="level">Level:</Label>
                    <Input id="level" value="Level 4" readOnly />
                  </div>
                </div>
              </div>

              {/* Structural Group */}
              <div className="space-y-2">
                <Label htmlFor="structuralGroup">Structural Group:</Label>
                <Input id="structuralGroup" placeholder="" readOnly />
              </div>

              {/* Additional Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="face">Face:</Label>
                  <Input id="face" value="Row 1" readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="part">Part:</Label>
                  <Input id="part" value="SUBSEA" readOnly />
                </div>
              </div>

              {/* Component ID */}
              <div className="space-y-2">
                <Label htmlFor="componentId" className="text-blue-600 dark:text-blue-400">Component Id:</Label>
                <Input 
                  id="componentId" 
                  value={component.compId} 
                  readOnly 
                  className="font-mono text-sm bg-blue-50 dark:bg-blue-950"
                />
              </div>

              {/* Installation Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="instDate">Inst. Date:</Label>
                  <Input id="instDate" value="00-00-0000" readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="life">Life:</Label>
                  <div className="flex items-center gap-2">
                    <Input id="life" value="10" readOnly className="flex-1" />
                    <span className="text-sm text-muted-foreground">yrs</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="installedType">Installed Type:</Label>
                  <Input id="installedType" value="TYPE A" readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">Position:</Label>
                  <Input id="position" value="ORIGINAL" readOnly />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="material">Material:</Label>
                  <Input id="material" value="ALUMIN" readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fitting">Fitting:</Label>
                  <Input id="fitting" value="BRACELET" readOnly />
                </div>
              </div>

              {/* Component Specific Fields */}
              {component.componentType.includes("ANODE") && (
                <div className="space-y-2">
                  <Label htmlFor="anodeType">Anode Type:</Label>
                  <Input id="anodeType" value="ANODE TYPE A" readOnly />
                </div>
              )}
            </div>
          </TabsContent>

          {/* Specifications 2 Tab */}
          <TabsContent value="specifications2" className="space-y-4 mt-4">
            <div className="border rounded-lg p-6">
              <p className="text-muted-foreground">Additional specifications content here...</p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
