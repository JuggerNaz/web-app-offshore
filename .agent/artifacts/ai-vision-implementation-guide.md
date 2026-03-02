# AI Vision for Inspection Images - Implementation Guide

## 🎯 Overview

This AI Vision system automatically analyzes inspection images to detect component conditions, identify defects, and suggest findings. It uses advanced computer vision models (OpenAI GPT-4 Vision, Google Gemini Pro Vision, or custom models) to provide instant, accurate assessments.

---

## ✨ Key Features

### **1. Automatic Condition Assessment**
- Analyzes images to determine overall condition (EXCELLENT, GOOD, FAIR, POOR, CRITICAL)
- Provides confidence scores for transparency
- Detects multiple issues in a single image

### **2. Defect Detection**
- **Corrosion:** Identifies type, severity, and location
- **Marine Growth:** Estimates coverage percentage and thickness
- **Coating Damage:** Assesses degradation level
- **Structural Damage:** Detects cracks, deformation
- **Anode Condition:** Estimates depletion percentage

### **3. Intelligent Suggestions**
- Auto-generates inspection remarks
- Suggests defect priorities
- Recommends follow-up actions
- Flags potential anomalies

### **4. Continuous Learning**
- Stores training data from human reviews
- Tracks accuracy metrics
- Improves over time with feedback

### **5 Batch Processing**
- Queue-based system for analyzing multiple images
- Priority-based processing
- Auto-retry on failures

---

## 🏗️ Architecture

```
┌─────────────────┐
│ Capture Image   │ ──┐
└─────────────────┘   │
                      ▼
              ┌───────────────┐
              │ Upload to     │
              │ Storage       │
              └───────────────┘
                      │
                      ▼
              ┌───────────────┐
              │ Queue for AI  │◄─── Auto or Manual
              │ Analysis      │
              └───────────────┘
                      │
                      ▼
              ┌───────────────┐
              │ AI Provider   │
              │ • OpenAI      │
              │ • Google      │
              │ • Custom      │
              └───────────────┘
                      │
                      ▼
              ┌───────────────┐
              │ Parse Results │
              │ • Conditions  │
              │ • Defects     │
              │ • Suggestions │
              └───────────────┘
                      │
                      ▼
              ┌───────────────┐
              │ Store Analysis│
              │ in Database   │
              └───────────────┘
                      │
                      ▼
              ┌───────────────┐
              │ Present to    │
              │ Inspector     │
              └───────────────┘
                      │
                      ▼
              ┌───────────────┐
              │ Inspector     │
              │ Review        │
              │ • Accept      │
              │ • Modify      │
              │ • Reject      │
              └───────────────┘
                      │
                      ▼
              ┌───────────────┐
              │ Feedback Loop │
              │ for Training  │
              └───────────────┘
```

---

## 📦 Database Schema

### **Main Tables**

#### **1. insp_ai_image_analysis**
Stores AI analysis results for each image.

```sql
CREATE TABLE insp_ai_image_analysis (
    analysis_id BIGSERIAL PRIMARY KEY,
    media_id BIGINT REFERENCES insp_media,
    inspection_id BIGINT REFERENCES insp_records,
    
    ai_provider VARCHAR(100), -- OPENAI_VISION, GOOGLE_CLOUD_VISION
    model_version VARCHAR(100),
    
    detected_conditions JSONB, -- Full AI response
    suggested_overall_condition VARCHAR(50),
    suggested_remarks TEXT,
    overall_confidence NUMERIC(5,4),
    
    anomaly_detected BOOLEAN,
    anomaly_confidence NUMERIC(5,4),
    
    reviewed_by_human BOOLEAN DEFAULT FALSE,
    ai_accuracy VARCHAR(50), -- ACCURATE, PARTIALLY_ACCURATE, INACCURATE
    
    processing_time_ms INTEGER,
    api_cost_usd NUMERIC(10,6)
);
```

**Example detected_conditions:**
```json
{
  "overall_condition": "FAIR",
  "confidence": 0.87,
  "detected_issues": [
    {
      "type": "CORROSION",
      "severity": "MODERATE",
      "location": "upper_section",
      "confidence": 0.82,
      "bounding_box": {"x": 120, "y": 340, "width": 200, "height": 150}
    },
    {
      "type": "MARINE_GROWTH",
      "coverage_estimate": 25,
      "confidence": 0.93
    }
  ],
  "marine_growth_percentage": 25,
  "corrosion_severity": "MODERATE",
  "coating_condition": "FAIR",
  "anode_condition": "GOOD",
  "suggested_remarks": "Moderate corrosion observed in upper section with approximately 25% marine growth coverage. Coating shows signs of degradation. Recommend cleaning and re-coating within 6 months.",
  "anomaly_detected": false
}
```

