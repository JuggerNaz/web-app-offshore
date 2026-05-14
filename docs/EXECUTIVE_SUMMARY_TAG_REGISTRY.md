# Executive Summary Master Template Tag Registry

This document serves as the definitive reference for designing DOCX templates for the Executive Summary module.

> [!IMPORTANT]
> **All tags must use double curly braces**: `{{ }}` for text, `{%TAG}` for images.
> The template engine delimiter is `{{ }}`.

---

## 1. General Project Information

| Tag | Source | Description |
| :--- | :--- | :--- |
| `{{PLATFORM_TITLE}}` | Selected Structure | Title of the platform/structure |
| `{{PLATFORM_NAME}}` | Selected Structure | Alias for PLATFORM_TITLE |
| `{{JOB_PACK_NAME}}` | Selected Job Pack | Name of the active jobpack |
| `{{REPORT_NO}}` | Selected SOW | SOW Report Number |
| `{{SOW_REPORT_NO}}` | Selected SOW | Alias for REPORT_NO |
| `{{REPORT_TYPE}}` | UI Toggle | "PRELIMINARY" or "FINAL" |
| `{{DATE}}` | System | Current date (DD/MM/YYYY) |
| `{{CLIENT_NAME}}` | Company Settings → company_name | Name of the client |
| `{{DEPARTMENT}}` | Company Settings → department_name | Department name |
| `{{PROJECT_NAME}}` | Company Settings → project_name | Project name |
| `{{VESSEL_NAME}}` | JobPack metadata → vessel | Inspection vessel name |
| `{{PROJECT_NO}}` | JobPack metadata → inspno | Job pack project number |
| `{{CONTRACTOR}}` | JobPack metadata → contrac | Contractor name |
| `{{START_DATE}}` | JobPack metadata → istart | Job start date (DD/MM/YYYY) |
| `{{END_DATE}}` | JobPack metadata → iend | Job end date (DD/MM/YYYY) |
| `{{PREPARED_BY}}` | Insight data | Name of the person who prepared the report |
| `{{REVIEW_BY}}` | Insight data | Name of the reviewer |
| `{{APPROVE_BY}}` | Insight data | Name of the approver |

### Legacy T_ Aliases (Auto-mapped)
These are automatically derived; you can use either form in your template:

| Legacy Tag | Maps to |
| :--- | :--- |
| `{{T_STR_TITLE}}` | `{{PLATFORM_TITLE}}` |
| `{{T_MON_YR}}` | `{{DATE}}` |
| `{{T_REPORT_NO}}` | `{{REPORT_NO}}` |
| `{{T_CLIENT}}` | `{{CLIENT_NAME}}` |
| `{{T_PROJECT}}` | `{{PROJECT_NO}}` |
| `{{T_VESSEL}}` | `{{VESSEL_NAME}}` |

---

## 2. Image Tags

| Tag | Source | Description |
| :--- | :--- | :--- |
| `{%CLIENT_LOGO}` | Company Settings → logo_url | Client logo from preference settings |
| `{%MGI_GRAPH}` | Generated | Auto-generated Marine Growth profile chart |

> [!NOTE]
> The image module will pre-fetch the logo from the URL set in **Settings → Company Information → Logo**.
> If the logo cannot be loaded, the report will still generate (text-only fallback).

---

## 3. Statistics & Metrics

| Tag | Source | Description |
| :--- | :--- | :--- |
| `{{SOW_COMPLETION}}` | Inspection Summary API | SOW Completion % (0-100) |
| `{{TOTAL_RECORDS}}` | Inspection Summary API | Total inspection records |
| `{{TOTAL_ANOMALIES}}` | Inspection Summary API | Total anomalies found |
| `{{OPEN_ANOMALIES}}` | Inspection Summary API | Currently open anomalies |
| `{{RECTIFIED_ANOMALIES}}` | Inspection Summary API | Rectified anomalies |
| `{{P1_ANOMALIES}}` | Inspection Summary API | Priority 1 anomaly count |
| `{{P2_ANOMALIES}}` | Inspection Summary API | Priority 2 anomaly count |
| `{{P3_ANOMALIES}}` | Inspection Summary API | Priority 3 anomaly count |
| `{{CP_MIN}}` / `{{CP_MAX}}` | Inspection Summary API | Min/Max CP potential readings |
| `{{MGI_AVG}}` / `{{MGI_MAX}}` | Inspection Summary API | Average/Max Marine Growth thickness |
| `{{SCOUR_EXPOSED}}` | Inspection Summary API | Exposed scour pile count |

