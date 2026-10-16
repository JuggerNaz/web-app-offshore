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
| `{{SHORT_DATE}}` | JobPack metadata → istart | Short date with month and year from jobpack start date (e.g. Jun 2026) |
| `{{TODAY_SHORT}}` | System | Current date formatted as dd-Mon-yyyy (e.g. 27-Jun-2026) |
| `{{CLIENT_NAME}}` | Preferences → Company Information (`company_name`) | Full Name of the client/operator |
| `{{CLIENT_SHORT}}` | Preferences → Company Information (`client_short`) / Contractors library fallback | The short code/abbreviation for the client (e.g. PCSB) |
| `{{CLIENT_SHORT_UPPER}}` | Preferences (`client_short`) in uppercase | The short code for the client in uppercase (e.g. PCSB) |
| `{{DEPARTMENT}}` | Company Settings → department_name | Department name |
| `{{PROJECT_NAME}}` | Company Settings → project_name | Project name |
| `{{VESSEL_NAME}}` | JobPack metadata → vessel | Inspection vessel name |
| `{{VESSELS_INVOLVED}}` | JobPack metadata → vessel_history | The Vessel names involved in the inspection |
| `{{INSPECTION_YEAR}}` | JobPack start_date / istart | The year of the inspection based on the inspection date year |
| `{{PROJECT_NO}}` | JobPack metadata → inspno | Job pack project number |
| `{{CONTRACTOR}}` | JobPack metadata → contrac | Contractor name |
| `{{CONTRACTOR_SHORT}}` | JobPack metadata → contrac | Contractor short name / Library ID |
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
| `{{T_INSPECTION_YEAR}}` | `{{INSPECTION_YEAR}}` |
| `{{T_VESSELS_INVOLVED}}` | `{{VESSELS_INVOLVED}}` |
| `{{T_CLIENT_SHORT}}` | `{{CLIENT_SHORT}}` |

---

## 2. Image Tags & Header Logos

In offshore reports, standard layout places the **Contractor Logo on the Left** and the **Client Logo on the Right**.

| Tag | Source | Description |
| :--- | :--- | :--- |
| `{%CONTRACTOR_LOGO}` | Active Contractor (`CONTR_NAM` library) | Contractor logo (Left header). Auto-scaled (max height 80px). Alias: `{%contractor_logo}` |
| `{%CLIENT_LOGO}` | Company Settings → logo_url | Client logo (Right header). Auto-scaled (max height 80px). Aliases: `{%COMPANY_LOGO}`, `{%LOGO}` |
| `{%MGI_GRAPH}` | Generated | Auto-generated Marine Growth profile chart |
| `{%SEABED_GRAPH}` | Generated | Auto-generated Seabed bathymetry survey chart |

