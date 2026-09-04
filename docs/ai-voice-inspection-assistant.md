# AI Voice-to-Inspection Assistant ("Offshore Smart Scribe")

## Overview
The **AI Voice-to-Inspection Assistant** enables offshore inspectors, divers, and ROV pilot/technicians to log inspection findings via spoken voice. The system automatically transcribes the audio, extracts structured telemetry (e.g., CP readings, UT thickness, elevation/KP, defect classification), generates synthesized findings summaries and recommendations, and auto-inserts multi-readings into sub-tables.

---

## Key Features

1. **Dual-Engine Speech-to-Text**:
   - **Client-Side Web Speech API**: Real-time, zero-latency dictation directly in modern browsers (Chrome, Edge, Safari).
   - **AI Contextual Parsing Endpoint (`/api/ai/parse-inspection-voice`)**: Context-aware LLM pipeline (Gemini 1.5 Flash / OpenAI GPT-4o) trained on offshore jargon (CP potential, Sacrificial Anodes, Wall Thickness loss, Marine Growth, Weld Seams, Scour, Freespan).

2. **Automated Structured Data Extraction**:
   - Primary form fields (e.g., `cp_reading`, `depth`, `elevation`, `fp_kp`, `orientation`, `damage_depth`, `mgi_thickness`).
   - Finding classification (`Complete` vs `Finding` vs `Anomaly` vs `Incomplete`).
   - Defect code matching (e.g., `Marine Growth`, `Corrosion`, `Mechanical Damage`).
   - Synthesized findings summary and recommended actions.
   - Multi-reading batch generation (e.g., extra CP or UT readings with clock positions/depths).

3. **Auditability & Traceability**:
   - Verbatim transcript stored in `raw_voice_transcript` column for QA/QC verification against client standards (e.g., Shell, PETRONAS, Aramco).
   - AI confidence score and processing timestamp.

---

## API Specification: `/api/ai/parse-inspection-voice`

### Request Body (`POST`)
```json
{
  "transcript": "Elevation minus 15 meters on North leg. CP reading is minus 985 millivolts. Marine growth thickness is 45mm hard fouling. Observed isolated pitting corrosion at 3 o'clock. Took two extra UT readings: 14.2mm at 12 o'clock and 13.8mm at 6 o'clock. Recommend re-inspection next campaign.",
  "inspMethod": "ROV",
  "structureType": "platform",
  "componentInfo": {
    "name": "LEG A1",
    "type": "LEG",
    "elevation": "-15m"
  },
  "activeSpec": "RGVI",
  "availableFields": ["verification_depth", "cp_fg_rdg", "mgi_hard_thickness_at_12", "damage_depth"]
}
```

### Response Body (`200 OK`)
```json
{
  "raw_transcript": "Elevation minus 15 meters on North leg. CP reading is minus 985 millivolts...",
  "finding_type": "Anomaly",
  "defect_code": "Corrosion",
  "defect_type": "Pitting Corrosion",
  "priority": "Medium",
  "findings_summary": "North leg at -15m El exhibited -985mV CP potential and 45mm hard marine growth. Isolated pitting corrosion observed at 3 o'clock.",
  "recommendations": "Conduct re-inspection and UT grid mapping during next campaign.",
  "extracted_fields": {
    "verification_depth": "-15",
    "cp_fg_rdg": "-985",
    "mgi_hard_thickness_at_3": "45"
  },
  "additional_readings": [
    { "type": "UT", "reading": 14.2, "clock_position": "12", "location": "12 o'clock" },
    { "type": "UT", "reading": 13.8, "clock_position": "6", "location": "6 o'clock" }
  ],
  "confidence_score": 0.95
}
```

---

## Database Schema Integration

```sql
-- Migration: Add Voice Recognition & AI Audit Columns
ALTER TABLE insp_records 
ADD COLUMN IF NOT EXISTS raw_voice_transcript TEXT,
ADD COLUMN IF NOT EXISTS ai_voice_processed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_confidence_score NUMERIC(4,2);

CREATE INDEX IF NOT EXISTS idx_insp_records_voice ON insp_records(ai_voice_processed_at);
```