---

## 4. Section Visibility (Conditionals)
Wrap content in these tags to hide sections when data is missing.

```
{{#HAS_MGI}} ... content ... {{/HAS_MGI}}
{{#HAS_CP}} ... content ... {{/HAS_CP}}
{{#HAS_GVI}} ... content ... {{/HAS_GVI}}
{{#HAS_FMD}} ... content ... {{/HAS_FMD}}
```

---

## 5. Detailed Data Tables (Loops)

### User-Written Sections
- **Loop**: `{{#SECTIONS}} ... {{/SECTIONS}}`
- **Fields**: `{{id}}`, `{{title}}`, `{{content}}`

### Anomalies
- **Loop**: `{{#ANOMALIES}} ... {{/ANOMALIES}}`
- **Fields**: `{{ref}}`, `{{description}}`, `{{priority}}`, `{{status}}`, `{{rectification}}`

### Findings
- **Loop**: `{{#FINDINGS}} ... {{/FINDINGS}}`
- **Fields**: `{{ref}}`, `{{description}}`, `{{priority}}`, `{{status}}`

### CP Records
- **Loop**: `{{#CP_RECORDS}} ... {{/CP_RECORDS}}`
- **Fields**: `{{component}}`, `{{reading}}`, `{{status}}`

### FMD Records
- **Loop**: `{{#FMD_RECORDS}} ... {{/FMD_RECORDS}}`
- **Fields**: `{{component}}`, `{{status}}`, `{{mode}}`

### MGI Records
- **Loop**: `{{#MGI_RECORDS}} ... {{/MGI_RECORDS}}`
- **Fields**: `{{component}}`, `{{thickness}}`, `{{date}}`

### System Alias Records
- **Loop**: `{{#ALIAS_RECORDS}} ... {{/ALIAS_RECORDS}}`
- **Fields**: `{{qid}}`, `{{elevation}}`, `{{description}}`, `{{data.your_field}}`

---

## 6. System Report Aliases (Custom Mapping)
You can assign custom "Aliases" to built-in reports in **Settings → System Mapping** tab.

- **Conditional Tag**: `{{#T_YOUR_ALIAS}} ... {{/T_YOUR_ALIAS}}`
- **Data Loop**: `{{#YOUR_ALIAS_RECORDS}} ... {{/YOUR_ALIAS_RECORDS}}`

---

## 7. Data Flow

```
User selects: Job Pack → Structure → SOW Report No
                    ↓
Fetches from: /api/inspection-records?jobpack_id=X&structure_id=Y&sow_report_no=Z
                    ↓
Fetches from: /api/inspection-summary?jobpack_id=X&structure_id=Y&sow_report_no=Z
                    ↓
Fetches from: /api/company-settings (logo_url, company_name, etc.)
                    ↓
Fetches from: /api/report-aliases (system mapping aliases)
                    ↓
All data assembled into reportData → passed to generateTemplateReport()
                    ↓
Template DOCX fetched → PizZip → Docxtemplater → tag replacement → file download
```

---

## 8. Design Tips
1. **Tables**: Ensure `{{#...}}` and `{{/...}}` are inside the same table row or wrapping the entire table.
2. **Images**: Place `{%CLIENT_LOGO}` where you want the logo. It renders at 150×75px by default.
3. **Empty Data**: Use `{{#HAS_...}}` conditionals to prevent empty headers/sections.
4. **No Formatting Splits**: Ensure the entire tag `{{TAG_NAME}}` has uniform formatting in Word (same font, no partial bold/italic).
