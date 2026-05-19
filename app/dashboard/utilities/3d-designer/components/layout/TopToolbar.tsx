"use client";

import { useEffect, useState } from "react";
import { MousePointer2, BoxSelect, Grid3X3, Save, Undo, Redo, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "../../store/useEditorStore";
import { useSceneStore } from "../../store/useSceneStore";
import { useCommandStore } from "../../store/useCommandStore";
import { toast } from "sonner";

export function TopToolbar() {
  const { activeTool, setActiveTool, snapMode, setSnapMode, selectedPlatformId } = useEditorStore();
  const past = useCommandStore((state) => state.past);
  const future = useCommandStore((state) => state.future);
  const undo = useCommandStore((state) => state.undo);
  const redo = useCommandStore((state) => state.redo);
  const clearHistory = useCommandStore((state) => state.clearHistory);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load Scene Data when platform changes
  useEffect(() => {
    if (!selectedPlatformId) return;

    const loadScene = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/3d-scenes?platform_id=${selectedPlatformId}`);
        const result = await res.json();
        
        if (result.success && result.data) {
          useSceneStore.setState({
            components: result.data.scene_data.components || {},
            hierarchy: result.data.scene_data.hierarchy || []
          });
          clearHistory(); // Clear undo/redo after load
          toast.success("Scene loaded from database");
        } else {
          // If no scene found, just clear it
          useSceneStore.setState({ components: {}, hierarchy: [] });
          clearHistory();
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load scene");
      } finally {
        setIsLoading(false);
      }
    };

    loadScene();
  }, [selectedPlatformId, clearHistory]);

  const handleSave = async () => {
    if (!selectedPlatformId) {
      toast.error("Please select a platform first");
      return;
    }

    setIsSaving(true);
    try {
      const sceneData = {
        components: useSceneStore.getState().components,
        hierarchy: useSceneStore.getState().hierarchy,
      };

      const res = await fetch('/api/3d-scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform_id: selectedPlatformId,
          name: `Platform ${selectedPlatformId} Scene`,
          scene_data: sceneData
        })
      });

      const result = await res.json();
      if (result.success) {
        toast.success("Project saved successfully");
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to save project");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-14 border-b bg-card flex items-center px-4 justify-between">
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-muted p-1 rounded-md">
          <Button 
            variant={activeTool === 'SELECT' ? "secondary" : "ghost"} 
            size="sm" 
            className="h-8"
            onClick={() => setActiveTool('SELECT')}
          >
            <MousePointer2 className="w-4 h-4 mr-2" />
            Select
          </Button>
          <Button 
            variant={activeTool === 'PLACE' ? "secondary" : "ghost"} 
            size="sm" 
            className="h-8"
            onClick={() => setActiveTool('PLACE')}
          >
            <BoxSelect className="w-4 h-4 mr-2" />
            Place
          </Button>
        </div>
        
        <div className="w-px h-6 bg-border mx-2" />
        
        <div className="flex items-center bg-muted p-1 rounded-md">
          <Button 
            variant={snapMode === 'GRID' ? "secondary" : "ghost"} 
            size="sm" 
            className="h-8"
            onClick={() => setSnapMode(snapMode === 'GRID' ? 'FREE' : 'GRID')}
          >
            <Grid3X3 className="w-4 h-4 mr-2" />
            Grid Snap
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mr-2" />}
        
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 w-8 p-0" 
          disabled={past.length === 0}
          onClick={undo}
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 w-8 p-0" 
          disabled={future.length === 0}
          onClick={redo}
          title="Redo"
        >
          <Redo className="w-4 h-4" />
        </Button>
        
        <div className="w-px h-6 bg-border mx-2" />
        
        <Button size="sm" className="h-8" onClick={handleSave} disabled={isSaving || !selectedPlatformId}>
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Project
        </Button>
      </div>
    </div>
  );
}
