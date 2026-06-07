# ROV Inspection Settings Integration - Implementation Summary

## Overview
This document summarizes the implementation of centralized settings integration for the ROV Inspection module. The changes ensure that ROV inspections use settings configured in the Settings page (Data Acquisition and Video Capture) rather than creating duplicate configurations.

## Changes Implemented

### 1. **ROVJobSetup Component** 
**File:** `app/dashboard/inspection/rov/components/ROVJobSetup.tsx`

**Changes:**
- ✅ **Removed** data acquisition and video capture configuration dropdowns
- ✅ **Removed** database queries for `rov_data_acquisition_config` and `rov_video_grab_config`
- ✅ **Added** informative banner explaining that Settings page configurations will be used
- ✅ **Added** links to Settings > Data Acquisition and Settings > Video Capture
- ✅ **Simplified** form to only collect deployment details:
  - Deployment Number
  - ROV Serial Number
  - ROV Operator, Supervisor, Report Coordinator
  - Deployment Date and Start Time
- ✅ **Modified** database insert to set `rov_data_config_id` and `video_grab_config_id` to `null`
- ✅ **Added** settings info box showing active configuration source

**Key Features:**
- Clean, focused UI for deployment setup
- Clear messaging about where settings come from
- Easy navigation to Settings pages if changes needed

---

### 2. **ROVLiveData Component**
**File:** `app/dashboard/inspection/rov/components/ROVLiveData.tsx`

**Changes:**
- ✅ **Loads** Data Acquisition settings from localStorage
  - Storage key: `data_acquisition_platform_v1` or `data_acquisition_pipeline_v1`
- ✅ **Dynamically displays** only the fields configured in settings
- ✅ **Implements** Start/Stop buttons for data capture
- ✅ **Supports** serial connection using Web Serial API
- ✅ **Applies** configured parsing method:
  - Position-based parsing
  - ID-based parsing
- ✅ **Applies** field modifications (add, subtract, multiply, divide)
- ✅ **Handles** default data options (System Date, System Time, Online)
- ✅ **Shows** connection status with signal indicator
- ✅ **Displays** configuration info (connection type, baud rate, parsing method, field count)
- ✅ **Shows** helpful message with link to Settings if no configuration found

**Key Features:**
- Real-time data parsing and display
- Web Serial API integration for RS232 connections
- Dynamic field rendering based on user configuration
- Live signal strength indicator
- Last update timestamp
- Graceful error handling for missing settings

**Data Flow:**
1. User clicks "Start Data Capture"
2. Component requests serial port access
3. Opens port with configured baud rate, data bits, parity, stop bits
4. Reads incoming data stream
5. Parses data based on configured method (position or ID-based)
6. Extracts values for each configured field
7. Applies modifications if configured
8. Updates UI with parsed values

---

### 3. **ROVVideoFeed Component**
**File:** `app/dashboard/inspection/rov/components/ROVVideoFeed.tsx`

**Changes:**
- ✅ **Loads** Video Capture settings from localStorage
  - Storage key: `video_recorder_settings`
- ✅ **Implements** Start/Stop buttons for video feed
- ✅ **Uses** configured camera device ID
- ✅ **Applies** configured resolution and frame rate
- ✅ **Uses** configured photo format for frame grabbing
- ✅ **Displays** actual camera stream (not placeholder)
- ✅ **Shows** live overlay with:
  - Current date/time
  - Deployment number
  - ROV serial number
  - LIVE indicator
- ✅ **Implements** frame grabbing with proper format and quality
- ✅ **Generates** filenames using configured prefix
- ✅ **Shows** configuration info (resolution, frame rate, photo format)
- ✅ **Shows** helpful message with link to Settings if no configuration found

**Key Features:**
- Real camera access via getUserMedia API
- Dynamic resolution and frame rate based on settings
- Proper photo format handling (JPEG, PNG, WebP)
- Overlay rendering on captured frames
- Frame counter and last grab timestamp
- AI analysis button (placeholder for future enhancement)

**Video Capture Flow:**
1. User clicks "Start Video Feed"
2. Component requests camera access
3. Applies configured resolution and frame rate constraints
4. Displays live video stream
5. When user clicks "Grab Frame":
   - Draws current video frame to canvas
   - Applies overlay with ROV data
   - Converts to blob using configured format
   - Generates filename with configured prefix
   - (Future: Upload to Supabase Storage)

---

## Settings Storage Structure

### Data Acquisition Settings (localStorage)
```typescript
{
  structureType: 'platform' | 'pipeline',
  connection: {
    type: 'serial' | 'network',
    serial: {
      comPort: string,
      baudRate: number,
      dataBits: 5 | 6 | 7 | 8,
      parity: 'none' | 'even' | 'odd',
      stopBits: 1 | 1.5 | 2
    },
    network: {
      protocol: 'tcp' | 'udp',
      ipAddress: string,
      port: number
    }
  },
  parsing: {
    method: 'position' | 'id',
    stringLength: number,
    startCharacter: string
  },
  fields: [
    {
      id: string,
      label: string,
      positionValue: string,  // For position-based
      idValue: string,        // For ID-based
      length: number,
      modify: 'none' | 'add' | 'subtract' | 'multiply' | 'divide',
      modifyValue: number,
      dataType: 'text' | 'number' | 'date' | 'time',
      defaultDataOption: 'online' | 'system_date' | 'system_time',
      defaultDataValue: string,
      targetField: string
    }
  ]
}
```

