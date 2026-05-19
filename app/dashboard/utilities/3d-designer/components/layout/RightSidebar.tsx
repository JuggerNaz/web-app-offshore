"use client";

import { Settings2, Type, Move, RotateCw, Scaling } from "lucide-react";
import { useEditorStore } from "../../store/useEditorStore";
import { useSceneStore } from "../../store/useSceneStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RightSidebar() {
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const components = useSceneStore((state) => state.components);

  const selectedComponent = selectedIds.length > 0 ? components[selectedIds[0]] : null;

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
                    <div className="flex-1 space-y-1"><Input defaultValue="0.00" className="h-8 text-xs font-mono" placeholder="X" /></div>
                    <div className="flex-1 space-y-1"><Input defaultValue="0.00" className="h-8 text-xs font-mono" placeholder="Y" /></div>
                    <div className="flex-1 space-y-1"><Input defaultValue="0.00" className="h-8 text-xs font-mono" placeholder="Z" /></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Rotation (deg)</Label>
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1"><Input defaultValue="0.00" className="h-8 text-xs font-mono" placeholder="X" /></div>
                    <div className="flex-1 space-y-1"><Input defaultValue="0.00" className="h-8 text-xs font-mono" placeholder="Y" /></div>
                    <div className="flex-1 space-y-1"><Input defaultValue="0.00" className="h-8 text-xs font-mono" placeholder="Z" /></div>
                  </div>
                </div>
              </div>
              
              {/* Dimensions Section (Placeholder for Phase 3/4) */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  <Scaling className="w-4 h-4" /> Dimensions
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Diameter / Width (m)</Label>
                  <Input defaultValue="0.5" className="h-8 font-mono text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Length (m)</Label>
                  <Input defaultValue="10.0" className="h-8 font-mono text-xs" />
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
