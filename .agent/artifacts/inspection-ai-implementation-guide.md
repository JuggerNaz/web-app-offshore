# Inspection Module AI Features - Implementation Guide

## Overview
This guide explains how to implement the four AI-powered features for the Inspection Module:

1. **Auto-Assignment of Job Numbers** - Smart dive/ROV number generation with pattern learning
2. **Text Auto-Completion** - AI-powered suggestions for inspection findings
3. **Video Tape Counter System** - Virtual counter with position logging
4. **Component Historical Data Display** - Show previous inspection data for comparison

---

## Feature 1: Auto-Assignment of Dive/ROV Numbers

### How It Works

The system learns from the user's numbering patterns and automatically suggests the next sequential number while allowing manual editing.

#### Pattern Learning
- When a user creates a dive job with number `DIVE-2026-001`, the system learns:
  - Pattern format: `DIVE-{YYYY}-{###}`
  - Last sequence: `001`
- Next time, it suggests: `DIVE-2026-002`
- If the user manually changes to `DIVE-02-002`, the system learns:
  - New pattern: `DIVE-{MM}-{###}`
  - And suggests accordingly next time

### UI Implementation

#### Component: DiveJobForm.tsx

```tsx
'use client';

import { useState, useEffect } from 'react';
import { InspectionAI } from '@/utils/inspection-ai';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface DiveJobFormProps {
  userId: string;
  structureId: number;
}

export function DiveJobForm({ userId, structureId }: DiveJobFormProps) {
  const [diveNo, setDiveNo] = useState('');
  const [diverName, setDiverName] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [coordinator, setCoordinator] = useState('');
  const [personnelSuggestions, setPersonnelSuggestions] = useState<any[]>([]);
  const [isEditingDiveNo, setIsEditingDiveNo] = useState(false);

  // Auto-suggest dive number on load
  useEffect(() => {
    async function loadSuggestions() {
      // Suggest dive number
      const suggestedDiveNo = await InspectionAI.suggestNextNumber(
        userId,
        'DIVE_NO'
      );
      setDiveNo(suggestedDiveNo);

      // Suggest personnel
      const personnel = await InspectionAI.suggestPersonnel(
        userId,
        structureId,
        'DIVING'
      );
      setPersonnelSuggestions(personnel);

      // Auto-fill if high confidence
      if (personnel.length > 0 && personnel[0].confidence > 70) {
        setDiverName(personnel[0].primary_person);
        setSupervisor(personnel[0].supervisor);
        setCoordinator(personnel[0].coordinator);
      }
    }

    loadSuggestions();
  }, [userId, structureId]);

  // Parse and allow editing of dive number components
  const diveNoParts = InspectionAI.parseNumberPattern(diveNo);

  const handleDiveNoEdit = (field: string, value: string) => {
    const newParts = { ...diveNoParts, [field]: value };
    const newDiveNo = InspectionAI.buildNumberFromPattern(newParts);
    setDiveNo(newDiveNo);
    setIsEditingDiveNo(true);
  };

  return (
    <div className="space-y-4">
      {/* Dive Number with AI Suggestion */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Dive Number</label>
        <div className="flex gap-2">
          {isEditingDiveNo ? (
            <>
              <Input
                placeholder="Prefix"
                value={diveNoParts.prefix}
                onChange={(e) => handleDiveNoEdit('prefix', e.target.value)}
                className="w-24"
              />
              <Input
                placeholder="Year"
                value={diveNoParts.year || ''}
                onChange={(e) => handleDiveNoEdit('year', e.target.value)}
                className="w-24"
              />
              <Input
                placeholder="Seq"
                value={diveNoParts.sequence}
                onChange={(e) => handleDiveNoEdit('sequence', e.target.value)}
                className="w-24"
              />
              <Button
                variant="outline"
                onClick={() => setIsEditingDiveNo(false)}
              >
                Done
              </Button>
            </>
          ) : (
            <>
              <Input
                value={diveNo}
                onChange={(e) => setDiveNo(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingDiveNo(true)}
              >
                Edit Parts
              </Button>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          ✨ AI suggested based on your previous pattern
        </p>
      </div>

      {/* Personnel with Suggestions */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Diver Name</label>
        <Input
          value={diverName}
          onChange={(e) => setDiverName(e.target.value)}
          list="diver-suggestions"
        />
        <datalist id="diver-suggestions">
          {personnelSuggestions.map((p, i) => (
            <option key={i} value={p.primary_person}>
              {p.primary_person} (Confidence: {p.confidence.toFixed(0)}%)
            </option>
          ))}
        </datalist>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Dive Supervisor</label>
        <Input
          value={supervisor}
          onChange={(e) => setSupervisor(e.target.value)}
          list="supervisor-suggestions"
        />
        <datalist id="supervisor-suggestions">
          {personnelSuggestions.map((p, i) => (
            <option key={i} value={p.supervisor} />
          ))}
        </datalist>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Report Coordinator</label>
        <Input
          value={coordinator}
          onChange={(e) => setCoordinator(e.target.value)}
          list="coordinator-suggestions"
        />
        <datalist id="coordinator-suggestions">
          {personnelSuggestions.map((p, i) => (
            <option key={i} value={p.coordinator} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
```

