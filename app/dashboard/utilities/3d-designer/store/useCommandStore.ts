import { create } from 'zustand';
import { useSceneStore } from './useSceneStore';

interface CommandState {
  past: string[];
  future: string[];
  
  takeSnapshot: () => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
}

export const useCommandStore = create<CommandState>((set, get) => ({
  past: [],
  future: [],

  takeSnapshot: () => {
    // Serialize current scene state
    const currentScene = JSON.stringify({
      components: useSceneStore.getState().components,
      hierarchy: useSceneStore.getState().hierarchy,
    });
    
    set((state) => ({
      past: [...state.past, currentScene],
      future: [] // Any action clears future (redo stack)
    }));
  },

  undo: () => {
    set((state) => {
      if (state.past.length === 0) return state;
      
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, state.past.length - 1);
      
      const currentScene = JSON.stringify({
        components: useSceneStore.getState().components,
        hierarchy: useSceneStore.getState().hierarchy,
      });

      // Restore scene
      const parsed = JSON.parse(previous);
      useSceneStore.setState({
        components: parsed.components,
        hierarchy: parsed.hierarchy,
      });

      return {
        past: newPast,
        future: [currentScene, ...state.future]
      };
    });
  },

  redo: () => {
    set((state) => {
      if (state.future.length === 0) return state;
      
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      
      const currentScene = JSON.stringify({
        components: useSceneStore.getState().components,
        hierarchy: useSceneStore.getState().hierarchy,
      });

      // Restore scene
      const parsed = JSON.parse(next);
      useSceneStore.setState({
        components: parsed.components,
        hierarchy: parsed.hierarchy,
      });

      return {
        past: [...state.past, currentScene],
        future: newFuture
      };
    });
  },

  clearHistory: () => set({ past: [], future: [] })
}));
