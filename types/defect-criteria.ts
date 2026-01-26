/**
 * Defect/Anomaly Criteria Management System - Type Definitions
 * 
 * This file contains all TypeScript interfaces for the flexible, user-defined
 * defect criteria system that allows clients to configure inspection rules
 * without code changes.
 */

// ============================================================================
// LIBRARY DATA (From U_LIB_LIST)
// ============================================================================

export interface LibraryItem {
    lib_id: string;
    lib_code: string;
    lib_desc: string;
    lib_delete: string;
}

// ============================================================================
// DEFECT CRITERIA PROCEDURES
// ============================================================================

export type ProcedureStatus = 'draft' | 'active' | 'archived';

export interface DefectCriteriaProcedure {
    id: string;                    // BIGINT from sequence (transmitted as string in JSON)
    procedureNumber: string;       // e.g., "DC-001", "DC-002"
    procedureName: string;         // e.g., "Baseline Inspection Criteria 2024"
    version: number;               // Auto-increment per procedure
    effectiveDate: Date;           // When this version becomes active
    createdBy: string;
    createdAt: Date;
    status: ProcedureStatus;
    notes?: string;
}

// ============================================================================
// DEFECT CRITERIA RULES
// ============================================================================

export type ThresholdOperator = '>' | '<' | '>=' | '<=' | '==' | '!=';

export interface DefectCriteriaRule {
    id: string;                    // BIGINT from sequence (transmitted as string in JSON)
    procedureId: string;           // FK to defect_criteria_procedures (transmitted as string in JSON)
    structureGroup: string;        // Primary Member, Secondary Member, etc.
    priorityId: string;            // LIB_ID from U_LIB_LIST (AMLY_TYP)
    defectCodeId: string;          // LIB_ID from U_LIB_LIST (AMLY_COD)
    defectTypeId: string;          // LIB_ID from U_LIB_LIST (AMLY_FND)
    jobpackType?: string;          // Baseline, Routine, etc. (optional)
    elevationMin?: number;         // Optional elevation range
    elevationMax?: number;
    nominalThickness?: number;     // For PD (Physical Damage)
    thresholdValue?: number;       // Trigger value
    thresholdText?: string;        // Text trigger value
    thresholdOperator?: ThresholdOperator;
    customParameters?: Record<string, any>; // Dynamic custom parameters (JSON)
    autoFlag: boolean;             // Auto-flag on match
    alertMessage: string;          // Message to show user
    order: number;                 // Rule evaluation order
    evaluationPriority: number;    // Priority for conflict resolution (higher = more important)
}

// ============================================================================
// CUSTOM PARAMETERS
// ============================================================================

export type CustomParameterType = 'number' | 'text' | 'boolean' | 'date';

export interface ValidationRules {
    min?: number;
    max?: number;
    regex?: string;
    required?: boolean;
}

export interface DefectCriteriaCustomParam {
    id: string;                    // BIGINT from sequence (transmitted as string in JSON)
    procedureId: string;           // FK to defect_criteria_procedures
    parameterName: string;         // e.g., "coating_thickness", "corrosion_rate"
    parameterLabel: string;        // Display name
    parameterType: CustomParameterType;
    parameterUnit?: string;        // mm, %, kg, etc.
    validationRules?: ValidationRules;
    description: string;
    isActive: boolean;
    createdAt: Date;
}

// ============================================================================
// UI HELPER TYPES
// ============================================================================

// For the rule builder form
export interface RuleFormData {
    structureGroup: string;
    priorityId: string;
    defectCodeId: string;
    defectTypeId: string;
    jobpackType?: string;
    elevationMin?: number;
    elevationMax?: number;
    nominalThickness?: number;
    thresholdValue?: number;
    thresholdText?: string;
    thresholdOperator?: ThresholdOperator;
    customParameters?: Record<string, any>;
    autoFlag: boolean;
    alertMessage: string;
    evaluationPriority: number;
}

// For procedure creation/editing
export interface ProcedureFormData {
    procedureNumber: string;
    procedureName: string;
    effectiveDate: Date;
    copyFromProcedureId?: string;  // Optional: copy rules from existing procedure
    notes?: string;
}

// For validation results
export interface ValidationResult {
    isValid: boolean;
    matchedRules: DefectCriteriaRule[];
    highestPriorityRule?: DefectCriteriaRule;
    shouldAutoFlag: boolean;
    alertMessage?: string;
}

// For override dialog
export interface OverrideRequest {
    defectFlagId: string;          // BIGINT reference (transmitted as string)
    fieldChanged: string;
    originalValue: any;
    newValue: any;
    reason: string;
}