### Video Capture Settings (localStorage)
```typescript
{
  video: {
    deviceId: string,
    resolution: string,  // e.g., "1920x1080"
    frameRate: number
  },
  audio: {
    deviceId: string,
    enabled: boolean,
    sampleRate: number,
    channels: number,
    echoCancellation: boolean,
    noiseSuppression: boolean,
    autoGainControl: boolean
  },
  recording: {
    video: {
      format: string,
      quality: string,
      filenamePrefix: string,
      storagePath: string
    },
    photo: {
      format: string,  // e.g., "jpeg-lossy", "png-lossless", "webp-lossy"
      filenamePrefix: string,
      storagePath: string
    }
  }
}
```

---

## User Workflow

### Setup Phase
1. User configures Data Acquisition settings at `/dashboard/settings/data-acquisition`
   - Choose structure type (Platform/Pipeline)
   - Configure connection (Serial/Network)
   - Define parsing method
   - Map data fields
   - Save settings to localStorage

2. User configures Video Capture settings at `/dashboard/settings/video-capture`
   - Select camera device
   - Set resolution and frame rate
   - Choose photo format
   - Set filename prefix
   - Save settings to localStorage

### Inspection Phase
1. User navigates to ROV Inspection page
2. Selects Structure, Job Pack, and SOW
3. Switches to "Setup" tab
4. Fills in deployment details only (no settings configuration)
5. Clicks "Create ROV Deployment"
6. Switches to "Inspection" tab
7. **Data Capture:**
   - Clicks "Start Data Capture" in ROVLiveData panel
   - Data fields appear dynamically based on settings
   - Real-time data parsing and display
8. **Video Feed:**
   - Clicks "Start Video Feed" in ROVVideoFeed panel
   - Camera stream starts with configured resolution/framerate
   - Can grab frames with configured format
   - Overlay applied automatically

---

## Benefits of This Approach

✅ **Single Source of Truth**
- All settings managed in one centralized location
- No duplicate configuration UI
- Easier to maintain and update settings

✅ **User-Friendly**
- Clear messaging about where settings come from
- Easy navigation to Settings pages
- Consistent experience across all inspections

✅ **Flexible**
- Users can change settings globally
- All future inspections use updated settings
- No need to reconfigure for each ROV job

✅ **Maintainable**
- Reduced code duplication
- Settings logic centralized in Settings pages
- Easier to add new fields or options

---

## Future Enhancements

### Data Capture
- [ ] Network (TCP/UDP) connection support
- [ ] Auto-save captured data to database
- [ ] Data history and replay
- [ ] Export captured data to CSV/Excel

### Video Capture
- [ ] Upload grabbed frames to Supabase Storage
- [ ] Link frames to inspection records
- [ ] AI-powered defect detection
- [ ] Video recording capability
- [ ] Drawing tools on live video

### Settings
- [ ] Export/import settings to file
- [ ] Multiple configuration profiles
- [ ] Settings backup to cloud
- [ ] Settings version history

---

## Testing Checklist

### ROVJobSetup
- [ ] Form displays correctly without settings dropdowns
- [ ] Info banner shows with links to Settings
- [ ] Deployment creation succeeds
- [ ] Database record created with null config IDs

### ROVLiveData
- [ ] Shows "No Settings" message when localStorage is empty
- [ ] Link to Settings page works
- [ ] Loads settings correctly from localStorage
- [ ] Start button triggers serial port dialog
- [ ] Data parsing works for position-based method
- [ ] Data parsing works for ID-based method
- [ ] Field modifications applied correctly
- [ ] Default data options work (System Date/Time)
- [ ] Signal indicator updates based on data flow
- [ ] Stop button disconnects properly

### ROVVideoFeed
- [ ] Shows "No Settings" message when localStorage is empty
- [ ] Link to Settings page works
- [ ] Loads settings correctly from localStorage
- [ ] Start button triggers camera permission request
- [ ] Video stream displays at configured resolution
- [ ] Frame grab works with correct format
- [ ] Overlay applied to grabbed frames
- [ ] Filename generated with correct prefix
- [ ] Stop button disconnects camera properly

---

## Browser Requirements

### Web Serial API (for Data Capture)
- ✅ Chrome 89+
- ✅ Edge 89+
- ✅ Opera 75+
- ❌ Firefox (not supported)
- ❌ Safari (not supported)

### getUserMedia API (for Video Capture)
- ✅ Chrome (all modern versions)
- ✅ Edge (all modern versions)
- ✅ Firefox (all modern versions)
- ✅ Safari 11+

### localStorage
- ✅ All modern browsers

---

## Conclusion

The ROV Inspection module now fully integrates with the centralized Settings configuration. This provides a cleaner, more maintainable, and user-friendly experience. Users configure their data acquisition and video capture settings once in the Settings page, and all ROV inspections automatically use those settings.

**Date:** February 12, 2026
**Version:** 1.0
