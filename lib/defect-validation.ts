/**
 * Defect Criteria Validation Engine
 * 
 * This module provides a flexible, generic validation framework that evaluates
 * user-defined defect criteria rules without hardcoded validations.
 * 
 * Design Philosophy:
 * - All validation logic is driven by user-configured rules
 * - No hardcoded thresholds or conditions
 * - Supports dynamic custom parameters
 * - Priority-based rule conflict resolution
 * - Complete audit trail for overrides
 */

import { createClient } from '@/utils/supabase/client';
import type {
    DefectCriteriaProcedure,
    DefectCriteriaRule,
    DefectCriteriaRuleDisplay,
    InspectionDefectFlag,
    DefectOverrideAuditLog,
    ValidationResult,
    OverrideRequest,
    LibraryItem,
    DefectPriority,
    DefectCode,
    DefectType,
    LibraryCombo,
} from '@/types/defect-criteria';

// ============================================================================
// LIBRARY DATA FETCHERS (U_LIB_LIST)
// ============================================================================

/**
 * Fetch defect priorities from library
 * Source: U_LIB_LIST where LIB_CODE = 'AMLY_TYP'
 */
export async function getDefectPriorities(): Promise<DefectPriority[]> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('u_lib_list')
        .select('*')
        .eq('lib_code', 'AMLY_TYP')
        .neq('lib_delete', '1')
        .order('lib_desc');

    if (error) {
        console.error('Error fetching defect priorities:', error);
        return [];
    }

    return data as DefectPriority[];
}

/**
 * Fetch defect codes from library
 * Source: U_LIB_LIST where LIB_CODE = 'AMLY_COD'
 * @param structureType - 'platform' or 'pipeline'
 */
export async function getDefectCodes(structureType: 'platform' | 'pipeline'): Promise<DefectCode[]> {
    const supabase = createClient();

    let query = supabase
        .from('u_lib_list')
        .select('*')
        .eq('lib_code', 'AMLY_COD')
        .neq('lib_delete', '1');

    // Platform: exclude codes with 'PIPELINE' in description
    if (structureType === 'platform') {
        query = query.not('lib_desc', 'ilike', '%PIPELINE%');
    }

    const { data, error } = await query.order('lib_desc');

    if (error) {
        console.error('Error fetching defect codes:', error);
        return [];
    }

    return data as DefectCode[];
}

/**
 * Fetch defect types for a specific defect code
 * Source: U_LIB_LIST where LIB_CODE = 'AMLY_FND'
 * Uses: U_LIB_COMBO where LIB_CODE = 'AMLYCODFND' for filtering
 * @param defectCodeId - The LIB_ID of the selected defect code
 */
export async function getDefectTypes(defectCodeId: string): Promise<DefectType[]> {
    const supabase = createClient();

    // First, get the valid combinations from U_LIB_COMBO
    const { data: combos, error: comboError } = await supabase
        .from('u_lib_combo')
        .select('code_2')
        .eq('lib_code', 'AMLYCODFND')
        .eq('code_1', defectCodeId);

    if (comboError) {
        console.error('Error fetching defect type combinations:', comboError);
        return [];
    }

    if (!combos || combos.length === 0) {
        return [];
    }

    // Extract the valid type IDs
    const validTypeIds = combos.map(c => c.code_2);

    // Fetch the actual defect types
    const { data, error } = await supabase
        .from('u_lib_list')
        .select('*')
        .eq('lib_code', 'AMLY_FND')
        .neq('lib_delete', '1')
        .in('lib_id', validTypeIds)
        .order('lib_desc');

    if (error) {
        console.error('Error fetching defect types:', error);
        return [];
    }

    return data as DefectType[];
}

/**
 * Get library item by ID (for display purposes)
 */
export async function getLibraryItem(libId: string): Promise<LibraryItem | null> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('u_lib_list')
        .select('*')
        .eq('lib_id', libId)
        .single();

    if (error) {
        console.error('Error fetching library item:', error);
        return null;
    }

    return data as LibraryItem;
}

// ============================================================================
// PROCEDURE MANAGEMENT
// ============================================================================

/**
 * Get the applicable procedure for a given inspection date
 * Returns the most recent procedure that was effective on or before the inspection date
 */
export async function getApplicableProcedure(
    inspectionDate: Date
): Promise<DefectCriteriaProcedure | null> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('defect_criteria_procedures')
        .select('*')
        .eq('status', 'active')
        .lte('effective_date', inspectionDate.toISOString())
        .order('effective_date', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        console.error('Error fetching applicable procedure:', error);
        return null;
    }

    return data as DefectCriteriaProcedure;
}

