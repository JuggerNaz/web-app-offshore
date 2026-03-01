# ROV Data & Video Integration Guide

## 🎯 Overview

This guide explains how to integrate ROV data acquisition settings and video grab configurations into the inspection screen, allowing real-time data capture and automatic video frame grabbing during ROV inspections.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  ROV Inspection Screen                   │
│  ┌──────────────────┐      ┌──────────────────┐        │
│  │ Data Acquisition │      │  Video Grab       │        │
│  │ Settings Panel   │      │  Settings Panel   │        │
│  └──────────────────┘      └──────────────────┘        │
│           │                          │                   │
│           ▼                          ▼                   │
│  ┌──────────────────┐      ┌──────────────────┐        │
│  │ Live Data Stream │      │  Live Video Feed  │        │
│  │ (Serial/Network) │      │  (Camera/RTSP)    │        │
│  └──────────────────┘      └──────────────────┘        │
│           │                          │                   │
│           ▼                          ▼                   │
│  ┌──────────────────────────────────────────┐          │
│  │        Inspection Data Capture            │          │
│  │  • ROV Telemetry Snapshot                │          │
│  │  • Video Frame Grab                       │          │
│  │  • Automatic on inspect/anomaly           │          │
│  └──────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Database Schema

### **New Columns Added to Existing Tables**

#### **insp_rov_jobs**
```sql
rov_data_config_id BIGINT           -- Link to data acquisition config
video_grab_config_id BIGINT         -- Link to video grab config
auto_capture_data BOOLEAN           -- Auto-capture ROV data on inspection
auto_grab_video BOOLEAN             -- Auto-grab video frame on inspection
```

#### **insp_records**
```sql
rov_data_snapshot JSONB             -- Captured ROV telemetry data
rov_data_timestamp TIMESTAMP        -- When data was captured
video_frame_grabbed BOOLEAN         -- Whether video was auto-grabbed
video_frame_media_id BIGINT         -- Link to grabbed frame
```

### **New Configuration Tables**

#### **rov_data_acquisition_config**
Stores configured data acquisition settings (already in your system).

```sql
CREATE TABLE rov_data_acquisition_config (
    config_id BIGSERIAL PRIMARY KEY,
    config_name VARCHAR(200),
    structure_type VARCHAR(50),        -- PLATFORM, PIPELINE
    connection_type VARCHAR(50),        -- SERIAL, NETWORK
    connection_params JSONB,            -- Port, baud rate, etc.
    parsing_method VARCHAR(50),         -- POSITION_BASED, ID_BASED
    field_mappings JSONB,               -- How to map data to fields
    is_active BOOLEAN,
    is_default BOOLEAN
);
```

**Example Data:**
```json
{
  "config_name": "Standard ROV Serial Data",
  "connection_type": "SERIAL",
  "connection_params": {
    "port": "COM5",
    "baud_rate": 9600
  },
  "parsing_method": "POSITION_BASED",
  "field_mappings": [
    {"position": 1, "source_field": "DEPTH", "target_field": "depth_meters"},
    {"position": 2, "source_field": "HEADING", "target_field": "heading_degrees"},
    {"position": 3, "source_field": "LAT", "target_field": "latitude"},
    {"position": 4, "source_field": "LONG", "target_field": "longitude"}
  ]
}
```

#### **rov_video_grab_config**
Stores video grab settings.

```sql
CREATE TABLE rov_video_grab_config (
    config_id BIGSERIAL PRIMARY KEY,
    config_name VARCHAR(200),
    video_source VARCHAR(100),          -- Camera device or stream URL
    grab_format VARCHAR(50),            -- JPEG, PNG
    grab_quality INTEGER,               -- 1-100
    resolution_width INTEGER,
    resolution_height INTEGER,
    auto_grab_on_inspection BOOLEAN,
    auto_grab_on_anomaly BOOLEAN,
    enable_overlay BOOLEAN,             -- Burn-in data on image
    overlay_template JSONB,             -- What data to display
    is_active BOOLEAN,
    is_default BOOLEAN
);
```

