// ============================================================================
// INSPECTION MODULE AI UTILITIES
// ============================================================================
// Description: AI-powered helper functions for smart suggestions and learning
// Created: 2026-02-11
// Version: 1.0
// ============================================================================

import { createClient } from '@/utils/supabase/client';

// ============================================================================
// 1. AUTO-ASSIGNMENT: DIVE/ROV NUMBER GENERATION
// ============================================================================

/**
 * Suggests the next dive or ROV number based on learned patterns
 */
export async function suggestNextNumber(
    userId: string,
    patternType: 'DIVE_NO' | 'DEPLOYMENT_NO'
): Promise<string> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase.rpc('fn_suggest_next_number', {
            p_user_id: userId,
            p_pattern_type: patternType,
        });

        if (error) throw error;
        return data || getDefaultPattern(patternType);
    } catch (error) {
        console.error('Error suggesting next number:', error);
        return getDefaultPattern(patternType);
    }
}

/**
 * Learns from user's custom numbering pattern
 */
export async function learnNumberingPattern(
    userId: string,
    patternType: 'DIVE_NO' | 'DEPLOYMENT_NO',
    sampleValue: string
): Promise<void> {
    const supabase = createClient();

    try {
        await supabase.rpc('fn_learn_numbering_pattern', {
            p_user_id: userId,
            p_pattern_type: patternType,
            p_sample_value: sampleValue,
        });
    } catch (error) {
        console.error('Error learning pattern:', error);
    }
}

/**
 * Default pattern generator
 */
function getDefaultPattern(patternType: 'DIVE_NO' | 'DEPLOYMENT_NO'): string {
    const year = new Date().getFullYear();
    const prefix = patternType === 'DIVE_NO' ? 'DIVE' : 'ROV';
    return `${prefix}-${year}-001`;
}

/**
 * Extract components from pattern (for UI editing)
 */
export function parseNumberPattern(value: string): {
    prefix: string;
    year?: string;
    month?: string;
    sequence: string;
} {
    const yearMatch = value.match(/(\d{4})/);
    const monthMatch = value.match(/(\d{2})/);
    const sequenceMatch = value.match(/(\d{3,})$/);

    const parts = value.split(/\d+/);
    const prefix = parts[0] || '';

    return {
        prefix: prefix.replace(/[-_]$/, ''),
        year: yearMatch?.[1],
        month: monthMatch?.[1],
        sequence: sequenceMatch?.[1] || '001',
    };
}

/**
 * Reconstruct number from components
 */
export function buildNumberFromPattern(parts: {
    prefix: string;
    year?: string;
    month?: string;
    sequence: string;
}): string {
    let result = parts.prefix;
    if (parts.year) result += `-${parts.year}`;
    if (parts.month) result += `-${parts.month}`;
    result += `-${parts.sequence.padStart(3, '0')}`;
    return result;
}

// ============================================================================
// 2. PERSONNEL AUTO-SUGGESTION
// ============================================================================

export interface PersonnelSuggestion {
    primary_person: string;
    supervisor: string;
    coordinator: string;
    confidence: number;
}

/**
 * Suggests personnel based on historical assignments
 */
export async function suggestPersonnel(
    userId: string,
    structureId: number,
    jobType: 'DIVING' | 'ROV'
): Promise<PersonnelSuggestion[]> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase.rpc('fn_suggest_personnel', {
            p_user_id: userId,
            p_structure_id: structureId,
            p_job_type: jobType,
        });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error suggesting personnel:', error);
        return [];
    }
}

/**
 * Learns personnel assignment for future suggestions
 */
export async function learnPersonnelAssignment(
    userId: string,
    structureId: number,
    jobType: 'DIVING' | 'ROV',
    primaryPerson: string,
    supervisor: string,
    coordinator: string
): Promise<void> {
    const supabase = createClient();

    try {
        await supabase.rpc('fn_learn_personnel_assignment', {
            p_user_id: userId,
            p_structure_id: structureId,
            p_job_type: jobType,
            p_primary_person: primaryPerson,
            p_supervisor: supervisor,
            p_coordinator: coordinator,
        });
    } catch (error) {
        console.error('Error learning personnel assignment:', error);
    }
}

// ============================================================================
// 3. TEXT AUTO-COMPLETION FOR INSPECTION FINDINGS
// ============================================================================

export interface TextSuggestion {
    suggestion: string;
    confidence: number;
}

/**
 * Get text suggestions based on partial input
 */
export async function getTextSuggestions(
    inspectionType: string,
    componentType: string,
    fieldName: string,
    partialText: string,
    limit: number = 5
): Promise<TextSuggestion[]> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase.rpc('fn_suggest_text', {
            p_inspection_type: inspectionType,
            p_component_type: componentType,
            p_field_name: fieldName,
            p_partial_text: partialText,
            p_limit: limit,
        });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting text suggestions:', error);
        return [];
    }
}

/**
 * Learn from completed inspection text
 */