/**
 * Get all rules for a specific procedure, ordered by evaluation priority
 */
export async function getProcedureRules(
    procedureId: string | number
): Promise<DefectCriteriaRule[]> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('defect_criteria_rules')
        .select('*')
        .eq('procedure_id', procedureId)
        .order('evaluation_priority', { ascending: false })
        .order('rule_order', { ascending: true });

    if (error) {
        console.error('Error fetching procedure rules:', error);
        return [];
    }

    return data as DefectCriteriaRule[];
}

/**
 * Enrich rules with library labels for display
 */
export async function enrichRulesWithLabels(
    rules: DefectCriteriaRule[]
): Promise<DefectCriteriaRuleDisplay[]> {
    const enrichedRules: DefectCriteriaRuleDisplay[] = [];

    for (const rule of rules) {
        const [priority, defectCode, defectType] = await Promise.all([
            getLibraryItem(rule.priorityId),
            getLibraryItem(rule.defectCodeId),
            getLibraryItem(rule.defectTypeId),
        ]);

        enrichedRules.push({
            ...rule,
            priorityLabel: priority?.lib_desc || 'Unknown',
            defectCodeLabel: defectCode?.lib_desc || 'Unknown',
            defectTypeLabel: defectType?.lib_desc || 'Unknown',
        });
    }

    return enrichedRules;
}

// ============================================================================
// VALIDATION ENGINE
// ============================================================================

/**
 * Filter rules that are applicable to the current inspection context
 */
function filterApplicableRules(
    rules: DefectCriteriaRule[],
    context: {
        structureGroup: string;
        jobpackType?: string;
        elevation?: number;
    }
): DefectCriteriaRule[] {
    return rules.filter(rule => {
        // Check structure group match
        if (rule.structureGroup !== context.structureGroup) {
            return false;
        }

        // Check jobpack type if specified in rule
        if (rule.jobpackType && rule.jobpackType !== context.jobpackType) {
            return false;
        }

        // Check elevation range if specified in rule
        if (context.elevation !== undefined) {
            if (rule.elevationMin != null && context.elevation < rule.elevationMin) {
                return false;
            }
            if (rule.elevationMax != null && context.elevation > rule.elevationMax) {
                return false;
            }
        }

        return true;
    });
}

/**
 * Evaluate a single rule's threshold condition
 */
function evaluateThreshold(
    value: number,
    operator: string,
    threshold: number
): boolean {
    switch (operator) {
        case '>': return value > threshold;
        case '<': return value < threshold;
        case '>=': return value >= threshold;
        case '<=': return value <= threshold;
        case '==': return value === threshold;
        case '!=': return value !== threshold;
        default: return false;
    }
}

/**
 * Evaluate custom parameters against rule conditions
 */
function evaluateCustomParameters(
    actualParams: Record<string, any>,
    ruleParams: Record<string, any>
): boolean {
    // If no custom parameters defined in rule, pass validation
    if (!ruleParams || Object.keys(ruleParams).length === 0) {
        return true;
    }

    // Check each custom parameter condition
    for (const [key, expectedValue] of Object.entries(ruleParams)) {
        const actualValue = actualParams[key];

        // If parameter is missing, fail validation
        if (actualValue === undefined) {
            return false;
        }

        // Compare values (supports objects with operator/value structure)
        if (typeof expectedValue === 'object' && expectedValue.operator && expectedValue.value !== undefined) {
            if (typeof actualValue === 'number') {
                if (!evaluateThreshold(actualValue, expectedValue.operator, expectedValue.value)) {
                    return false;
                }
            }
        } else {
            // Direct comparison
            if (actualValue !== expectedValue) {
                return false;
            }
        }
    }

    return true;
}

/**
 * Resolve conflicts when multiple rules match
 * Returns the highest priority rule
 */
function resolveRuleConflicts(
    matchedRules: DefectCriteriaRule[]
): DefectCriteriaRule | undefined {
    if (matchedRules.length === 0) {
        return undefined;
    }

    if (matchedRules.length === 1) {
        return matchedRules[0];
    }

    // Rules are already sorted by evaluation_priority DESC, rule_order ASC
    // So the first rule is the highest priority
    return matchedRules[0];
}

/**
 * Main validation function
 * Evaluates inspection data against all applicable criteria rules
 */