**Example Overlay Template:**
```json
[
  {
    "type": "text",
    "position": "top-left",
    "content": "{date} {time}",
    "font_size": 16,
    "color": "white"
  },
  {
    "type": "text",
    "position": "top-right",
    "content": "Depth: {depth}m | Alt: {altitude}m",
    "font_size": 14,
    "color": "yellow"
  },
  {
    "type": "text",
    "position": "bottom-left",
    "content": "ROV: {rov_serial_no}",
    "font_size": 14,
    "color": "white"
  },
  {
    "type": "text",
    "position": "bottom-right",
    "content": "{component_id} | Heading: {heading}°",
    "font_size": 14,
    "color": "white"
  }
]
```

---

## 💻 Implementation Examples

### **Example 1: ROV Job Creation with Settings**

```tsx
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';

export function CreateROVJobForm() {
  const [dataConfigs, setDataConfigs] = useState([]);
  const [videoConfigs, setVideoConfigs] = useState([]);
  const [selectedDataConfig, setSelectedDataConfig] = useState<number | null>(null);
  const [selectedVideoConfig, setSelectedVideoConfig] = useState<number | null>(null);
  const [autoCapture, setAutoCapture] = useState(true);
  const [autoGrab, setAutoGrab] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  async function loadConfigs() {
    // Load data acquisition configs
    const { data: dataConf } = await supabase
      .from('rov_data_acquisition_config')
      .select('*')
      .eq('is_active', true)
      .order('is_default', { ascending: false });

    setDataConfigs(dataConf || []);
    
    // Set default config
    const defaultData = dataConf?.find(c => c.is_default);
    if (defaultData) setSelectedDataConfig(defaultData.config_id);

    // Load video grab configs
    const { data: videoConf } = await supabase
      .from('rov_video_grab_config')
      .select('*')
      .eq('is_active', true)
      .order('is_default', { ascending: false });

    setVideoConfigs(videoConf || []);
    
    // Set default config
    const defaultVideo = videoConf?.find(c => c.is_default);
    if (defaultVideo) setSelectedVideoConfig(defaultVideo.config_id);
  }

  async function handleSubmit(formData: any) {
    const { data, error } = await supabase
      .from('insp_rov_jobs')
      .insert({
        deployment_no: formData.deploymentNo,
        structure_id: formData.structureId,
        rov_serial_no: formData.rovSerialNo,
        rov_data_config_id: selectedDataConfig,
        video_grab_config_id: selectedVideoConfig,
        auto_capture_data: autoCapture,
        auto_grab_video: autoGrab,
        // ... other fields
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create ROV job');
      return;
    }

    toast.success('ROV job created with data & video settings');
    router.push(`/inspection/rov/${data.rov_job_id}`);
  }

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-6">Create ROV Inspection Job</h2>

      {/* Standard fields omitted for brevity */}

      {/* ROV Data Settings */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">ROV Data Acquisition</h3>
        
        <div className="space-y-4">
          <div>
            <Label>Data Configuration</Label>
            <Select 
              value={selectedDataConfig?.toString()} 
              onValueChange={(v) => setSelectedDataConfig(parseInt(v))}
            >
              {dataConfigs.map(config => (
                <option key={config.config_id} value={config.config_id}>
                  {config.config_name} 
                  {config.is_default && ' (Default)'}
                </option>
              ))}
            </Select>
            {selectedDataConfig && (
              <div className="mt-2 text-sm text-gray-600">
                <div>Connection: {getConfigDetails(selectedDataConfig, dataConfigs)?.connection_type}</div>
                <div>Parsing: {getConfigDetails(selectedDataConfig, dataConfigs)?.parsing_method}</div>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Switch 
              checked={autoCapture} 
              onCheckedChange={setAutoCapture}
              id="auto-capture"
            />
            <Label htmlFor="auto-capture">
              Auto-capture ROV data at inspection events
            </Label>
          </div>
        </div>
      </div>

      {/* Video Grab Settings */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Video Frame Grabbing</h3>
        
        <div className="space-y-4">
          <div>
            <Label>Video Configuration</Label>
            <Select 
              value={selectedVideoConfig?.toString()} 
              onValueChange={(v) => setSelectedVideoConfig(parseInt(v))}
            >
              {videoConfigs.map(config => (
                <option key={config.config_id} value={config.config_id}>
                  {config.config_name} 
                  {config.is_default && ' (Default)'}
                </option>
              ))}
            </Select>
            {selectedVideoConfig && (
              <div className="mt-2 text-sm text-gray-600">
                <div>Source: {getConfigDetails(selectedVideoConfig, videoConfigs)?.video_source}</div>
                <div>Resolution: {getConfigDetails(selectedVideoConfig, videoConfigs)?.resolution_width}x{getConfigDetails(selectedVideoConfig, videoConfigs)?.resolution_height}</div>
                <div>Format: {getConfigDetails(selectedVideoConfig, videoConfigs)?.grab_format}</div>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Switch 
              checked={autoGrab} 
              onCheckedChange={setAutoGrab}
              id="auto-grab"
            />
            <Label htmlFor="auto-grab">
              Auto-grab video frame at inspection events
            </Label>
          </div>
        </div>
      </div>

      <Button onClick={handleSubmit}>Create ROV Job</Button>
    </Card>
  );
}
```

