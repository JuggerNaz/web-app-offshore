// Scope of Work (SOW) Types - Redesigned

export interface ReportNumber {
    number: string;
    contractor_ref?: string;
    date?: string;
    notes?: string;
}

export type InspectionStatus =
    | "pending"      // Not started
    | "completed"    // Fully completed
    | "incomplete";  // Started but has issues

export interface ElevationData {
    elevation: string;           // e.g., "EL +10.5", "EL +5.0", or "2.0m - -10.0m"
    start?: number;    // Numeric start elevation
    end?: number;      // Numeric end elevation
    status: InspectionStatus;
    inspection_count: number;
    last_inspection_date?: string;
    notes?: string;
}

// SOW Header - Main record for each structure
export interface SOW {
    id: number;                  // Sequential ID
    jobpack_id: number;          // BIGINT foreign key
    structure_id: number;        // BIGINT foreign key
    structure_type: "PLATFORM" | "PIPELINE";
    structure_title?: string;
    report_numbers: ReportNumber[];
    metadata?: Record<string, any>;

    // Status tracking
    total_items: number;
    completed_items: number;
    incomplete_items: number;
    pending_items: number;

    // Audit fields
    created_at: string;
    created_by?: string;
    updated_at: string;
    updated_by?: string;
}

// SOW Item - Individual component-inspection combination
export interface SOWItem {
    id: number;                  // Sequential ID
    sow_id: number;              // Reference to parent SOW
    component_id: number;        // BIGINT foreign key from structure_components table
    inspection_type_id: number;  // BIGINT foreign key from u_lib_list

    // Denormalized data for performance
    component_qid?: string;
    component_type?: string;
    description?: string;
    s_node?: string;
    f_node?: string;
    s_leg?: string;
    f_leg?: string;
    inspection_code?: string;
    inspection_name?: string;

    // Elevation support
    elevation_required: boolean;
    elevation_data: ElevationData[];

    // Status tracking
    status: InspectionStatus;
    inspection_count: number;
    last_inspection_date?: string;

    // Notes
    notes?: string;
    report_number?: string;

    // Audit fields
    created_at: string;
    created_by?: string;
    updated_at: string;
    updated_by?: string;
}

// Form data for creating/updating SOW
export interface SOWFormData {
    jobpack_id: number;          // BIGINT foreign key
    structure_id: number;        // BIGINT foreign key
    structure_type: "PLATFORM" | "PIPELINE";
    structure_title?: string;
    report_numbers?: ReportNumber[];
    metadata?: Record<string, any>;
}

// Form data for creating/updating SOW items
export interface SOWItemFormData {
    sow_id: number;
    component_id: number;        // BIGINT foreign key
    inspection_type_id: number;  // BIGINT foreign key
    component_qid?: string;
    component_type?: string;
    inspection_code?: string;
    inspection_name?: string;
    elevation_required?: boolean;
    elevation_data?: ElevationData[];
    status?: InspectionStatus;
    notes?: string;
    report_number?: string;
}

// Combined view for display
export interface SOWWithItems extends SOW {
    items: SOWItem[];
}

// Matrix cell for UI display (backward compatibility)
export interface SOWMatrixCell {
    component_id: number;        // BIGINT foreign key
    component_qid: string;
    component_type: string;
    s_node?: string;
    f_node?: string;
    s_leg?: string;
    f_leg?: string;
    inspection_type_id: number;  // BIGINT foreign key
    inspection_code: string;
    inspection_name: string;
    selected: boolean;
    status: InspectionStatus;
    elevation_required: boolean;
    elevation_data: ElevationData[];
    inspection_count: number;
    last_inspection_date?: string;
    notes?: string;
}