#### **2. insp_ai_analysis_queue**
Manages batch processing of images.

```sql
CREATE TABLE insp_ai_analysis_queue (
    queue_id BIGSERIAL PRIMARY KEY,
    media_id BIGINT REFERENCES insp_media,
    priority INTEGER DEFAULT 5, -- 1 (high) to 10 (low)
    queue_status VARCHAR(50), -- QUEUED, PROCESSING, COMPLETED, FAILED
    queued_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);
```

#### **3. insp_ai_prompt_templates**
Customizable prompts for different inspection types.

```sql
CREATE TABLE insp_ai_prompt_templates (
    template_id BIGSERIAL PRIMARY KEY,
    template_name VARCHAR(200),
    inspection_type_code VARCHAR(50),
    component_type VARCHAR(100),
    system_prompt TEXT,
    user_prompt_template TEXT,
    is_active BOOLEAN DEFAULT TRUE
);
```

---

## 💻 Usage Examples

### **Example 1: Analyze Single Image**

```typescript
import AIVision from '@/utils/inspection-ai-vision';

// After capturing/uploading an image
const handleAnalyzeImage = async (mediaId: number, inspectionId: number) => {
  try {
    setAnalyzing(true);
    
    const analysis = await AIVision.analyzeImage(mediaId, inspectionId, {
      provider: 'OPENAI_VISION',
      model: 'gpt-4-vision-preview',
      inspectionTypeCode: 'GVI',
      componentType: 'PRIMARY_LEG',
      previousCondition: 'GOOD' // From last inspection
    });
    
    console.log('AI Analysis:', analysis);
    
    // Show results to user
    setAIResults(analysis);
    setShowSuggestions(true);
    
  } catch (error) {
    console.error('Analysis failed:', error);
    toast.error('Failed to analyze image');
  } finally {
    setAnalyzing(false);
  }
};
```

### **Example 2: Queue Multiple Images for Batch Processing**

```typescript
const handleQueueBatch = async (mediaIds: number[], inspectionId: number) => {
  const queuePromises = mediaIds.map(mediaId =>
    AIVision.queueImageAnalysis(mediaId, inspectionId, 5)
  );
  
  const queueItems = await Promise.all(queuePromises);
  
  toast.success(`${queueItems.length} images queued for analysis`);
  
  // Monitor queue status
  const interval = setInterval(async () => {
    const statuses = await checkQueueStatuses(queueItems.map(q => q.queue_id));
    
    const allCompleted = statuses.every(s => 
      s.queue_status === 'COMPLETED' || s.queue_status === 'FAILED'
    );
    
    if (allCompleted) {
      clearInterval(interval);
      toast.success('All analyses completed');
      refreshResults();
    }
  }, 5000);
};
```

### **Example 3: Display AI Suggestions UI**

