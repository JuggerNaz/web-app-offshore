import { create } from 'zustand';
import { ComponentNode } from '../types/3d-designer';
import { useCommandStore } from './useCommandStore';

interface SceneState {
  components: Record<string, ComponentNode>;
  hierarchy: string[]; // Root IDs
  addComponent: (comp: ComponentNode) => void;
  updateComponent: (id: string, updates: Partial<ComponentNode>) => void;
  removeComponent: (id: string) => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  components: {
    'demo_1': {
      id: 'demo_1',
      type: 'MEMBER',
      shape: 'CYLINDER',
      transform: {
        position: [0, 2.5, 0], // Elevated so it sits on the grid (length 5 / 2)
        rotation: [0, 0, 0]
      },
      properties: { radius: 0.5, length: 5 },
      nodes: []
    }
  },
  hierarchy: ['demo_1'],
  
  addComponent: (comp) => {
    useCommandStore.getState().takeSnapshot();
    set((state) => ({
      components: { ...state.components, [comp.id]: comp },
      hierarchy: [...state.hierarchy, comp.id]
    }));
  },

  updateComponent: (id, updates) => {
    useCommandStore.getState().takeSnapshot();
    set((state) => {
      if (!state.components[id]) return state;
      return {
        components: {
          ...state.components,
          [id]: { ...state.components[id], ...updates }
        }
      };
    });
  },

  removeComponent: (id) => {
    useCommandStore.getState().takeSnapshot();
    set((state) => {
      const newComponents = { ...state.components };
      delete newComponents[id];
      return {
        components: newComponents,
        hierarchy: state.hierarchy.filter(hid => hid !== id)
      };
    });
  }
}));