### **Example 2: Inspection Screen with Live Data & Video**

```tsx
export function ROVInspectionScreen({ rovJobId }: { rovJobId: number }) {
  const [rovJob, setRovJob] = useState<any>(null);
  const [liveData, setLiveData] = useState<any>(null);
  const [dataConnection, setDataConnection] = useState<any>(null);
  const [videoFeed, setVideoFeed] = useState<string | null>(null);

  useEffect(() => {
    loadROVJob();
  }, [rovJobId]);

  async function loadROVJob() {
    const { data } = await supabase
      .from('vw_rov_inspections_with_settings')
      .select('*')
      .eq('rov_job_id', rovJobId)
      .single();

    setRovJob(data);

    // Initialize data connection if auto-capture is enabled
    if (data?.auto_capture_data) {
      initializeDataConnection(data.rov_data_config_id);
    }

    // Initialize video feed if auto-grab is enabled
    if (data?.auto_grab_video) {
      initializeVideoFeed(data.video_grab_config_id);
    }
  }

  async function initializeDataConnection(configId: number) {
    // Get config
    const { data: config } = await supabase
      .from('rov_data_acquisition_config')
      .select('*')
      .eq('config_id', configId)
      .single();

    if (!config) return;

    // Connect to data source based on connection type
    if (config.connection_type === 'SERIAL') {
      // Connect to serial port (using Web Serial API or backend service)
      const connection = await connectSerial(config.connection_params);
      setDataConnection(connection);

      // Listen for data
      connection.onData((rawData: string) => {
        const parsed = parseROVData(rawData, config);
        setLiveData(parsed);
      });
    } else if (config.connection_type === 'NETWORK') {
      // Connect to network stream (using WebSocket or HTTP polling)
      const connection = await connectNetwork(config.connection_params);
      setDataConnection(connection);

      connection.onData((rawData: string) => {
        const parsed = parseROVData(rawData, config);
        setLiveData(parsed);
      });
    }
  }

  async function initializeVideoFeed(configId: number) {
    // Get config
    const { data: config } = await supabase
      .from('rov_video_grab_config')
      .select('*')
      .eq('config_id', configId)
      .single();

    if (!config) return;

    // Initialize video feed based on source type
    if (config.video_source_type === 'CAMERA') {
      // Use browser MediaDevices API
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: config.video_source,
          width: config.resolution_width,
          height: config.resolution_height
        }
      });
      
      const videoUrl = URL.createObjectURL(stream);
      setVideoFeed(videoUrl);
    } else if (config.video_source_type === 'RTSP_STREAM') {
      // Use video stream URL (via backend proxy or HLS/DASH)
      setVideoFeed(config.video_source);
    }
  }

  async function handleStartInspection(componentId: number) {
    // Capture ROV data snapshot
    let dataSnapshot = null;
    if (rovJob?.auto_capture_data && liveData) {
      dataSnapshot = {
        ...liveData,
        capture_timestamp: new Date().toISOString()
      };
    }

    // Grab video frame
    let videoFrameMediaId = null;
    if (rovJob?.auto_grab_video && videoFeed) {
      const frame = await grabVideoFrame(videoFeed, rovJob.video_grab_config_id);
      
      // Upload frame
      const media = await uploadFrameToStorage(frame);
      videoFrameMediaId = media.media_id;
    }

    // Create inspection record
    const { data, error } = await supabase
      .from('insp_records')
      .insert({
        rov_job_id: rovJobId,
        component_id: componentId,
        inspection_type_code: 'GVI',
        rov_data_snapshot: dataSnapshot,
        rov_data_timestamp: new Date().toISOString(),
        video_frame_grabbed: videoFrameMediaId !== null,
        video_frame_media_id: videoFrameMediaId,
        // ... other fields
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to start inspection');
      return;
    }

    toast.success('Inspection started with ROV data & video captured');
  }

  return (
    <div className="grid grid-cols-3 gap-4 h-screen">
      {/* Left Panel - Live ROV Data */}
      <div className="col-span-1 space-y-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Live ROV Data</h3>
          
          {liveData ? (
            <div className="space-y-2 text-sm">
              <DataRow label="Depth" value={`${liveData.depth_meters}m`} />
              <DataRow label="Altitude" value={`${liveData.altitude_meters}m`} />
              <DataRow label="Heading" value={`${liveData.heading_degrees}°`} />
              <DataRow label="Latitude" value={liveData.latitude?.toFixed(6)} />
              <DataRow label="Longitude" value={liveData.longitude?.toFixed(6)} />
              <DataRow label="Temperature" value={`${liveData.water_temperature}°C`} />
              <DataRow label="Battery" value={`${liveData.battery_voltage}V`} />
              <DataRow 
                label="Status" 
                value={liveData.rov_status}
                valueClass={liveData.rov_status === 'OK' ? 'text-green-600' : 'text-red-600'}
              />
            </div>
          ) : (
            <div className="text-gray-500">
              {rovJob?.auto_capture_data 
                ? 'Connecting to ROV data stream...' 
                : 'Auto-capture disabled'}
            </div>
          )}
        </Card>

        {/* Data Config Info */}
        <Card className="p-4">
          <h4 className="font-medium mb-2">Data Configuration</h4>
          <div className="text-sm space-y-1 text-gray-600">
            <div>{rovJob?.data_config_name}</div>
            <div>Connection: {rovJob?.connection_type}</div>
            <div>Method: {rovJob?.parsing_method}</div>
          </div>
        </Card>
      </div>

      {/* Center Panel - Video Feed */}
      <div className="col-span-2 space-y-4">
        <Card className="p-4">
          <div className="aspect-video bg-black rounded relative">
            {videoFeed ? (
              <>
                <video 
                  src={videoFeed} 
                  autoPlay 
                  className="w-full h-full object-contain"
                  ref={(ref) => {
                    if (ref && videoFeed.startsWith('blob:')) {
                      ref.srcObject = videoFeed;
                    }
                  }}
                />
                
                {/* Overlay with live data */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-2 left-2 text-white text-sm bg-black/50 px-2 py-1 rounded">
                    {new Date().toLocaleString()}
                  </div>
                  <div className="absolute top-2 right-2 text-yellow-400 text-sm bg-black/50 px-2 py-1 rounded">
                    Depth: {liveData?.depth_meters}m | Alt: {liveData?.altitude_meters}m
                  </div>
                  <div className="absolute bottom-2 left-2 text-white text-sm bg-black/50 px-2 py-1 rounded">
                    ROV: {rovJob?.rov_serial_no}
                  </div>
                  <div className="absolute bottom-2 right-2 text-white text-sm bg-black/50 px-2 py-1 rounded">
                    Heading: {liveData?.heading_degrees}°
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                {rovJob?.auto_grab_video 
                  ? 'Initializing video feed...' 
                  : 'Auto-grab disabled'}
              </div>
            )}
          </div>

          {/* Video Controls */}
          <div className="mt-4 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              <div>{rovJob?.video_config_name}</div>
              <div>{rovJob?.resolution_width}x{rovJob?.resolution_height} {rovJob?.grab_format}</div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => grabManualFrame()}
                variant="outline"
                size="sm"
              >
                📸 Grab Frame
              </Button>
              <Button 
                onClick={() => handleStartInspection(selectedComponentId)}
                variant="primary"
              >
                Start Inspection (Auto-capture)
              </Button>
            </div>
          </div>
        </Card>

        {/* Inspection Form */}
        <Card className="p-4">
          {/* Standard inspection form fields */}
        </Card>
      </div>
    </div>
  );
}

function DataRow({ label, value, valueClass = '' }: { label: string; value: any; valueClass?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}:</span>
      <span className={`font-medium ${valueClass}`}>{value ?? 'N/A'}</span>
    </div>
  );
}
```