```tsx
import { Card, Badge, Button } from '@/components/ui';
import AIVision from '@/utils/inspection-ai-vision';

export function AIAnalysisCard({ analysis }: { analysis: ImageAnalysis }) {
  const detected = analysis.detected_conditions;
  
  const handleAcceptSuggestions = async () => {
    await AIVision.applyAISuggestions(analysis.analysis_id, analysis.inspection_id);
    await AIVision.provideAnalysisFeedback(
      analysis.analysis_id,
      'ACCURATE',
      'Suggestions accepted and applied',
      currentUser.id
    );
    toast.success('AI suggestions applied to inspection');
  };
  
  const handleRejectSuggestions = async () => {
    await AIVision.provideAnalysisFeedback(
      analysis.analysis_id,
      'INACCURATE',
      reasonForRejection,
      currentUser.id
    );
    toast.info('Feedback recorded for AI improvement');
  };
  
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">AI Analysis Results</h3>
        <Badge variant={getConfidenceVariant(detected.confidence)}>
          {Math.round(detected.confidence * 100)}% Confidence
        </Badge>
      </div>
      
      {/* Overall Condition */}
      <div className="mb-4">
        <label className="text-sm font-medium text-gray-600">
          Overall Condition
        </label>
        <div className="mt-1">
          <Badge 
            variant={getConditionVariant(detected.overall_condition)}
            className="text-lg"
          >
            {detected.overall_condition}
          </Badge>
        </div>
      </div>
      
      {/* Detected Issues */}
      {detected.detected_issues && detected.detected_issues.length > 0 && (
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-600">
            Detected Issues
          </label>
          <div className="mt-2 space-y-2">
            {detected.detected_issues.map((issue, idx) => (
              <div 
                key={idx}
                className="flex items-center justify-between p-3 bg-gray-50 rounded"
              >
                <div>
                  <div className="font-medium">{issue.type}</div>
                  {issue.severity && (
                    <div className="text-sm text-gray-600">
                      Severity: {issue.severity}
                    </div>
                  )}
                  {issue.location && (
                    <div className="text-sm text-gray-600">
                      Location: {issue.location}
                    </div>
                  )}
                </div>
                <Badge variant="outline">
                  {Math.round(issue.confidence * 100)}%
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Specific Assessments */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {detected.marine_growth_percentage !== undefined && (
          <div>
            <label className="text-sm text-gray-600">Marine Growth</label>
            <div className="text-lg font-semibold">
              {detected.marine_growth_percentage}%
            </div>
          </div>
        )}
        
        {detected.corrosion_severity && (
          <div>
            <label className="text-sm text-gray-600">Corrosion</label>
            <div className="text-lg font-semibold">
              {detected.corrosion_severity}
            </div>
          </div>
        )}
        
        {detected.coating_condition && (
          <div>
            <label className="text-sm text-gray-600">Coating</label>
            <div className="text-lg font-semibold">
              {detected.coating_condition}
            </div>
          </div>
        )}
        
        {detected.anode_condition && (
          <div>
            <label className="text-sm text-gray-600">Anode</label>
            <div className="text-lg font-semibold">
              {detected.anode_condition}
            </div>
          </div>
        )}
      </div>
      
      {/* Suggested Remarks */}
      <div className="mb-6">
        <label className="text-sm font-medium text-gray-600">
          Suggested Remarks
        </label>
        <div className="mt-2 p-4 bg-blue-50 rounded border border-blue-200">
          <p className="text-sm">{detected.suggested_remarks}</p>
        </div>
      </div>
      
      {/* Anomaly Warning */}
      {detected.anomaly_detected && (
        <div className="mb-6 p-4 bg-red-50 rounded border border-red-200">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2 mt-0.5" />
            <div>
              <div className="font-semibold text-red-900">
                Potential Anomaly Detected
              </div>
              <div className="text-sm text-red-700 mt-1">
                {detected.anomaly_description}
              </div>
              <div className="text-xs text-red-600 mt-1">
                Confidence: {Math.round(analysis.anomaly_confidence * 100)}%
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Action Buttons */}
      {!analysis.reviewed_by_human && (
        <div className="flex gap-3">
          <Button 
            onClick={handleAcceptSuggestions}
            variant="primary"
            className="flex-1"
          >
            Accept & Apply Suggestions
          </Button>
          <Button 
            onClick={() => setShowModifyDialog(true)}
            variant="outline"
            className="flex-1"
          >
            Modify & Apply
          </Button>
          <Button 
            onClick={handleRejectSuggestions}
            variant="ghost"
          >
            Reject
          </Button>
        </div>
      )}
      
      {/* Analysis Info */}
      <div className="mt-4 pt-4 border-t text-xs text-gray-500">
        <div className="flex justify-between">
          <span>Provider: {analysis.ai_provider}</span>
          <span>Processing: {analysis.processing_time_ms}ms</span>
          {analysis.api_cost_usd && (
            <span>Cost: ${analysis.api_cost_usd.toFixed(4)}</span>
          )}
        </div>
      </div>
    </Card>
  );
}
```

### **Example 4: Image with Bounding Boxes**