> [!NOTE]
> The template engine pre-fetches both the contractor logo and client logo automatically.
> Full-page sub-report loops also utilize `{%page_image}` and `{%photo}`.

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
{{#HAS_VISUALS}} ... content ... {{/HAS_VISUALS}}
{{#HAS_SOW_SUMMARY}} ... content ... {{/HAS_SOW_SUMMARY}}
```

### Handling Empty / Not Inspected States (Inverted Conditionals)
To display a message (e.g. *"The component is not present on this platform or was not inspected"*) when data is missing, use the caret `^` (inverted conditional syntax):

```
{{^HAS_FMD}}
Flooded Member Detection (FMD) inspection was not conducted, or this component is not present on this platform.
{{/HAS_FMD}}
```

---

## 5. Detailed Data Tables (Loops)

### User-Written Sections
- **Loop**: `{{#SECTIONS}} ... {{/SECTIONS}}`
- **Fields**: `{{id}}`, `{{title}}`, `{{content}}`

### Anomalies
- **Loop**: `{{#ANOMALIES}} ... {{/ANOMALIES}}`
- **Fields**: `{{no}}` / `{{id}}` (Index), `{{qid}}` (Component ID), `{{elevation}}` (Elev), `{{anomaly}}` / `{{defectCode}}` (Defect code), `{{ref}}` (Ref No), `{{priority}}` (Priority), `{{description}}` (Findings), `{{status}}` (Status), `{{rectification}}` (Rectification / Follow-up notes)

### Findings
- **Loop**: `{{#FINDINGS}} ... {{/FINDINGS}}`
- **Fields**: `{{no}}` / `{{id}}` (Index), `{{qid}}` (Component ID), `{{elevation}}` (Elev), `{{anomaly}}` / `{{defectCode}}` (Defect code), `{{ref}}` (Ref No), `{{priority}}` (Priority), `{{description}}` (Findings), `{{status}}` (Status)

### CP Records
- **Loop**: `{{#CP_RECORDS}} ... {{/CP_RECORDS}}`
- **Fields**: `{{component}}`, `{{reading}}`, `{{status}}`

### FMD Records
- **Loop**: `{{#FMD_RECORDS}} ... {{/FMD_RECORDS}}`
- **Fields**: `{{component}}`, `{{status}}`, `{{mode}}`

### MGI Records
- **Loop**: `{{#MGI_RECORDS}} ... {{/MGI_RECORDS}}`
- **Fields**: `{{component}}`, `{{thickness}}`, `{{date}}`

### SOW Status Summary (IDAMS Scope of Work Status)
- **Loop**: `{{#SOW_SUMMARY}} ... {{/SOW_SUMMARY}}`
- **Fields**: `{{no}}` (Index), `{{inspectionName}}` (Inspection Name), `{{taskType}}` (Task Type), `{{totalQid}}` (Total No. QID), `{{incompleteQid}}` (No. QID Incomplete), `{{incompletePct}}` (% SOW Incomplete)

### Structure Visuals (Engineering Library Photos)
- **Loop**: `{{#STRUCTURE_VISUALS}} ... {{/STRUCTURE_VISUALS}}`
- **Fields**: `{{title}}` (Photo title), `{{description}}` (Photo description), `{%photo}` (The photo image)

### System Alias Records
- **Loop**: `{{#ALIAS_RECORDS}} ... {{/ALIAS_RECORDS}}`
- **Fields**: `{{qid}}`, `{{elevation}}`, `{{description}}`, `{{data.your_field}}`

---

## 6. Sub-Report Page Loops (Pasting Full Inspection Report Pages)

Any built-in inspection sub-report can be rendered as full-page images (with contractor logo on left, client logo on right, standard headers, tables, photos, and footers):

- **Page Loop Tag**: `{{#YOUR_ALIAS_PAGES}} ... {%page_image} ... {{/YOUR_ALIAS_PAGES}}`
- **Fields Inside Loop**: `{%page_image}` (or `{%photo}`), `{{qid}}` (Page title), `{{elevation}}`, `{{description}}`
- **Presence Condition**: `{{#HAS_YOUR_ALIAS_PAGES}} ... {{/HAS_YOUR_ALIAS_PAGES}}`
- **Inverted Condition**: `{{#NO_YOUR_ALIAS_PAGES}} ... {{/NO_YOUR_ALIAS_PAGES}}` (or `{{^HAS_YOUR_ALIAS_PAGES}}`)

### Common Built-In Page Loops:
- `{{#RPHOTO_PAGES}}` : ROV Photography Report pages
- `{{#RPHOTO_LOG_PAGES}}` : ROV Photography Log Report pages
- `{{#DPHOTO_PAGES}}` : Diver Photography Report pages
- `{{#DFT_REPORT_PAGES}}` : Defect & Anomaly Report pages
- `{{#FND_REPORT_PAGES}}` : Findings Detail Report pages
- `{{#DEFECT_SUMMARY_PAGES}}` : Defect Summary pages
- `{{#RCP_PAGES}}` / `{{#CP_REPORT_PAGES}}` : ROV CP Survey Report pages
- `{{#DCPSURV_PAGES}}` / `{{#DIVING_CP_PAGES}}` : Diver CP Survey Report pages
- `{{#RGVI_PAGES}}` : ROV GVI Report pages
- `{{#RMGI_PAGES}}` : ROV Marine Growth Report pages
- `{{#RCASN_PAGES}}` / `{{#CAISSON_PAGES}}` : Standard Caisson Survey Report (ROV) pages [Tabular format]
- `{{#RCASN_SKETCH_PAGES}}` / `{{#CAISSON_SKETCH_PAGES}}` : Caisson Survey (Sketch) Report (ROV) pages [Graphical elevation profiles & sketch]
- `{{#RCOND_PAGES}}` / `{{#CONDUCTOR_PAGES}}` : Standard Conductor Survey Report (ROV) pages [Tabular format]
- `{{#RGANI_REPORT_PAGES}}` / `{{#RGANI_PAGES}}` / `{{#ANODE_PAGES}}` : ROV General Anode Inspection Report pages (`rov-anode-report`)
- `{{#RSANI_REPORT_PAGES}}` / `{{#RSANI_PAGES}}` : ROV Selected Anode Inspection Report pages (`rov-anode-rsani-report`)
- `{{#RBLTG_PAGES}}`, `{{#RGUARD_PAGES}}`, `{{#RRISI_PAGES}}`
- `{{#RSEAB_PAGES}}`, `{{#RSCOR_PAGES}}`, `{{#NAVIG_PAGES}}`
- `{{#WORK_SCOPE_STATUS_PAGES}}`, `{{#WORK_SCOPE_INCOMPLETE_PAGES}}`

---

## 7. System Report Aliases & Data Records (Custom Mapping)
You can assign custom "Aliases" to built-in reports in **Settings → System Mapping** tab.

- **Conditional Tag**: `{{#T_YOUR_ALIAS}} ... {{/T_YOUR_ALIAS}}`
- **Data Loop**: `{{#YOUR_ALIAS_RECORDS}} ... {{/YOUR_ALIAS_RECORDS}}`
- **Page Loop**: `{{#YOUR_ALIAS_PAGES}} ... {%page_image} ... {{/YOUR_ALIAS_PAGES}}`

---

## 8. Data Flow

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

## 9. Design Tips
1. **Tables**: Ensure `{{#...}}` and `{{/...}}` are inside the same table row or wrapping the entire table.
2. **Images**: Place `{%CLIENT_LOGO}` where you want the logo. It renders at 150×75px by default.
3. **Empty Data**: Use `{{#HAS_...}}` conditionals to prevent empty headers/sections.
4. **No Formatting Splits**: Ensure the entire tag `{{TAG_NAME}}` has uniform formatting in Word (same font, no partial bold/italic).