### **Example 3: Parse ROV Data Function**

```typescript
function parseROVData(rawData: string, config: any): any {
  const parsed: any = {};

  if (config.parsing_method === 'POSITION_BASED') {
    // Split by delimiter
    const delimiter = config.data_format.delimiter || ',';
    const parts = rawData.trim().split(delimiter);

    // Map fields by position
    config.field_mappings.forEach((mapping: any) => {
      const value = parts[mapping.position - 1]; // 1-indexed
      
      if (value !== undefined) {
        let parsedValue: any = value;

        // Convert data type
        if (mapping.data_type === 'number') {
          parsedValue = parseFloat(value);
        }

        // Apply operation
        if (mapping.operation === 'multiply' && mapping.operation_value) {
          parsedValue *= mapping.operation_value;
        } else if (mapping.operation === 'divide' && mapping.operation_value) {
          parsedValue /= mapping.operation_value;
        } else if (mapping.operation === 'add' && mapping.operation_value) {
          parsedValue += mapping.operation_value;
        } else if (mapping.operation === 'subtract' && mapping.operation_value) {
          parsedValue -= mapping.operation_value;
        }

        parsed[mapping.target_field] = parsedValue;
      }
    });
  } else if (config.parsing_method === 'ID_BASED') {
    // Parse by identifiers
    config.field_mappings.forEach((mapping: any) => {
      const startIdx = rawData.indexOf(mapping.start_id);
      if (startIdx === -1) return;

      const valueStart = startIdx + mapping.start_id.length;
      let valueEnd = rawData.indexOf(mapping.end_id, valueStart);
      if (valueEnd === -1) valueEnd = rawData.length;

      const value = rawData.substring(valueStart, valueEnd).trim();
      
      if (mapping.data_type === 'number') {
        parsed[mapping.target_field] = parseFloat(value);
      } else {
        parsed[mapping.target_field] = value;
      }
    });
  }

  return parsed;
}
```