```tsx
export function AIImageOverlay({ 
  imageUrl, 
  detectedIssues 
}: { 
  imageUrl: string;
  detectedIssues: DetectedIssue[];
}) {
  return (
    <div className="relative">
      <img src={imageUrl} alt="Inspection" className="w-full" />
      
      {/* Overlay bounding boxes */}
      {detectedIssues.map((issue, idx) => {
        if (!issue.bounding_box) return null;
        
        const { x, y, width, height } = issue.bounding_box;
        
        return (
          <div
            key={idx}
            className="absolute border-2 border-red-500"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              width: `${width}px`,
              height: `${height}px`
            }}
          >
            <div className="absolute -top-6 left-0 bg-red-500 text-white text-xs px-2 py-1 rounded">
              {issue.type} ({Math.round(issue.confidence * 100)}%)
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

### **Example 5: Batch Analysis Progress**

```tsx
export function BatchAnalysisProgress({ queueItems }: { queueItems: QueueItem[] }) {
  const [statuses, setStatuses] = useState<Record<number, string>>({});
  
  useEffect(() => {
    const interval = setInterval(async () => {
      const updates = await fetchQueueStatuses(queueItems.map(q => q.queue_id));
      setStatuses(updates);
      
      if (Object.values(updates).every(s => s === 'COMPLETED' || s === 'FAILED')) {
        clearInterval(interval);
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [queueItems]);
  
  const completed = Object.values(statuses).filter(s => s === 'COMPLETED').length;
  const failed = Object.values(statuses).filter(s => s === 'FAILED').length;
  const processing = Object.values(statuses).filter(s => s === 'PROCESSING').length;
  const queued = queueItems.length - completed - failed - processing;
  
  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4">Batch Analysis Progress</h3>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span>Completed</span>
          <Badge variant="success">{completed}</Badge>
        </div>
        <div className="flex justify-between items-center">
          <span>Processing</span>
          <Badge variant="warning">{processing}</Badge>
        </div>
        <div className="flex justify-between items-center">
          <span>Queued</span>
          <Badge variant="default">{queued}</Badge>
        </div>
        <div className="flex justify-between items-center">
          <span>Failed</span>
          <Badge variant="destructive">{failed}</Badge>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="mt-4">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${(completed / queueItems.length) * 100}%` }}
          />
        </div>
        <div className="text-sm text-gray-600 mt-1 text-center">
          {completed} / {queueItems.length} analyzed
        </div>
      </div>
    </Card>
  );
}
```

---

## ⚙️ Configuration

### **Environment Variables**

Add to `.env.local`:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-...

# Google Cloud Vision Configuration
GOOGLE_CLOUD_VISION_API_KEY=AIza...

# Custom Model Configuration (if applicable)
CUSTOM_MODEL_ENDPOINT=https://...
CUSTOM_MODEL_API_KEY=...

# AI Vision Settings
AI_VISION_AUTO_ANALYZE=true  # Auto-analyze on image capture
AI_VISION_DEFAULT_PROVIDER=OPENAI_VISION
AI_VISION_BATCH_SIZE=10  # Max concurrent analyses
```

### **Prompt Templates**

Create custom prompts in database:

```sql
INSERT INTO insp_ai_prompt_templates (
    template_name,
    inspection_type_code,
    component_type,
    system_prompt,
    user_prompt_template,
    is_active
) VALUES (
    'Riser GVI Analysis',
    'GVI',
    'RISER',
    'You are an expert in subsea riser inspection. Focus on flexjoint condition, stress joint integrity, marine growth, and corrosion patterns specific to risers.',
    'Analyze this riser component from a GVI inspection. Previous condition: {previous_condition}. Assess flexjoint, stress joint, marine growth coverage, corrosion, and overall structural integrity. Provide detailed remarks suitable for a technical report.',
    true
);
```

---

## 📊 Performance Metrics

### **View Model Performance**

```typescript
const metrics = await AIVision.getModelMetrics('OPENAI_VISION', 'gpt-4-vision-preview', 30);

console.log('Last 30 days metrics:', metrics);
// {
//   total_analyses: 523,
//   successful_analyses: 518,
//   failed_analyses: 5,
//   accuracy_percentage: 87.5,
//   avg_confidence: 0.8234,
//   avg_processing_time_ms: 3420,
//   total_api_cost_usd: 15.67
// }
```

### **Dashboard Visualization**

```tsx
export function AIMetricsDashboard({ provider, modelVersion }) {
  const [metrics, setMetrics] = useState(null);
  
  useEffect(() => {
    loadMetrics();
  }, [provider, modelVersion]);
  
  async function loadMetrics() {
    const data = await AIVision.getModelMetrics(provider, modelVersion, 30);
    setMetrics(data);
  }
  
  if (!metrics) return <Spinner />;
  
  const latest = metrics[0];
  
  return (
    <div className="grid grid-cols-4 gap-4">
      <MetricCard
        title="Total Analyses"
        value={latest.total_analyses}
        icon={<ImageIcon />}
      />
      <MetricCard
        title="Accuracy"
        value={`${latest.accuracy_percentage}%`}
        icon={<CheckCircle />}
        variant="success"
      />
      <MetricCard
        title="Avg Processing Time"
        value={`${(latest.avg_processing_time_ms / 1000).toFixed(1)}s`}
        icon={<Clock />}
      />
      <MetricCard
        title="Total Cost"
        value={`$${latest.total_api_cost_usd.toFixed(2)}`}
        icon={<DollarSign />}
      />
    </div>
  );
}
```

---

## 🔄 Workflow Integration

### **Automatic Analysis on Image Capture**

```typescript
const handleCaptureSnapshot = async () => {
  // Capture from live video
  const blob = await captureFrameFromVideo(videoRef.current);
  
  // Upload to storage
  const media = await uploadMedia(blob, inspectionId);
  
  // Auto-queue for AI analysis
  if (settings.autoAnalyzeImages) {
    await AIVision.queueImageAnalysis(media.media_id, inspectionId, 1); // High priority
    toast.success('Image captured and queued for AI analysis');
  }
  
  // Refresh media list
  refreshMediaList();
};
```

### **Inspection Workflow with AI**

```
1. Inspector captures image
2. System auto-queues for AI analysis
3. AI processes in background (3-5 seconds)
4. Inspector continues with inspection
5. AI results appear when ready
6. Inspector reviews suggestions
7. Inspector accepts/modifies/rejects
8. System learns from feedback
```

---

## 🎯 Best Practices

### **1. When to Use AI Analysis**

✅ **Good Use Cases:**
- Initial condition assessment
- Marine growth estimation
- Coating damage evaluation
- Anode depletion estimation
- Bulk analysis of similar components

❌ **Avoid for:**
- Final certification decisions
- Critical structural assessments (without human verification)
- Legal/compliance documentation (use as supporting evidence only)

### **2. Confidence Thresholds**

```typescript
const getRecommendedAction = (confidence: number) => {
  if (confidence >= 0.85) {
    return 'ACCEPT'; // High confidence, safe to accept
  } else if (confidence >= 0.65) {
    return 'REVIEW'; // Medium confidence, review recommended
  } else {
    return 'MANUAL'; // Low confidence, manual assessment required
  }
};
```

### **3. Cost Management**

```typescript
// Batch process during off-peak hours
const scheduleBatchAnalysis = async (mediaIds: number[]) => {
  for (const mediaId of mediaIds) {
    await AIVision.queueImageAnalysis(mediaId, undefined, 8); // Low priority
  }
  
  // Process queue during night
  scheduleJob('0 2 * * *', processAIQueue); // 2 AM daily
};
```

### **4. Quality Control**

```typescript
// Require human review for anomalies
if (analysis.anomaly_detected && analysis.anomaly_confidence > 0.7) {
  await notifySupervisor({
    inspectionId,
    message: 'AI detected potential anomaly - human review required',
    analysisId: analysis.analysis_id
  });
}
```

---

## 🚀 Advanced Features

### **1. Compare AI vs Human Assessments**

```typescript
const compareAssessments = async (inspectionId: number) => {
  const aiAnalyses = await AIVision.getInspectionAnalyses(inspectionId);
  const { data: inspection } = await supabase
    .from('insp_records')
    .select('inspection_data')
    .eq('insp_id', inspectionId)
    .single();
  
  const aiCondition = aiAnalyses[0]?.suggested_overall_condition;
  const humanCondition = inspection.inspection_data.overall_condition;
  
  return {
    aiCondition,
    humanCondition,
    match: aiCondition === humanCondition,
    aiConfidence: aiAnalyses[0]?.overall_confidence
  };
};
```

### **2. Trend Analysis**

```typescript
// Track AI accuracy over time
const getAccuracyTrend = async (days: number = 30) => {
  const { data } = await supabase
    .from('insp_ai_model_metrics')
    .select('metric_date, accuracy_percentage')
    .gte('metric_date', startDate)
    .order('metric_date', { ascending: true });
  
  return data.map(d => ({
    date: d.metric_date,
    accuracy: d.accuracy_percentage
  }));
};
```

### **3. Export Training Data**

```sql
-- Export for model fine-tuning
SELECT 
    m.file_path,
    td.actual_condition,
    td.actual_defect_type,
    td.manual_labels,
    aia.detected_conditions
FROM insp_ai_training_data td
JOIN insp_ai_image_analysis aia ON td.analysis_id = aia.analysis_id
JOIN insp_media m ON td.media_id = m.media_id
WHERE td.use_for_training = true
  AND td.prediction_correct = false; -- Focus on mistakes for improvement
```

---

## ✅ Summary

The AI Vision system provides:

✅ **Automated image analysis** with OpenAI/Google Cloud Vision  
✅ **Intelligent condition assessment** with confidence scores  
✅ **Defect detection** for corrosion, marine growth, coating, etc.  
✅ **Automatic suggestions** for findings and remarks  
✅ **Batch processing queue** for efficiency  
✅ **Continuous learning** from human feedback  
✅ **Performance tracking** and cost monitoring  
✅ **Customizable prompts** for different inspection types  

This significantly reduces manual data entry and improves consistency across inspections! 🎉
