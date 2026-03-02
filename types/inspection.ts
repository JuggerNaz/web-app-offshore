// ============================================================================
// INSPECTION MODULE TYPESCRIPT TYPE DEFINITIONS
// ============================================================================
// Description: Complete type definitions for the Inspection Module
// Created: 2026-02-11
// Version: 1.0
// ============================================================================

// ============================================================================
// ENUMS
// ============================================================================

export enum InspectionMethod {
    DIVING = 'DIVING',
    ROV = 'ROV',
}

export enum DiveMovementType {
    LEAVING_SURFACE = 'LEAVING_SURFACE',
    AT_WORKSITE = 'AT_WORKSITE',
    LEAVING_WORKSITE = 'LEAVING_WORKSITE',
    BACK_TO_SURFACE = 'BACK_TO_SURFACE',
}

export enum RovMovementType {
    ROV_DEPLOYED = 'ROV_DEPLOYED',
    AT_WORKSITE = 'AT_WORKSITE',
    LEAVING_WORKSITE = 'LEAVING_WORKSITE',
    ROV_RECOVERED = 'ROV_RECOVERED',
}

export enum VideoEventType {
    NEW_LOG_START = 'NEW_LOG_START',
    INTRODUCTION = 'INTRODUCTION',
    PRE_INSPECTION = 'PRE_INSPECTION',
    POST_INSPECTION = 'POST_INSPECTION',
    PAUSE = 'PAUSE',
    RESUME = 'RESUME',
    END = 'END',
}

export enum JobStatus {
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

export enum InspectionStatus {
    DRAFT = 'DRAFT',
    COMPLETED = 'COMPLETED',
    REVIEWED = 'REVIEWED',
    APPROVED = 'APPROVED',
}

export enum AnomalyStatus {
    OPEN = 'OPEN',
    UNDER_REVIEW = 'UNDER_REVIEW',
    APPROVED = 'APPROVED',
    CLOSED = 'CLOSED',
}

export enum SeverityLevel {
    MINOR = 'MINOR',
    MODERATE = 'MODERATE',
    MAJOR = 'MAJOR',
    CRITICAL = 'CRITICAL',
}

export enum MediaType {
    PHOTO = 'PHOTO',
    VIDEO = 'VIDEO',
    DOCUMENT = 'DOCUMENT',
}

export enum MediaSource {
    LIVE_SNAPSHOT = 'LIVE_SNAPSHOT',
    LIVE_VIDEO_CLIP = 'LIVE_VIDEO_CLIP',
    UPLOAD = 'UPLOAD',
}

export enum InspectionTypeCode {
    GVI = 'GVI', // General Visual Inspection
    CVI = 'CVI', // Close Visual Inspection
    FMD = 'FMD', // Flooded Member Detection
    CP = 'CP', // Cathodic Protection
    UTM = 'UTM', // Ultrasonic Thickness Measurement
    MGT = 'MGT', // Marine Growth Thickness
    ADA = 'ADA', // Anode Depletion Assessment
    SDA = 'SDA', // Structural Damage Assessment
}

// ============================================================================
// BASE TYPES
// ============================================================================

export interface BaseEntity {
    workunit: string;
    cr_user: string;
    cr_date: string;
    md_user?: string;
    md_date?: string;
}

// ============================================================================
// DIVE JOB TYPES
// ============================================================================

export interface DiveJob extends BaseEntity {
    dive_job_id: number;
    dive_no: string;
    structure_id: number;
    jobpack_id?: number;
    sow_report_no?: string;
    diver_name: string;
    dive_supervisor: string;
    report_coordinator: string;
    dive_date: string;
    start_time?: string;
    end_time?: string;
    status: JobStatus;
    additional_info?: Record<string, any>;
}

export interface CreateDiveJobInput {
    dive_no: string;
    structure_id: number;
    jobpack_id?: number;
    sow_report_no?: string;
    diver_name: string;
    dive_supervisor: string;
    report_coordinator: string;
    dive_date?: string;
    start_time?: string;
}

export interface DiveMovement extends BaseEntity {
    movement_id: number;
    dive_job_id: number;
    movement_type: DiveMovementType;
    movement_time: string;
    depth_meters?: number;
    remarks?: string;
}

export interface CreateDiveMovementInput {
    dive_job_id: number;
    movement_type: DiveMovementType;
    depth_meters?: number;
    remarks?: string;
}

// ============================================================================
// ROV JOB TYPES
// ============================================================================

export interface RovJob extends BaseEntity {
    rov_job_id: number;
    deployment_no: string;
    structure_id: number;
    jobpack_id?: number;
    sow_report_no?: string;
    rov_serial_no: string;
    rov_operator: string;
    rov_supervisor: string;
    report_coordinator: string;
    deployment_date: string;
    start_time?: string;
    end_time?: string;
    status: JobStatus;
    rov_telemetry?: Record<string, any>;
    additional_info?: Record<string, any>;
}

export interface CreateRovJobInput {
    deployment_no: string;
    structure_id: number;
    jobpack_id?: number;
    sow_report_no?: string;
    rov_serial_no: string;
    rov_operator: string;
    rov_supervisor: string;
    report_coordinator: string;
    deployment_date?: string;
    start_time?: string;
}

export interface RovMovement extends BaseEntity {
    movement_id: number;
    rov_job_id: number;
    movement_type: RovMovementType;
    movement_time: string;
    depth_meters?: number;
    latitude?: number;
    longitude?: number;
    heading_degrees?: number;
    telemetry_data?: Record<string, any>;
    remarks?: string;
}

export interface CreateRovMovementInput {
    rov_job_id: number;
    movement_type: RovMovementType;
    depth_meters?: number;
    latitude?: number;
    longitude?: number;
    heading_degrees?: number;
    telemetry_data?: Record<string, any>;
    remarks?: string;
}

// ============================================================================
// VIDEO RECORDING TYPES
// ============================================================================

export interface VideoTape extends BaseEntity {
    tape_id: number;
    tape_no: string;
    dive_job_id?: number;
    rov_job_id?: number;
    tape_type?: string;
    total_duration_minutes?: number;
    status: string;
}

export interface CreateVideoTapeInput {
    tape_no: string;
    dive_job_id?: number;
    rov_job_id?: number;
    tape_type?: string;
}

export interface VideoLog extends BaseEntity {
    video_log_id: number;
    tape_id: number;
    event_type: VideoEventType;
    event_time: string;
    timecode_start?: string;
    timecode_end?: string;
    inspection_id?: number;
    remarks?: string;
}

export interface CreateVideoLogInput {
    tape_id: number;
    event_type: VideoEventType;
    timecode_start?: string;
    timecode_end?: string;
    inspection_id?: number;
    remarks?: string;
}

// ============================================================================
// INSPECTION RECORD TYPES
// ============================================================================

export interface InspectionRecord extends BaseEntity {
    insp_id: number;
    dive_job_id?: number;
    rov_job_id?: number;
    structure_id: number;
    component_id: number;
    component_type?: string;
    jobpack_id?: number;
    sow_report_no?: string;
    inspection_type_code: InspectionTypeCode | string;
    inspection_date: string;
    inspection_time: string;
    tape_count_no?: number;
    tape_id?: number;
    elevation?: number;
    fp_kp?: string;
    inspection_data: InspectionData;
    has_anomaly: boolean;
    status: InspectionStatus;
    reviewed_by?: string;
    reviewed_date?: string;
    approved_by?: string;
    approved_date?: string;
}

export interface InspectionData {
    // Migration compatibility keys
    inspno?: string;
    str_id?: string;
    comp_id?: string;
    insp_id?: string;

