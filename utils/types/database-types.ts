//this is just temporary types until can generate them from supabase

export type User = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  created_at: string;
};

export type Module = {
  id: string;
  name: string;
  data: {};
  created_at: string;
};

export type Module_Category = {
  id: string;
  name: string;
  created_at: string;
};

export type Module_Type = {
  id: string;
  name: string;
  created_at: string;
};

// Component Registration and Location Types
export type ComponentType = "PLATFORM" | "PIPELINE";

// Base component registration fields
export interface BaseComponentRegistration {
  componentId: string;
  registrationDate: string;
  lastModified: string;
  status: "active" | "inactive";
}

// Platform-specific location fields
export interface PlatformLocation {
  level: string;
  face: string;
  structuralGroup: string;
  position: string;
}

// Pipeline-specific location fields
export interface PipelineLocation {
  startNode: string;
  startLeg: string;
  endNode: string;
  endLeg: string;
  elevation1: number;
  elevation2: number;
  distance: number;
  clockPosition: string;
}

// Common component fields
export interface CommonComponentFields {
  qId: string;
  description: string;
  installDate: string;
  life: number;
  installedType: string;
  material: string;
  fitting?: string;
  part?: string;
}

// Unified Component Specification
export interface UnifiedComponentSpec extends BaseComponentRegistration, CommonComponentFields {
  componentType: ComponentType;
  // Platform location fields
  level?: string;
  face?: string;
  structuralGroup?: string;
  position?: string;
  // Pipeline location fields
  startNode?: string;
  startLeg?: string;
  endNode?: string;
  endLeg?: string;
  elevation1?: number;
  elevation2?: number;
  distance?: number;
  clockPosition?: string;
  // Component-specific fields
  anodeType?: string;
  weight?: number;
  currentOutput?: number;
}

// View interface for ALLCOMPID
export interface AllComponentID {
  componentId: string;
  componentType: "ANODE_PLAT" | "PIPE_PLAT" | "ANODE_PIPE" | "PIPE_PIPE";
  structureType: "PLATFORM" | "PIPELINE";
  location: PlatformLocation | PipelineLocation;
  status: "active" | "inactive";
}