export async function learnTextPattern(
    inspectionType: string,
    componentType: string,
    fieldName: string,
    text: string
): Promise<void> {
    const supabase = createClient();

    try {
        await supabase.rpc('fn_learn_text_pattern', {
            p_inspection_type: inspectionType,
            p_component_type: componentType,
            p_field_name: fieldName,
            p_text: text,
        });
    } catch (error) {
        console.error('Error learning text pattern:', error);
    }
}

/**
 * Standard templates for common inspection types (fallback)
 */
export const STANDARD_TEMPLATES: Record<string, Record<string, string[]>> = {
    GVI: {
        remarks: [
            'Overall condition is good with minor marine growth observed.',
            'No visible damage or deformation detected.',
            'Coating in fair condition with minor wear.',
            'Anodes depleted approximately {X}%, require monitoring.',
            'Marine growth coverage estimated at {X}%, cleaning recommended.',
        ],
    },
    CVI: {
        remarks: [
            'Close inspection reveals minor surface corrosion.',
            'No cracks or structural anomalies detected.',
            'Weld integrity appears satisfactory.',
            'Minor pitting observed on surface, depth < 2mm.',
        ],
    },
    CP: {
        remarks: [
            'CP potential reading: -{X}mV vs Ag/AgCl.',
            'Anodes functioning within acceptable range.',
            'Sacrificial anodes show {X}% depletion.',
            'CP system operating effectively.',
        ],
    },
    FMD: {
        remarks: [
            'No indication of flooded member detected.',
            'FMD reading: {X}dB, within normal range.',
            'Member appears dry and intact.',
        ],
    },
};

/**
 * Get standard template suggestions
 */
export function getStandardTemplates(
    inspectionType: string,
    fieldName: string = 'remarks'
): string[] {
    return STANDARD_TEMPLATES[inspectionType]?.[fieldName] || [];
}

// ============================================================================
// 4. VIDEO TAPE COUNTER MANAGEMENT
// ============================================================================

export interface VideoCounter {
    counter_id: number;
    tape_id: number;
    is_running: boolean;
    current_counter_value: number;
    counter_format: 'HH:MM:SS' | 'NUMERIC';
    started_at?: string;
    stopped_at?: string;
}

/**
 * Start virtual tape counter
 */
export async function startVideoCounter(
    tapeId: number,
    counterFormat: 'HH:MM:SS' | 'NUMERIC' = 'HH:MM:SS'
): Promise<number | null> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase.rpc('fn_start_video_counter', {
            p_tape_id: tapeId,
            p_counter_format: counterFormat,
        });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error starting video counter:', error);
        return null;
    }
}

/**
 * Update counter position
 */
export async function updateCounterPosition(
    tapeId: number,
    counterValue: number
): Promise<void> {
    const supabase = createClient();

    try {
        await supabase.rpc('fn_update_counter_position', {
            p_tape_id: tapeId,
            p_counter_value: counterValue,
        });
    } catch (error) {
        console.error('Error updating counter:', error);
    }
}

/**
 * Stop video counter
 */
export async function stopVideoCounter(tapeId: number): Promise<number | null> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase.rpc('fn_stop_video_counter', {
            p_tape_id: tapeId,
        });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error stopping counter:', error);
        return null;
    }
}

/**
 * Format counter value for display
 */
export function formatCounter(
    counterValue: number,
    format: 'HH:MM:SS' | 'NUMERIC' = 'HH:MM:SS'
): string {
    if (format === 'NUMERIC') {
        return counterValue.toString().padStart(8, '0');
    }

    const hours = Math.floor(counterValue / 3600);
    const minutes = Math.floor((counterValue % 3600) / 60);
    const seconds = counterValue % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Parse counter value from string
 */
export function parseCounter(counterString: string): number {
    if (/^\d{8}$/.test(counterString)) {
        // Numeric format
        return parseInt(counterString, 10);
    }

    // HH:MM:SS format
    const parts = counterString.split(':').map((p) => parseInt(p, 10));
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    return 0;
}

/**
 * Get current counter position
 */
export async function getCurrentCounter(tapeId: number): Promise<VideoCounter | null> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from('insp_video_counters')
            .select('*')
            .eq('tape_id', tapeId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error getting counter:', error);
        return null;
    }
}

// ============================================================================
// 5. COMPONENT HISTORICAL DATA
// ============================================================================

export interface ComponentHistory {
    component_id: number;
    structure_id: number;
    total_inspections: number;
    last_inspection_date: string;
    first_inspection_date: string;
    last_inspection_type: string;
    last_inspection_status: string;
    total_anomalies: number;
    last_anomaly_date?: string;
    recent_history: Array<{
        date: string;
        time: string;
        type: string;
        condition?: string;
        has_anomaly: boolean;
    }>;
    avg_marine_growth?: number;
}

/**
 * Get component inspection history
 */
export async function getComponentHistory(
    componentId: number
): Promise<ComponentHistory | null> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from('vw_component_inspection_history')
            .select('*')
            .eq('component_id', componentId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error getting component history:', error);
        return null;
    }
}

