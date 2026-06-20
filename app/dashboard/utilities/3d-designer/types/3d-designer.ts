export type ComponentShape = 'CYLINDER' | 'BOX' | 'SPHERE';

export interface ComponentNode {
  id: string;
  type: string; // e.g., 'MEMBER', 'ANODE'
  shape: ComponentShape;
  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
  };
  properties: Record<string, any>; // Dimensions, etc.
  nodes: SnapNode[]; // Connection points
  sourceData?: any;
}

export interface SnapNode {
  id: string;
  localPos: [number, number, number];
}

export interface EditorSettings {
  gridSnap: number;
  nodeSnapRadius: number;
}
