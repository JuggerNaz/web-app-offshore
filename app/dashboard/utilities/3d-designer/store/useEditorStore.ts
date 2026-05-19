import { create } from 'zustand';
import { EditorSettings } from '../types/3d-designer';

type ToolType = 'SELECT' | 'PLACE' | 'MEASURE';
type SnapMode = 'NODE' | 'GRID' | 'FREE';

interface EditorState {
  selectedPlatformId: string | null;
  selectedIds: string[];
  activeTool: ToolType;
  snapMode: SnapMode;
  placementGhost: any | null;
  settings: EditorSettings;
  
  setSelectedPlatformId: (id: string | null) => void;
  setSelectedIds: (ids: string[]) => void;
  setActiveTool: (tool: ToolType) => void;
  setSnapMode: (mode: SnapMode) => void;
  setPlacementGhost: (ghost: any | null) => void;
  updateSettings: (updates: Partial<EditorSettings>) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  selectedPlatformId: null,
  selectedIds: [],
  activeTool: 'SELECT',
  snapMode: 'NODE',
  placementGhost: null,
  settings: {
    gridSnap: 1.0,
    nodeSnapRadius: 0.5,
  },
  
  setSelectedPlatformId: (id) => set({ selectedPlatformId: id }),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setSnapMode: (mode) => set({ snapMode: mode }),
  setPlacementGhost: (ghost) => set({ placementGhost: ghost }),
  updateSettings: (updates) => set((state) => ({
    settings: { ...state.settings, ...updates }
  }))
}));
