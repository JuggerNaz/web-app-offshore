"use client";

import useSWR from "swr";
import { Box, Layers, Plus, Loader2 } from "lucide-react";
import { useEditorStore } from "../../store/useEditorStore";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function LeftSidebar() {
  const { setActiveTool, selectedPlatformId, setSelectedPlatformId } = useEditorStore();

  // Fetch all platforms
  const { data: platformsData, isLoading: isLoadingPlatforms } = useSWR(
    "/api/structures?type=PLATFORM",
    fetcher
  );
  
  // Fetch components for selected platform
  const { data: componentsData, isLoading: isLoadingComponents } = useSWR(
    selectedPlatformId ? `/api/structure-components/${selectedPlatformId}` : null,
    fetcher
  );

  const platforms = platformsData?.data || [];
  const components = componentsData?.data || [];

  return (
    <div className="w-72 border-r bg-card flex flex-col h-full">
      <div className="p-4 border-b space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Layers className="w-4 h-4" />
          Component Library
        </h2>
        
        {isLoadingPlatforms ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading platforms...
          </div>
        ) : (
          <Select 
            value={selectedPlatformId || undefined} 
            onValueChange={setSelectedPlatformId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Platform" />
            </SelectTrigger>
            <SelectContent>
              {platforms.map((p: any) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {p.str_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {!selectedPlatformId && (
            <div className="text-sm text-muted-foreground text-center mt-4">
              Please select a platform above to view components.
            </div>
          )}

          {selectedPlatformId && isLoadingComponents && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading components...
            </div>
          )}

          {selectedPlatformId && !isLoadingComponents && components.length === 0 && (
            <div className="text-sm text-muted-foreground text-center mt-4">
              No components found for this platform.
            </div>
          )}

          {selectedPlatformId && !isLoadingComponents && components.map((comp: any) => (
            <div 
              key={comp.id}
              className="border rounded-md p-3 hover:bg-muted cursor-pointer transition-colors flex items-center gap-3 group"
              onClick={() => {
                setActiveTool('PLACE');
                
                const shape = comp.component_type === 'ANODE' ? 'BOX' : 'CYLINDER';
                const length = 10;
                // Generate nodes for snapping. For a cylinder along Y-axis:
                const nodes = shape === 'CYLINDER' ? [
                  { id: 'top', localPos: [0, length / 2, 0] as [number, number, number] },
                  { id: 'bottom', localPos: [0, -length / 2, 0] as [number, number, number] }
                ] : [];

                useEditorStore.getState().setPlacementGhost({
                  type: comp.component_type || 'MEMBER',
                  shape: shape,
                  properties: { radius: 0.5, length: length, width: 1, height: 1, depth: 2 },
                  sourceData: comp,
                  nodes: nodes
                });
              }}
            >
              <div className="w-8 h-8 shrink-0 rounded bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Box className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" title={comp.component_name || comp.code}>
                  {comp.component_name || comp.code || "Unknown Component"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  Type: {comp.component_type || "Generic"}
                </p>
              </div>
              <Plus className="w-4 h-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
