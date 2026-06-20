"use client";

import { useState, useEffect } from "react";
import { Settings2, Type, Move, RotateCw, Scaling, Trash2, Save } from "lucide-react";
import { useEditorStore } from "../../store/useEditorStore";
import { useSceneStore } from "../../store/useSceneStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function RightSidebar() {
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const setSelectedIds = useEditorStore((state) => state.setSelectedIds);
  const components = useSceneStore((state) => state.components);

  const selectedComponent = selectedIds.length > 0 ? components[selectedIds[0]] : null;

  // Local state for manual properties edit
  const [posX, setPosX] = useState("");
  const [posY, setPosY] = useState("");
  const [posZ, setPosZ] = useState("");
  const [rotX, setRotX] = useState("");
  const [rotY, setRotY] = useState("");
  const [rotZ, setRotZ] = useState("");
  const [dimWidth, setDimWidth] = useState("");
  const [dimLength, setDimLength] = useState("");

  // Sync inputs with selected component changes
  useEffect(() => {
    if (selectedComponent) {
      setPosX(selectedComponent.transform.position[0].toFixed(2));
      setPosY(selectedComponent.transform.position[1].toFixed(2));
      setPosZ(selectedComponent.transform.position[2].toFixed(2));
      
      // Convert radians to degrees for rotation inputs
      setRotX((selectedComponent.transform.rotation[0] * 180 / Math.PI).toFixed(2));
      setRotY((selectedComponent.transform.rotation[1] * 180 / Math.PI).toFixed(2));
      setRotZ((selectedComponent.transform.rotation[2] * 180 / Math.PI).toFixed(2));
      
      const width = selectedComponent.shape === 'CYLINDER'
        ? String((selectedComponent.properties?.radius || 0.5) * 2)
        : String(selectedComponent.properties?.width || 1);
      
      const length = selectedComponent.shape === 'CYLINDER'
        ? String(selectedComponent.properties?.length || 5)
        : String(selectedComponent.properties?.depth || 1);
        
      setDimWidth(width);
      setDimLength(length);
    }
  }, [selectedComponent]);

  const handleSave = () => {
    if (!selectedComponent) return;
    
    const px = parseFloat(posX);
    const py = parseFloat(posY);
    const pz = parseFloat(posZ);
    const rx = parseFloat(rotX);
    const ry = parseFloat(rotY);
    const rz = parseFloat(rotZ);
    const dw = parseFloat(dimWidth);
    const dl = parseFloat(dimLength);
    
    if (
      isNaN(px) || isNaN(py) || isNaN(pz) || 
      isNaN(rx) || isNaN(ry) || isNaN(rz) || 
      isNaN(dw) || isNaN(dl)
    ) {
      toast.error("Please enter valid numeric values for all fields.");
      return;
    }
    
    // Convert degrees back to radians for store
    const rxRad = rx * Math.PI / 180;
    const ryRad = ry * Math.PI / 180;
    const rzRad = rz * Math.PI / 180;
    
    const updatedProperties = { ...selectedComponent.properties };
    if (selectedComponent.shape === 'CYLINDER') {
      updatedProperties.radius = dw / 2;
      updatedProperties.length = dl;
    } else {
      updatedProperties.width = dw;
      updatedProperties.depth = dl;
    }

    // Regenerate nodes based on new dimensions to keep snapping accurate
    const updatedNodes = selectedComponent.shape === 'CYLINDER'
      ? [
          { id: 'top', localPos: [0, dl / 2, 0] as [number, number, number] },
          { id: 'bottom', localPos: [0, -dl / 2, 0] as [number, number, number] }
        ]
      : (selectedComponent.shape === 'BOX'
          ? [
              { id: 'top', localPos: [0, (updatedProperties.height || 1) / 2, 0] as [number, number, number] },
              { id: 'bottom', localPos: [0, -(updatedProperties.height || 1) / 2, 0] as [number, number, number] },
              { id: 'left', localPos: [-dw / 2, 0, 0] as [number, number, number] },
              { id: 'right', localPos: [dw / 2, 0, 0] as [number, number, number] },
              { id: 'front', localPos: [0, 0, dl / 2] as [number, number, number] },
              { id: 'back', localPos: [0, 0, -dl / 2] as [number, number, number] }
            ]
          : [{ id: 'center', localPos: [0, 0, 0] as [number, number, number] }]);
    
    useSceneStore.getState().updateComponent(selectedComponent.id, {
      transform: {
        position: [px, py, pz],
        rotation: [rxRad, ryRad, rzRad]
      },
      properties: updatedProperties,
      nodes: updatedNodes
    });
    
    toast.success("Component properties saved successfully.");
  };

  return (
    <div className="w-72 border-l bg-card flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="font-semibold flex items-center gap-2">
          <Settings2 className="w-4 h-4" />
          Properties
        </h2>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4">
          {selectedComponent ? (
            <div className="space-y-6">
              
              {/* Identity Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  <Type className="w-4 h-4" /> Identity
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Component ID</Label>
                  <Input value={selectedComponent.id} readOnly className="h-8 font-mono text-xs bg-muted" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Input value={selectedComponent.type} readOnly className="h-8 text-xs bg-muted" />
                </div>
              </div>

              {/* Transform Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  <Move className="w-4 h-4" /> Transform
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Position (m)</Label>
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground w-3 text-center">X</span>
                      <Input value={posX} onChange={(e) => setPosX(e.target.value)} className="h-8 text-xs font-mono px-1.5 text-center" />
                    </div>
                    <div className="flex-1 flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground w-3 text-center">Y</span>
                      <Input value={posY} onChange={(e) => setPosY(e.target.value)} className="h-8 text-xs font-mono px-1.5 text-center" />
                    </div>
                    <div className="flex-1 flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground w-3 text-center">Z</span>
                      <Input value={posZ} onChange={(e) => setPosZ(e.target.value)} className="h-8 text-xs font-mono px-1.5 text-center" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Rotation (deg)</Label>
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground w-3 text-center">X</span>
                      <Input value={rotX} onChange={(e) => setRotX(e.target.value)} className="h-8 text-xs font-mono px-1.5 text-center" />
                    </div>
                    <div className="flex-1 flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground w-3 text-center">Y</span>
                      <Input value={rotY} onChange={(e) => setRotY(e.target.value)} className="h-8 text-xs font-mono px-1.5 text-center" />
                    </div>
                    <div className="flex-1 flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground w-3 text-center">Z</span>
                      <Input value={rotZ} onChange={(e) => setRotZ(e.target.value)} className="h-8 text-xs font-mono px-1.5 text-center" />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Dimensions Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  <Scaling className="w-4 h-4" /> Dimensions
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Diameter / Width (m)</Label>
                  <Input value={dimWidth} onChange={(e) => setDimWidth(e.target.value)} className="h-8 font-mono text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Length (m)</Label>
                  <Input value={dimLength} onChange={(e) => setDimLength(e.target.value)} className="h-8 font-mono text-xs" />
                </div>
              </div>

              {/* Actions Section */}
              <div className="pt-4 border-t flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button 
                    type="button"
                    variant="outline"
                    className="flex-1 flex items-center justify-center gap-1.5 h-9 text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"
                    onClick={handleSave}
                  >
                    <Save className="w-4 h-4" />
                    Save
                  </Button>
                  <Button 
                    type="button"
                    variant="destructive" 
                    className="flex-1 flex items-center justify-center gap-1.5 h-9 text-xs font-semibold"
                    onClick={() => {
                      if (selectedComponent) {
                        useSceneStore.getState().removeComponent(selectedComponent.id);
                        setSelectedIds([]);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </div>
              </div>

            </div>
          ) : (
            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground text-sm text-center space-y-2">
              <BoxSelectIcon className="w-8 h-8 opacity-20" />
              <p>Select a component in the viewport to view its properties.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Simple placeholder icon since BoxSelect is not exported from lucide-react directly if version is old, though it usually is. 
function BoxSelectIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 3a2 2 0 0 0-2 2" />
      <path d="M19 3a2 2 0 0 1 2 2" />
      <path d="M21 19a2 2 0 0 1-2 2" />
      <path d="M5 21a2 2 0 0 1-2-2" />
      <path d="M9 3h1" />
      <path d="M9 21h1" />
      <path d="M14 3h1" />
      <path d="M14 21h1" />
      <path d="M3 9v1" />
      <path d="M21 9v1" />
      <path d="M3 14v1" />
      <path d="M21 14v1" />
    </svg>
  );
}