export async function evaluateCriteria(
    inspectionData: {
        inspectionDate: Date;
        structureGroup: string;
        jobpackType?: string;
        elevation?: number;
        measurementValue?: number;
        customParameters?: Record<string, any>;
    }
): Promise<ValidationResult> {
    // Get applicable procedure based on inspection date
    const procedure = await getApplicableProcedure(inspectionData.inspectionDate);

    if (!procedure) {
        return {
            isValid: true,
            matchedRules: [],
            shouldAutoFlag: false,
        };
    }

    // Get all rules for this procedure
    const allRules = await getProcedureRules(procedure.id);

    // Filter to applicable rules based on context
    const applicableRules = filterApplicableRules(allRules, {
        structureGroup: inspectionData.structureGroup,
        jobpackType: inspectionData.jobpackType,
        elevation: inspectionData.elevation,
    });

    // Evaluate each applicable rule
    const matchedRules: DefectCriteriaRule[] = [];

    for (const rule of applicableRules) {
        let ruleMatches = true;

        // Evaluate threshold condition if defined
        if (
            rule.thresholdOperator &&
            rule.thresholdValue != null &&
            inspectionData.measurementValue !== undefined
        ) {
            ruleMatches = evaluateThreshold(
                inspectionData.measurementValue,
                rule.thresholdOperator,
                rule.thresholdValue
            );
        }

        // Evaluate custom parameters if defined
        if (ruleMatches && rule.customParameters && inspectionData.customParameters) {
            ruleMatches = evaluateCustomParameters(
                inspectionData.customParameters,
                rule.customParameters
            );
        }

        if (ruleMatches) {
            matchedRules.push(rule);
        }
    }

    // Resolve conflicts (get highest priority rule)
    const highestPriorityRule = resolveRuleConflicts(matchedRules);

    return {
        isValid: matchedRules.length === 0,
        matchedRules,
        highestPriorityRule,
        shouldAutoFlag: highestPriorityRule?.autoFlag || false,
        alertMessage: highestPriorityRule?.alertMessage,
    };
}

// ============================================================================
// DEFECT FLAGGING
// ============================================================================

/**
 * Create a defect flag record
 */
export async function flagDefect(
    inspectionId: string,
    eventId: string,
    procedureId: string | number,
    ruleId: string | number,
    autoFlagged: boolean = true
): Promise<InspectionDefectFlag | null> {
    const supabase = createClient();

    const flagData = {
        inspection_id: inspectionId,
        event_id: eventId,
        procedure_id: procedureId,
        rule_id: ruleId,
        auto_flagged: autoFlagged,
        overridden: false,
    };

    const { data, error } = await supabase
        .from('inspection_defect_flags')
        .insert(flagData)
        .select()
        .single();

    if (error) {
        console.error('Error creating defect flag:', error);
        return null;
    }

    return data as InspectionDefectFlag;
}

// ============================================================================
// OVERRIDE AUDIT LOGGING
// ============================================================================

/**
 * Log a defect flag override to the audit trail
 */
export async function logOverride(
    request: OverrideRequest,
    userId: string,
    ipAddress?: string,
    sessionId?: string
): Promise<DefectOverrideAuditLog | null> {
    const supabase = createClient();

    const auditData = {
        defect_flag_id: request.defectFlagId,
        user_id: userId,
        field_changed: request.fieldChanged,
        original_value: String(request.originalValue),
        new_value: String(request.newValue),
        reason: request.reason,
        ip_address: ipAddress,
        session_id: sessionId,
    };

    const { data, error } = await supabase
        .from('defect_override_audit_log')
        .insert(auditData)
        .select()
        .single();

    if (error) {
        console.error('Error logging override:', error);
        return null;
    }

    // Also update the defect flag to mark it as overridden
    await supabase
        .from('inspection_defect_flags')
        .update({ overridden: true, override_reason: request.reason })
        .eq('id', request.defectFlagId);

    return data as DefectOverrideAuditLog;
}

/**
 * Get override audit trail for a defect flag
 */
export async function getOverrideAuditTrail(
    defectFlagId: string | number
): Promise<DefectOverrideAuditLog[]> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('defect_override_audit_log')
        .select('*')
        .eq('defect_flag_id', defectFlagId)
        .order('override_timestamp', { ascending: false });

    if (error) {
        console.error('Error fetching override audit trail:', error);
        return [];
    }

    return data as DefectOverrideAuditLog[];
}