    // Dynamic inspection fields based on type
    overall_condition?: string;
    marine_growth_percentage?: number;
    corrosion_level?: string;
    coating_condition?: string;
    anode_condition?: string;
    thickness_readings?: number[];
    cp_potential?: number;
    flooded_member_indication?: boolean;
    remarks?: string;

    // Allow any additional fields
    [key: string]: any;
}

export interface CreateInspectionInput {
    dive_job_id?: number;
    rov_job_id?: number;
    structure_id: number;
    component_id: number;
    component_type?: string;
    jobpack_id?: number;
    sow_report_no?: string;
    inspection_type_code: InspectionTypeCode | string;
    inspection_date?: string;
    inspection_time?: string;
    tape_count_no?: number;
    tape_id?: number;
    elevation?: number;
    fp_kp?: string;
    inspection_data: Partial<InspectionData>;
}

export interface UpdateInspectionInput {
    inspection_data?: Partial<InspectionData>;
    has_anomaly?: boolean;
    status?: InspectionStatus;
}

// ============================================================================
// ANOMALY/DEFECT TYPES
// ============================================================================

export interface Anomaly extends BaseEntity {
    anomaly_id: number;
    anomaly_ref_no: string;
    inspection_id: number;
    defect_type_code: string;
    priority_code: string;
    defect_category_code: string;
    defect_description: string;
    severity?: SeverityLevel;
    recommended_action?: string;
    action_priority?: string;
    action_deadline?: string;
    status: AnomalyStatus;
    follow_up_required: boolean;
    follow_up_notes?: string;
    reviewed_by?: string;
    reviewed_date?: string;
    approved_by?: string;
    approved_date?: string;
    closed_by?: string;
    closed_date?: string;
}

export interface CreateAnomalyInput {
    inspection_id: number;
    defect_type_code: string;
    priority_code: string;
    defect_category_code: string;
    defect_description: string;
    severity?: SeverityLevel;
    recommended_action?: string;
    action_priority?: string;
    action_deadline?: string;
    follow_up_required?: boolean;
    follow_up_notes?: string;
}

export interface UpdateAnomalyInput {
    defect_description?: string;
    severity?: SeverityLevel;
    recommended_action?: string;
    action_priority?: string;
    action_deadline?: string;
    status?: AnomalyStatus;
    follow_up_required?: boolean;
    follow_up_notes?: string;
}

// ============================================================================
// MEDIA TYPES
// ============================================================================

export interface Media extends BaseEntity {
    media_id: number;
    inspection_id?: number;
    anomaly_id?: number;
    media_type: MediaType;
    file_name: string;
    file_path: string;
    file_size_bytes?: number;
    mime_type?: string;
    captured_at: string;
    captured_by?: string;
    source?: MediaSource;
    thumbnail_path?: string;
    description?: string;
}

export interface CreateMediaInput {
    inspection_id?: number;
    anomaly_id?: number;
    media_type: MediaType;
    file_name: string;
    file_path: string;
    file_size_bytes?: number;
    mime_type?: string;
    source?: MediaSource;
    description?: string;
}

// ============================================================================
// VIEW TYPES (for queries)
// ============================================================================

export interface DiveInspectionView {
    insp_id: number;
    inspno: string;
    dive_no: string;
    dive_date: string;
    diver_name: string;
    dive_supervisor: string;
    structure_name: string;
    component_name: string;
    inspection_type_code: string;
    inspection_date: string;
    inspection_time: string;
    has_anomaly: boolean;
    status: InspectionStatus;
    inspection_data: InspectionData;
    cr_user: string;
    cr_date: string;
}

export interface RovInspectionView {
    insp_id: number;
    inspno: string;
    deployment_no: string;
    deployment_date: string;
    rov_serial_no: string;
    rov_operator: string;
    rov_supervisor: string;
    structure_name: string;
    component_name: string;
    inspection_type_code: string;
    inspection_date: string;
    inspection_time: string;
    has_anomaly: boolean;
    status: InspectionStatus;
    inspection_data: InspectionData;
    cr_user: string;
    cr_date: string;
}

export interface AnomalyDetailView {
    anomaly_id: number;
    anomaly_ref_no: string;
    defect_type_code: string;
    priority_code: string;
    defect_category_code: string;
    defect_description: string;
    severity: SeverityLevel;
    anomaly_status: AnomalyStatus;
    insp_id: number;
    inspno: string;
    inspection_type_code: string;
    structure_name: string;
    component_name: string;
    inspection_date: string;
    recommended_action?: string;
    action_priority?: string;
    action_deadline?: string;
    cr_user: string;
    cr_date: string;
    reviewed_by?: string;
    reviewed_date?: string;
}

// ============================================================================
// COMPONENT SELECTION & AI SUGGESTION TYPES
// ============================================================================

export interface ComponentSuggestion {
    component_id: number;
    comp_name: string;
    comp_type: string;
    distance_meters?: number;
    is_inspected: boolean;
    in_sow: boolean;
    last_inspection_date?: string;
    priority_score: number; // Calculated score for sorting
}

export interface ComponentSelectionFilter {
    structure_id: number;
    jobpack_id?: number;
    sow_only?: boolean;
    not_inspected_only?: boolean;
    current_component_id?: number;
    search_term?: string;
}

// ============================================================================
// LIVE VIDEO TYPES
// ============================================================================

export interface LiveVideoConnection {
    connected: boolean;
    camera_id?: string;
    camera_name?: string;
    stream_url?: string;
    connection_time?: string;
    status: 'connected' | 'disconnected' | 'error';
}

export interface SnapshotCapture {
    media_id: number;
    file_path: string;
    captured_at: string;
    thumbnail_path?: string;
}

export interface VideoClipCapture {
    media_id: number;
    file_path: string;
    duration_seconds: number;
    captured_at: string;
    thumbnail_path?: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> {
    success: boolean;
    data: T[];
    pagination: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    };
}

// ============================================================================
// INSPECTION TYPE CONFIGURATION
// ============================================================================

export interface InspectionTypeConfig {
    code: InspectionTypeCode | string;
    name: string;
    description: string;
    fields: InspectionField[];
    requires_video: boolean;
    requires_photos: boolean;
}

export interface InspectionField {
    field_name: string;
    display_label: string;
    field_type: 'text' | 'number' | 'select' | 'multiselect' | 'textarea' | 'date' | 'time' | 'boolean';
    required: boolean;
    options?: string[]; // For select/multiselect
    validation?: {
        min?: number;
        max?: number;
        pattern?: string;
        custom?: string;
    };
    default_value?: any;
    help_text?: string;
}

// ============================================================================
// LIBRARY INTEGRATION TYPES (for defects, priorities, etc.)
// ============================================================================

export interface DefectLibraryItem {
    lib_code: string;
    descr: string;
    value1?: string;
    value2?: string;
    value3?: string;
}

export interface PriorityLibraryItem {
    lib_code: string;
    descr: string;
    priority_level: number;
}


