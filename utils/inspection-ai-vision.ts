/**
 * AI Vision Utilities for Inspection Image Analysis
 * 
 * This module provides functions to analyze inspection images using AI
 * and automatically suggest component conditions and findings.
 */

import { createClient } from '@/utils/supabase/client';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface DetectedIssue {
    type: string; // CORROSION, MARINE_GROWTH, COATING_DAMAGE, etc.
    severity?: string;
    location?: string;
    confidence: number;
    bounding_box?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    description?: string;
    coverage_estimate?: number;
}

export interface AIAnalysisResult {
    overall_condition: string;
    confidence: number;
    detected_issues: DetectedIssue[];
    marine_growth_percentage?: number;
    corrosion_severity?: string;
    coating_condition?: string;
    anode_condition?: string;
    suggested_remarks: string;
    anomaly_detected: boolean;
    anomaly_description?: string;
    raw_response?: string;
}

export interface ImageAnalysis {
    analysis_id: number;
    media_id: number;
    inspection_id?: number;
    ai_provider: string;
    model_version: string;
    analysis_status: string;
    detected_conditions: AIAnalysisResult;
    suggested_overall_condition: string;
    suggested_remarks: string;
    overall_confidence: number;
    anomaly_detected: boolean;
    processing_time_ms: number;
    api_cost_usd?: number;
    created_at: string;
}

export interface QueueItem {
    queue_id: number;
    media_id: number;
    inspection_id?: number;
    priority: number;
    queue_status: string;
    queued_at: string;
}

export interface AnalysisConfig {
    provider?: 'OPENAI_VISION' | 'GOOGLE_CLOUD_VISION' | 'CUSTOM_MODEL';
    model?: string;
    inspectionTypeCode?: string;
    componentType?: string;
    previousCondition?: string;
    autoQueue?: boolean;
    priority?: number;
}

// ============================================================================
// AI VISION ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Analyze an image using AI vision API
 */
export async function analyzeImage(
    mediaId: number,
    inspectionId?: number,
    config: AnalysisConfig = {}
): Promise<ImageAnalysis | QueueItem> {
    const {
        provider = 'OPENAI_VISION',
        model = 'gpt-4-vision-preview',
        inspectionTypeCode,
        componentType,
        previousCondition,
        autoQueue = false,
        priority = 5
    } = config;

    if (autoQueue) {
        // Queue for batch processing
        return queueImageAnalysis(mediaId, inspectionId, priority);
    }

    // Get image URL from media
    const supabase = createClient();
    const { data: media, error: mediaError } = await supabase
        .from('insp_media')
        .select('file_path, file_name')
        .eq('media_id', mediaId)
        .single();

    if (mediaError || !media) {
        throw new Error(`Media not found: ${mediaError?.message}`);
    }

    // Get prompt template
    const prompt = await getAnalysisPrompt(
        inspectionTypeCode,
        componentType,
        previousCondition
    );

    // Call AI provider
    const startTime = Date.now();
    let analysisResult: AIAnalysisResult;
    let apiCost: number = 0;

    try {
        if (provider === 'OPENAI_VISION') {
            analysisResult = await analyzeWithOpenAI(
                media.file_path,
                prompt,
                model
            );
            apiCost = calculateOpenAICost(model, analysisResult.raw_response || '');
        } else if (provider === 'GOOGLE_CLOUD_VISION') {
            analysisResult = await analyzeWithGoogleVision(
                media.file_path,
                prompt
            );
            apiCost = 0.0015; // Approximate cost per image
        } else {
            analysisResult = await analyzeWithCustomModel(
                media.file_path,
                prompt
            );
        }
    } catch (error: any) {
        // Save failed analysis
        const { data: failedAnalysis } = await supabase
            .from('insp_ai_image_analysis')
            .insert({
                media_id: mediaId,
                inspection_id: inspectionId,
                ai_provider: provider,
                model_version: model,
                analysis_status: 'FAILED',
                error_message: error.message,
                processing_time_ms: Date.now() - startTime
            })
            .select()
            .single();

        throw error;
    }

    const processingTime = Date.now() - startTime;

    // Save analysis to database
    const { data: analysis, error: analysisError } = await supabase
        .from('insp_ai_image_analysis')
        .insert({
            media_id: mediaId,
            inspection_id: inspectionId,
            ai_provider: provider,
            model_version: model,
            analysis_status: 'COMPLETED',
            detected_conditions: analysisResult,
            suggested_overall_condition: analysisResult.overall_condition,
            suggested_remarks: analysisResult.suggested_remarks,
            overall_confidence: analysisResult.confidence,
            anomaly_detected: analysisResult.anomaly_detected,
            anomaly_description: analysisResult.anomaly_description,
            processing_time_ms: processingTime,
            api_cost_usd: apiCost
        })
        .select()
        .single();

    if (analysisError) {
        throw new Error(`Failed to save analysis: ${analysisError.message}`);
    }

    return analysis as ImageAnalysis;
}

/**
 * Analyze image with OpenAI Vision API
 */