### **Example 4: Grab Video Frame Function**

```typescript
async function grabVideoFrame(
  videoElement: HTMLVideoElement | string, 
  configId: number
): Promise<Blob> {
  // Get config
  const { data: config } = await supabase
    .from('rov_video_grab_config')
    .select('*')
    .eq('config_id', configId)
    .single();

  if (!config) throw new Error('Video config not found');

  // Get video element
  let video: HTMLVideoElement;
  if (typeof videoElement === 'string') {
    video = document.querySelector(`video[src="${videoElement}"]`) as HTMLVideoElement;
  } else {
    video = videoElement;
  }

  if (!video) throw new Error('Video element not found');

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = config.resolution_width;
  canvas.height = config.resolution_height;
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Failed to get canvas context');

  // Draw video frame
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Apply overlay if enabled
  if (config.enable_overlay && config.overlay_template) {
    applyOverlay(ctx, config.overlay_template, canvas.width, canvas.height);
  }

  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create blob'));
      },
      `image/${config.grab_format.toLowerCase()}`,
      config.grab_quality / 100
    );
  });
}

function applyOverlay(
  ctx: CanvasRenderingContext2D,
  template: any[],
  width: number,
  height: number
) {
  template.forEach((item) => {
    if (item.type === 'text') {
      ctx.font = `${item.font_size || 14}px Arial`;
      ctx.fillStyle = item.color || 'white';
      
      // Add background if specified
      if (item.background) {
        const metrics = ctx.measureText(item.content);
        const padding = 4;
        
        let x = 0, y = 0;
        if (item.position === 'top-left') {
          x = padding;
          y = padding + item.font_size;
        } else if (item.position === 'top-right') {
          x = width - metrics.width - padding;
          y = padding + item.font_size;
        } else if (item.position === 'bottom-left') {
          x = padding;
          y = height - padding;
        } else if (item.position === 'bottom-right') {
          x = width - metrics.width - padding;
          y = height - padding;
        }
        
        ctx.fillStyle = item.background;
        ctx.fillRect(x - padding, y - item.font_size - padding, metrics.width + padding * 2, item.font_size + padding * 2);
        ctx.fillStyle = item.color;
      }

      // Draw text
      let x = 0, y = 0;
      if (item.position === 'top-left') {
        x = 10;
        y = item.font_size + 10;
      } else if (item.position === 'top-right') {
        const metrics = ctx.measureText(item.content);
        x = width - metrics.width - 10;
        y = item.font_size + 10;
      } else if (item.position === 'bottom-left') {
        x = 10;
        y = height - 10;
      } else if (item.position === 'bottom-right') {
        const metrics = ctx.measureText(item.content);
        x = width - metrics.width - 10;
        y = height - 10;
      }

      ctx.fillText(item.content, x, y);
    }
  });
}
```