/**
 * Get detailed inspection records for component
 */
export async function getComponentInspectionRecords(
    componentId: number,
    limit: number = 10
): Promise<any[]> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from('insp_records')
            .select(`
        insp_id,
        inspection_type_code,
        inspection_date,
        inspection_time,
        inspection_data,
        has_anomaly,
        status,
        cr_user
      `)
            .eq('component_id', componentId)
            .in('status', ['COMPLETED', 'REVIEWED', 'APPROVED'])
            .order('inspection_date', { ascending: false })
            .order('inspection_time', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting inspection records:', error);
        return [];
    }
}

/**
 * Refresh component history materialized view
 */
export async function refreshComponentHistory(): Promise<void> {
    const supabase = createClient();

    try {
        await supabase.rpc('refresh_component_history');
    } catch (error) {
        console.error('Error refreshing component history:', error);
    }
}

/**
 * Generate condition trend summary
 */
export function generateConditionTrend(
    history: ComponentHistory
): {
    trend: 'improving' | 'stable' | 'deteriorating' | 'unknown';
    summary: string;
} {
    if (!history.recent_history || history.recent_history.length < 2) {
        return { trend: 'unknown', summary: 'Insufficient data for trend analysis' };
    }

    const conditions = history.recent_history
        .map((h) => h.condition)
        .filter(Boolean)
        .reverse();

    if (conditions.length < 2) {
        return { trend: 'unknown', summary: 'Insufficient condition data' };
    }

    const conditionScore: Record<string, number> = {
        EXCELLENT: 5,
        GOOD: 4,
        FAIR: 3,
        POOR: 2,
        CRITICAL: 1,
    };

    const scores = conditions.map((c) => conditionScore[c as string] || 3);
    const avgFirst = scores.slice(0, Math.ceil(scores.length / 2))
        .reduce((a, b) => a + b, 0) / Math.ceil(scores.length / 2);
    const avgLast = scores.slice(Math.floor(scores.length / 2))
        .reduce((a, b) => a + b, 0) / Math.ceil(scores.length / 2);

    if (avgLast > avgFirst + 0.5) {
        return {
            trend: 'improving',
            summary: 'Component condition shows improvement over time',
        };
    } else if (avgLast < avgFirst - 0.5) {
        return {
            trend: 'deteriorating',
            summary: 'Component condition is deteriorating, increased monitoring recommended',
        };
    } else {
        return {
            trend: 'stable',
            summary: 'Component condition remains stable',
        };
    }
}

// ============================================================================
// 6. CLIENT-SIDE COUNTER SIMULATION
// ============================================================================

/**
 * Client-side counter manager for real-time UI updates
 */
export class VideoCounterManager {
    private tapeId: number;
    private counterValue: number = 0;
    private isRunning: boolean = false;
    private intervalId: NodeJS.Timeout | null = null;
    private startTime: number = 0;
    private onUpdate?: (value: number) => void;

    constructor(tapeId: number, onUpdate?: (value: number) => void) {
        this.tapeId = tapeId;
        this.onUpdate = onUpdate;
    }

    async start(): Promise<void> {
        if (this.isRunning) return;

        await startVideoCounter(this.tapeId);
        this.startTime = Date.now();
        this.counterValue = 0;
        this.isRunning = true;

        this.intervalId = setInterval(() => {
            this.counterValue = Math.floor((Date.now() - this.startTime) / 1000);
            this.onUpdate?.(this.counterValue);
        }, 1000);
    }

    async stop(): Promise<number> {
        if (!this.isRunning) return this.counterValue;

        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        const finalValue = await stopVideoCounter(this.tapeId);
        return finalValue ?? this.counterValue;
    }

    getCurrentValue(): number {
        return this.counterValue;
    }

    getFormattedValue(format: 'HH:MM:SS' | 'NUMERIC' = 'HH:MM:SS'): string {
        return formatCounter(this.counterValue, format);
    }

    async capturePosition(): Promise<{ counter: number; formatted: string }> {
        const value = this.counterValue;
        await updateCounterPosition(this.tapeId, value);
        return {
            counter: value,
            formatted: formatCounter(value),
        };
    }
}

// ============================================================================
// 7. EXPORT ALL UTILITIES
// ============================================================================

export const InspectionAI = {
    // Auto-assignment
    suggestNextNumber,
    learnNumberingPattern,
    parseNumberPattern,
    buildNumberFromPattern,

    // Personnel
    suggestPersonnel,
    learnPersonnelAssignment,

    // Text suggestions
    getTextSuggestions,
    learnTextPattern,
    getStandardTemplates,

    // Video counter
    startVideoCounter,
    stopVideoCounter,
    updateCounterPosition,
    getCurrentCounter,
    formatCounter,
    parseCounter,
    VideoCounterManager,

    // Component history
    getComponentHistory,
    getComponentInspectionRecords,
    refreshComponentHistory,
    generateConditionTrend,
};

export default InspectionAI;