### Learning Trigger

After successful job creation:

```tsx
async function handleSubmit() {
  // Create dive job
  const { data: diveJob, error } = await supabase
    .from('insp_dive_jobs')
    .insert({
      dive_no: diveNo,
      diver_name: diverName,
      dive_supervisor: supervisor,
      report_coordinator: coordinator,
      structure_id: structureId,
      cr_user: userId,
    })
    .select()
    .single();

  if (!error && diveJob) {
    // Learning happens automatically via database triggers
    // But you can also explicitly call:
    await InspectionAI.learnNumberingPattern(userId, 'DIVE_NO', diveNo);
    await InspectionAI.learnPersonnelAssignment(
      userId,
      structureId,
      'DIVING',
      diverName,
      supervisor,
      coordinator
    );
  }
}
```

---

## Feature 2: Text Auto-Completion for Inspection Findings

### How It Works

As users type in inspection remarks or descriptions, the system suggests completions based on:
1. Previous text from similar inspections
2. Standard templates for the inspection type
3. Context (inspection type, component type)

### UI Implementation

#### Component: SmartTextarea.tsx

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { InspectionAI } from '@/utils/inspection-ai';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

interface SmartTextareaProps {
  inspectionType: string;
  componentType: string;
  fieldName: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SmartTextarea({
  inspectionType,
  componentType,
  fieldName,
  value,
  onChange,
  placeholder,
}: SmartTextareaProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Debounced suggestion fetch
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (value.length >= 3) {
        // Get AI suggestions
        const aiSuggestions = await InspectionAI.getTextSuggestions(
          inspectionType,
          componentType,
          fieldName,
          value,
          5
        );

        // Get standard templates
        const templates = InspectionAI.getStandardTemplates(
          inspectionType,
          fieldName
        );

        // Combine and sort by confidence
        const combined = [
          ...aiSuggestions,
          ...templates.map((t) => ({
            suggestion: t,
            confidence: 30, // Lower confidence for templates
          })),
        ].sort((a, b) => b.confidence - a.confidence);

        setSuggestions(combined.slice(0, 5));
        setShowSuggestions(combined.length > 0);
      } else {
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [value, inspectionType, componentType, fieldName]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev === 0 ? suggestions.length - 1 : prev - 1
      );
    } else if (e.key === 'Tab' || e.key === 'Enter') {
      if (showSuggestions) {
        e.preventDefault();
        selectSuggestion(suggestions[selectedIndex].suggestion);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="min-h-[100px]"
      />

      {showSuggestions && suggestions.length > 0 && (
        <Card className="absolute z-50 mt-1 w-full max-h-60 overflow-auto shadow-lg">
          <div className="p-1">
            <div className="text-xs text-muted-foreground px-2 py-1 flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              AI Suggestions (Press Tab or ↑↓ to navigate)
            </div>
            {suggestions.map((item, index) => (
              <button
                key={index}
                onClick={() => selectSuggestion(item.suggestion)}
                className={`
                  w-full text-left px-3 py-2 text-sm rounded-md
                  transition-colors
                  ${
                    index === selectedIndex
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }
                `}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="flex-1">{item.suggestion}</p>
                  <span
                    className={`
                    text-xs px-1.5 py-0.5 rounded
                    ${
                      item.confidence >= 70
                        ? 'bg-green-100 text-green-700'
                        : item.confidence >= 40
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                    }
                  `}
                  >
                    {item.confidence.toFixed(0)}%
                  </span>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
```

#### Usage in Inspection Form:

```tsx
<SmartTextarea
  inspectionType="GVI"
  componentType="PRIMARY_LEG"
  fieldName="remarks"
  value={inspectionData.remarks}
  onChange={(value) =>
    setInspectionData({ ...inspectionData, remarks: value })
  }
  placeholder="Enter inspection remarks..."
/>
```

---

## Feature 3: Video Tape Counter System

### How It Works

1. When video logging starts, a virtual counter begins at `00:00:00`
2. Counter increments every second
3. When inspection events occur (start/end), the counter position is logged
4. Users can later use counter values to navigate to specific positions in the recorded video

### UI Implementation

#### Component: VideoCounterCard.tsx

```tsx
'use client';

import { useState, useEffect } from 'react';
import { InspectionAI } from '@/utils/inspection-ai';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, Clock } from 'lucide-react';

interface VideoCounterCardProps {
  tapeId: number;
  onCounterCapture?: (counter: number, formatted: string) => void;
}

export function VideoCounterCard({
  tapeId,
  onCounterCapture,
}: VideoCounterCardProps) {
  const [counterManager] = useState(
    () => new InspectionAI.VideoCounterManager(tapeId, setCounter)
  );
  const [counter, setCounter] = useState(0);
  const [formatted, setFormatted] = useState('00:00:00');
  const [isRunning, setIsRunning] = useState(false);
  const [lastCapturedPosition, setLastCapturedPosition] = useState<string>('');

  useEffect(() => {
    setFormatted(counterManager.getFormattedValue());
  }, [counter, counterManager]);

  const handleStart = async () => {
    await counterManager.start();
    setIsRunning(true);
  };

  const handleStop = async () => {
    await counterManager.stop();
    setIsRunning(false);
  };

  const handleCapturePosition = async () => {
    const position = await counterManager.capturePosition();
    setLastCapturedPosition(position.formatted);
    onCounterCapture?.(position.counter, position.formatted);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Video Tape Counter
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Counter Display */}
        <div className="bg-black text-green-400 font-mono text-3xl py-3 px-4 rounded text-center tracking-wider">
          {formatted}
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          {!isRunning ? (
            <Button
              onClick={handleStart}
              className="flex-1"
              variant="default"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Counter
            </Button>
          ) : (
            <>
              <Button
                onClick={handleStop}
                className="flex-1"
                variant="destructive"
              >
                <Pause className="w-4 h-4 mr-2" />
                Stop Counter
              </Button>
              <Button
                onClick={handleCapturePosition}
                variant="outline"
                className="flex-1"
              >
                📍 Mark Position
              </Button>
            </>
          )}
        </div>

        {/* Last Captured */}
        {lastCapturedPosition && (
          <div className="text-xs text-muted-foreground text-center">
            Last marked: <span className="font-mono">{lastCapturedPosition}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

#### Integration with Video Logging:

```tsx
// When logging video event
async function logVideoEvent(eventType: string, inspectionId?: number) {
  const counter = videoCounterManager.getCurrentValue();
  const formatted = videoCounterManager.getFormattedValue();

  await supabase.from('insp_video_logs').insert({
    tape_id: currentTapeId,
    event_type: eventType,
    inspection_id: inspectionId,
    tape_counter_start: counter,
    timecode_start: formatted,
  });
}

// When starting inspection
<VideoCounterCard
  tapeId={currentTapeId}
  onCounterCapture={(counter, formatted) => {
    logVideoEvent('PRE_INSPECTION', currentInspectionId);
  }}
/>
```

---

## Feature 4: Component Historical Data Display

### How It Works

When a component is selected for inspection, the system displays:
1. Previous inspection summary
2. Condition trend (improving/stable/deteriorating)
3. Anomaly history
4. Recent inspection details

### UI Implementation

#### Component: ComponentHistoryPanel.tsx

```tsx
'use client';

import { useState, useEffect } from 'react';
import { InspectionAI } from '@/utils/inspection-ai';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface ComponentHistoryPanelProps {
  componentId: number;
  componentName: string;
}

export function ComponentHistoryPanel({
  componentId,
  componentName,
}: ComponentHistoryPanelProps) {
  const [history, setHistory] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [trend, setTrend] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);

      const [historyData, recordsData] = await Promise.all([
        InspectionAI.getComponentHistory(componentId),
        InspectionAI.getComponentInspectionRecords(componentId, 5),
      ]);

      setHistory(historyData);
      setRecords(recordsData);

      if (historyData) {
        setTrend(InspectionAI.generateConditionTrend(historyData));
      }

      setLoading(false);
    }

    loadHistory();
  }, [componentId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center text-muted-foreground">
            Loading history...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!history || history.total_inspections === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center text-muted-foreground">
            No previous inspection data for this component
          </div>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = () => {
    switch (trend?.trend) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'deteriorating':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Component History: {componentName}</span>
          {history.total_anomalies > 0 && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {history.total_anomalies} Anomalies
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{history.total_inspections}</div>
            <div className="text-xs text-muted-foreground">Inspections</div>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {history.last_inspection_type}
            </div>
            <div className="text-xs text-muted-foreground">Last Type</div>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {new Date(history.last_inspection_date).toLocaleDateString()}
            </div>
            <div className="text-xs text-muted-foreground">Last Date</div>
          </div>
        </div>

        {/* Condition Trend */}
        {trend && (
          <div className="bg-muted rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              {getTrendIcon()}
              <span className="font-medium text-sm capitalize">
                {trend.trend} Condition
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{trend.summary}</p>
          </div>
        )}

        {/* Recent Inspections */}
        <Accordion type="single" collapsible>
          <AccordionItem value="recent">
            <AccordionTrigger className="text-sm">
              Recent Inspections ({records.length})
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {records.map((record, index) => (
                  <div
                    key={record.insp_id}
                    className="border-l-2 border-primary pl-3 py-2"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">
                        {record.inspection_type_code}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {record.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(record.inspection_date).toLocaleDateString()} at{' '}
                      {record.inspection_time}
                    </div>
                    {record.inspection_data?.overall_condition && (
                      <div className="mt-1">
                        <Badge variant="secondary" className="text-xs">
                          Condition: {record.inspection_data.overall_condition}
                        </Badge>
                      </div>
                    )}
                    {record.inspection_data?.remarks && (
                      <p className="text-xs mt-2 text-muted-foreground italic">
                        "{record.inspection_data.remarks.substring(0, 100)}
                        {record.inspection_data.remarks.length > 100
                          ? '...'
                          : ''}
                        "
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Marine Growth Trend */}
        {history.avg_marine_growth && (
          <div className="text-xs text-muted-foreground">
            Average Marine Growth: {history.avg_marine_growth.toFixed(1)}%
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

#### Usage in Inspection Page:

```tsx
<div className="grid grid-cols-2 gap-4">
  <div>
    {/* Main inspection form */}
    <InspectionForm componentId={selectedComponentId} />
  </div>
  <div>
    {/* Historical data */}
    <ComponentHistoryPanel
      componentId={selectedComponentId}
      componentName={selectedComponent.comp_name}
    />
  </div>
</div>
```

---

## Complete Integration Example

Here's how all features work together in the main inspection page:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { DiveJobForm } from '@/components/inspection/DiveJobForm';
import { VideoCounterCard } from '@/components/inspection/VideoCounterCard';
import { ComponentHistoryPanel } from '@/components/inspection/ComponentHistoryPanel';
import { SmartTextarea } from '@/components/inspection/SmartTextarea';

export default function InspectionPage() {
  const [diveJobId, setDiveJobId] = useState<number | null>(null);
  const [tapeId, setTapeId] = useState<number | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<any>(null);
  const [inspectionData, setInspectionData] = useState({});

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Diving Inspection</h1>

      {/* Step 1: Create Dive Job with AI */}
      {!diveJobId && (
        <DiveJobForm
          userId={currentUser.id}
          structureId={selectedStructure.id}
          onJobCreated={(jobId, createdTapeId) => {
            setDiveJobId(jobId);
            setTapeId(createdTapeId);
          }}
        />
      )}

      {/* Step 2: Main Inspection Interface */}
      {diveJobId && (
        <div className="grid grid-cols-3 gap-4">
          {/* Left: Video Counter */}
          <div>
            <VideoCounterCard
              tapeId={tapeId!}
              onCounterCapture={(counter, formatted) => {
                console.log('Counter position marked:', formatted);
              }}
            />
          </div>

          {/* Center: Main Inspection Form */}
          <div className="col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Inspection Data</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SmartTextarea
                  inspectionType="GVI"
                  componentType={selectedComponent?.comp_type}
                  fieldName="remarks"
                  value={inspectionData.remarks || ''}
                  onChange={(value) =>
                    setInspectionData({ ...inspectionData, remarks: value })
                  }
                  placeholder="Enter inspection remarks..."
                />
              </CardContent>
            </Card>
          </div>

          {/* Right: Historical Data */}
          <div>
            {selectedComponent && (
              <ComponentHistoryPanel
                componentId={selectedComponent.comp_id}
                componentName={selectedComponent.comp_name}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Database Triggers & Automatic Learning

All AI learning happens automatically through database triggers:

1. **Dive/ROV Number Learning**: Triggered on `INSERT` to `insp_dive_jobs` or `insp_rov_jobs`
2. **Personnel Learning**: Triggered on `INSERT` to job tables
3. **Text Pattern Learning**: Triggered on `INSERT/UPDATE` to `insp_records` when status is COMPLETED/REVIEWED/APPROVED

No manual intervention required - the system learns as users work!

---

## Performance Considerations

### Materialized View Refresh

The component history view should be refreshed periodically:

```typescript
// Cron job or scheduled task
async function refreshHistoryViews() {
  await InspectionAI.refreshComponentHistory();
}

// Or trigger after each inspection completion
await completionInspection(inspectionId);
await InspectionAI.refreshComponentHistory();
```

### Caching Suggestions

Consider caching frequently accessed suggestions:

```typescript
// In your API route
import { unstable_cache } from 'next/cache';

const getCachedSuggestions = unstable_cache(
  async (inspectionType, componentType, fieldName) => {
    return await InspectionAI.getTextSuggestions(
      inspectionType,
      componentType,
      fieldName,
      '',
      10
    );
  },
  ['text-suggestions'],
  { revalidate: 3600 } // 1 hour
);
```

---

## Testing the AI Features

### Test Scenario 1: Pattern Learning

1. Create first dive job: `DIVE-2026-001`
2. Create second dive job - should suggest: `DIVE-2026-002`
3. Manually change to: `DIVE-02-002`
4. Create third dive job - should suggest: `DIVE-02-003`

### Test Scenario 2: Text Suggestions

1. Complete inspection with remark: "Marine growth observed at 15%"
2. Start new inspection, type "Marine" - should suggest the full sentence
3. Complete more inspections with similar remarks
4. Suggestions should improve in accuracy

### Test Scenario 3: Video Counter

1. Start video counter
2. Wait 10 seconds, capture position
3. Log inspection event - counter should be saved
4. View video log - should show `00:00:10` position

### Test Scenario 4: Component History

1. Complete multiple inspections on same component
2. Select component for new inspection
3. Historical panel should show:
   - Previous inspection count
   - Last inspection date
   - Condition trend
   - Recent inspection details

---

## Conclusion

These AI features significantly enhance the user experience by:
- Reducing manual data entry
- Maintaining consistency
- Learning from user behavior
- Providing contextual assistance
- Enabling better decision-making through historical data

All features are designed to be non-intrusive and allow manual override when needed.