---

## 🎯 Usage Workflow

### **Complete ROV Inspection Workflow with Data & Video:**

```
1. Create ROV Job
   ├─ Select Data Acquisition Config
   ├─ Select Video Grab Config
   ├─ Enable auto-capture data ✓
   └─ Enable auto-grab video ✓

2. Open Inspection Screen
   ├─ System connects to ROV data stream
   ├─ System initializes video feed
   └─ Live data displays in real-time

3. Navigate to Component
   └─ Select component from list

4. Start Inspection
   ├─ Click "Start Inspection" button
   ├─ System auto-captures ROV data snapshot
   ├─ System auto-grabs video frame
   ├─ Both saved to inspection record
   └─ Inspection form opens

5. Complete Inspection
   ├─ Fill in condition, remarks, etc.
   ├─ ROV data already populated
   ├─ Video frame already attached
   └─ Submit

6. Review Captured Data
   ├─ View ROV telemetry snapshot
   ├─ View grabbed video frame with overlay
   └─ All data linked to inspection record
```

---

## ✅ Summary

The ROV Data & Video Integration provides:

✅ **Seamless integration** with existing data acquisition settings  
✅ **Automatic ROV telemetry capture** at inspection events  
✅ **Automatic video frame grabbing** with data overlay  
✅ **Live data display** during inspections  
✅ **Live video feed** with real-time overlay  
✅ **Configurable settings** per ROV job  
✅ **Full audit trail** of captured data  

This significantly improves ROV inspection efficiency by eliminating manual data entry and ensuring accurate telemetry recording! 🎉