async function analyzeWithOpenAI(
    imagePath: string,
    prompt: string,
    model: string = 'gpt-4-vision-preview'
): Promise<AIAnalysisResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OpenAI API key not configured');
    }

    // Get signed URL for image
    const supabase = createClient();
    const { data } = await supabase.storage
        .from('inspection-media')
        .createSignedUrl(imagePath, 3600);

    if (!data?.signedUrl) {
        throw new Error('Failed to get image URL');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: prompt
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: data.signedUrl,
                                detail: 'high' // high, low, or auto
                            }
                        }
                    ]
                }
            ],
            max_tokens: 1000,
            response_format: { type: 'json_object' }
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    if (!content) {
        throw new Error('No response from OpenAI');
    }

    const parsedResult = JSON.parse(content);

    return {
        ...parsedResult,
        raw_response: content
    };
}

/**
 * Analyze image with Google Cloud Vision API
 */
async function analyzeWithGoogleVision(
    imagePath: string,
    prompt: string
): Promise<AIAnalysisResult> {
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    if (!apiKey) {
        throw new Error('Google Cloud Vision API key not configured');
    }

    // Get signed URL for image
    const supabase = createClient();
    const { data } = await supabase.storage
        .from('inspection-media')
        .createSignedUrl(imagePath, 3600);

    if (!data?.signedUrl) {
        throw new Error('Failed to get image URL');
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: 'image/jpeg',
                                data: await fetchImageAsBase64(data.signedUrl)
                            }
                        }
                    ]
                }],
                generation_config: {
                    temperature: 0.4,
                    max_output_tokens: 1024
                }
            })
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Google Vision API error: ${error.error?.message || 'Unknown error'}`);
    }

    const result = await response.json();
    const content = result.candidates[0]?.content?.parts[0]?.text;

    if (!content) {
        throw new Error('No response from Google Vision');
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('Invalid JSON response from Google Vision');
    }

    const parsedResult = JSON.parse(jsonMatch[0]);

    return {
        ...parsedResult,
        raw_response: content
    };
}

/**
 * Analyze with custom model (placeholder)
 */
async function analyzeWithCustomModel(
    imagePath: string,
    prompt: string
): Promise<AIAnalysisResult> {
    // Implement custom model integration here
    throw new Error('Custom model not implemented');
}

/**
 * Queue image for batch analysis
 */
export async function queueImageAnalysis(
    mediaId: number,
    inspectionId?: number,
    priority: number = 5
): Promise<QueueItem> {
    const supabase = createClient();

    const { data, error } = await supabase
        .rpc('fn_queue_image_for_analysis', {
            p_media_id: mediaId,
            p_inspection_id: inspectionId,
            p_priority: priority
        });

    if (error) {
        throw new Error(`Failed to queue image: ${error.message}`);
    }

    // Get queue item
    const { data: queueItem } = await supabase
        .from('insp_ai_analysis_queue')
        .select('*')
        .eq('queue_id', data)
        .single();

    return queueItem as QueueItem;
}

/**
 * Get analysis results for a media item
 */
export async function getImageAnalysis(
    mediaId: number
): Promise<ImageAnalysis[]> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('vw_ai_analysis_results')
        .select('*')
        .eq('media_id', mediaId)
        .order('analyzed_at', { ascending: false });

    if (error) {
        throw new Error(`Failed to get analysis: ${error.message}`);
    }

    return data as ImageAnalysis[];
}

/**
 * Get analysis for an inspection
 */
export async function getInspectionAnalyses(
    inspectionId: number
): Promise<ImageAnalysis[]> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('vw_ai_analysis_results')
        .select('*')
        .eq('inspection_id', inspectionId)
        .order('analyzed_at', { ascending: false });

    if (error) {
        throw new Error(`Failed to get analyses: ${error.message}`);
    }

    return data as ImageAnalysis[];
}

/**
 * Apply AI suggestions to inspection record
 */
export async function applyAISuggestions(
    analysisId: number,
    inspectionId: number
): Promise<void> {
    const supabase = createClient();

    // Get analysis
    const { data: analysis } = await supabase
        .from('insp_ai_image_analysis')
        .select('*')
        .eq('analysis_id', analysisId)
        .single();

    if (!analysis) {
        throw new Error('Analysis not found');
    }

    const detected = analysis.detected_conditions as AIAnalysisResult;

    // Update inspection record
    const updateData: any = {};

    if (detected.overall_condition) {
        updateData['inspection_data->overall_condition'] = detected.overall_condition;
    }

    if (detected.marine_growth_percentage !== undefined) {
        updateData['inspection_data->marine_growth_percentage'] = detected.marine_growth_percentage;
    }

    if (detected.corrosion_severity) {
        updateData['inspection_data->corrosion_level'] = detected.corrosion_severity;
    }

    if (detected.coating_condition) {
        updateData['inspection_data->coating_condition'] = detected.coating_condition;
    }

    if (detected.anode_condition) {
        updateData['inspection_data->anode_condition'] = detected.anode_condition;
    }

    if (detected.suggested_remarks) {
        updateData['inspection_data->remarks'] = detected.suggested_remarks;
    }

    const { error } = await supabase
        .from('insp_records')
        .update(updateData)
        .eq('insp_id', inspectionId);

    if (error) {
        throw new Error(`Failed to apply suggestions: ${error.message}`);
    }

    // Mark as applied
    await supabase
        .from('insp_ai_image_analysis')
        .update({
            reviewed_by_human: true,
            ai_accuracy: 'ACCURATE' // Assuming accepted = accurate
        })
        .eq('analysis_id', analysisId);
}

/**
 * Provide feedback on AI analysis accuracy
 */
export async function provideAnalysisFeedback(
    analysisId: number,
    accuracy: 'ACCURATE' | 'PARTIALLY_ACCURATE' | 'INACCURATE',
    feedback?: string,
    reviewer?: string
): Promise<void> {
    const supabase = createClient();

    const { error } = await supabase
        .from('insp_ai_image_analysis')
        .update({
            reviewed_by_human: true,
            human_reviewer: reviewer,
            human_review_date: new Date().toISOString(),
            ai_accuracy: accuracy,
            human_feedback: feedback
        })
        .eq('analysis_id', analysisId);

    if (error) {
        throw new Error(`Failed to save feedback: ${error.message}`);
    }

    // Update model metrics
    const { data: analysis } = await supabase
        .from('insp_ai_image_analysis')
        .select('ai_provider, model_version, cr_date')
        .eq('analysis_id', analysisId)
        .single();

    if (analysis) {
        const metricDate = new Date(analysis.cr_date).toISOString().split('T')[0];
        await supabase.rpc('fn_update_model_metrics', {
            p_ai_provider: analysis.ai_provider,
            p_model_version: analysis.model_version,
            p_metric_date: metricDate
        });
    }
}

/**
 * Get AI analysis prompt template
 */
async function getAnalysisPrompt(
    inspectionTypeCode?: string,
    componentType?: string,
    previousCondition?: string
): Promise<string> {
    const supabase = createClient();

    // Try to get specific template
    let { data: template } = await supabase
        .from('insp_ai_prompt_templates')
        .select('system_prompt, user_prompt_template')
        .eq('inspection_type_code', inspectionTypeCode || '')
        .eq('component_type', componentType || '')
        .eq('is_active', true)
        .limit(1)
        .single();

    // Fallback to generic template
    if (!template) {
        const { data: genericTemplate } = await supabase
            .from('insp_ai_prompt_templates')
            .select('system_prompt, user_prompt_template')
            .is('inspection_type_code', null)
            .is('component_type', null)
            .eq('is_active', true)
            .limit(1)
            .single();

        template = genericTemplate;
    }

    if (!template) {
        // Default prompt if no template found
        return `Analyze this offshore structural component image. Identify any visible defects, estimate marine growth coverage percentage, assess coating condition, detect corrosion, and provide an overall condition rating (EXCELLENT, GOOD, FAIR, POOR, or CRITICAL). Also suggest appropriate remarks for the inspection report. Return your response as JSON with the following structure: {"overall_condition": "string", "confidence": 0.0-1.0, "detected_issues": [], "marine_growth_percentage": number, "suggested_remarks": "string", "anomaly_detected": boolean}`;
    }

    // Build prompt from template
    let prompt = `${template.system_prompt}\n\n${template.user_prompt_template}`;

    // Replace placeholders
    prompt = prompt.replace('{inspection_type}', inspectionTypeCode || 'visual inspection');
    prompt = prompt.replace('{component_type}', componentType || 'structural component');
    prompt = prompt.replace('{previous_condition}', previousCondition || 'not available');

    return prompt;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate OpenAI API cost
 */
function calculateOpenAICost(model: string, response: string): number {
    // Approximate costs (as of 2024)
    const costs: Record<string, { input: number; output: number }> = {
        'gpt-4-vision-preview': { input: 0.01, output: 0.03 }, // per 1K tokens
        'gpt-4': { input: 0.03, output: 0.06 }
    };

    const pricing = costs[model] || costs['gpt-4-vision-preview'];
    const tokens = Math.ceil(response.length / 4); // Rough estimate

    return (tokens / 1000) * pricing.output;
}

/**
 * Fetch image and convert to base64
 */
async function fetchImageAsBase64(url: string): Promise<string> {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return base64;
}

/**
 * Get model performance metrics
 */
export async function getModelMetrics(
    provider: string,
    modelVersion: string,
    days: number = 7
): Promise<any[]> {
    const supabase = createClient();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
        .from('insp_ai_model_metrics')
        .select('*')
        .eq('ai_provider', provider)
        .eq('model_version', modelVersion)
        .gte('metric_date', startDate.toISOString().split('T')[0])
        .order('metric_date', { ascending: false });

    if (error) {
        throw new Error(`Failed to get metrics: ${error.message}`);
    }

    return data;
}

export const AIVision = {
    analyzeImage,
    queueImageAnalysis,
    getImageAnalysis,
    getInspectionAnalyses,
    applyAISuggestions,
    provideAnalysisFeedback,
    getModelMetrics
};

export default AIVision;
