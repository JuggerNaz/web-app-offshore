# Final Document & Executive Summary Template Reference Guide

A complete, persistent reference guide for designing and updating Microsoft Word (`.docx`) report templates for **Final Documentation**, **Executive Summaries**, **Section Inspection Reports**, **Anomaly / Rectification Registers**, and **Incomplete Scope Breakdown**.

---

## 1. Quick Syntax Overview

Templates use standard **docxtemplater** formatting (both `{TAG}` and `{{TAG}}` delimiters are automatically normalized and supported):

| Syntax Type | Syntax Example | Description |
|---|---|---|
| **Simple Value** | `{PLATFORM_NAME}` | Replaces tag with text or numeric value |
| **Image Tag** | `{%CLIENT_LOGO}` | Embeds an image (PNG/JPEG) into template |
| **Section Loop** | `{#ANOMALIES_ROV}` ... `{/ANOMALIES_ROV}` | Repeats a paragraph or table row for each item in the list |
| **Full Page Report Loop** | `{#RPHOTO_PAGES}` ... `{%page_image}` ... `{/RPHOTO_PAGES}` | Repeats a full page for each rendered report page |
| **Conditional Section** | `{#HAS_ANOMALIES}` ... `{/HAS_ANOMALIES}` | Displays the block only when items exist (`true` / non-empty array) |
| **Inverted Section** | `{#NO_ANOMALIES}` or `{^HAS_ANOMALIES}` | Displays when empty or `false` (e.g. "No anomalies observed") |
| **Raw XML Shading** | `{@color_xml}` or `{@COLOR_XML}` | Inserts raw Word OpenXML for cell background fill |

> **Tip:** To repeat a table row for each item, place `{#LOOP_NAME}` in the **first column** of the table row, and `{/LOOP_NAME}` in the **last column** of that same row. Word will automatically duplicate the row for every item.

---

## 2. Header Logos (Contractor Left, Client Right)

In all offshore inspection reports and Word documents, standard header layout places the **Inspection Contractor Logo on the left** and the **Client Company Logo on the right**.

| Image Tag | Tag Aliases | Source / Configuration | Description & Sizing |
|---|---|---|---|
| `{%CONTRACTOR_LOGO}` | `{%contractor_logo}` | Active Contractor from Library (`CONTR_NAM`) matching Job Pack contractor metadata | Left header logo. Auto-scaled proportionally (max height 80px). |
| `{%CLIENT_LOGO}` | `{%client_logo}`, `{%COMPANY_LOGO}`, `{%company_logo}`, `{%LOGO}`, `{%logo}` | Settings → Company Information → Company Logo (`logo_url`) | Right header logo. Auto-scaled proportionally (max height 80px). |

```
+-----------------------------------------------------------------------------------+
|  {%CONTRACTOR_LOGO}              REPORT TITLE / HEADER              {%CLIENT_LOGO}|
|  Contractor (Left)                                                   Client (Right)|
+-----------------------------------------------------------------------------------+
```

---

## 3. Project & Metadata Tags

These global tags are available throughout the entire document:

### 3.1 Structure & Project Identification
| Tag Name | Example Value | Description |
|---|---|---|
| `{PLATFORM_NAME}` | `BARONIA-A (BN-A)` | Platform / Structure name |
| `{PLATFORM_TITLE}` | `BARONIA-A (BN-A)` | Alias for platform name |
| `{FIELD_NAME}` | `Baronia Field` | Offshore field location |
| `{JOB_PACK_NAME}` | `JP-2024-BNA-001` | Active Job Pack name |
| `{REPORT_NO}` | `SR-BNA-01` | Scope of Work Report Number |
| `{SOW_REPORT_NO}` | `SR-BNA-01` | SOW Report Number |
| `{REPORT_TYPE}` | `FINAL` | Report type (`FINAL` / `PRELIMINARY`) |
| `{DATE}` | `11/10/2026` | Generation date (DD/MM/YYYY) |
| `{SHORT_DATE}` | `Oct 2026` | Month & Year of inspection campaign |
| `{TODAY_SHORT}` | `11-Oct-2026` | Formatted day string (DD-Mon-YYYY) |
| `{INSPECTION_YEAR}` | `2026` | Year of campaign |
| `{PROJECT_NO}` | `PRJ-OFF-2026-09` | Client project number / `inspno` |
| `{PROJECT_NAME}` | `Offshore Underwater Campaign` | Project title from preferences |
| `{DEPARTMENT}` | `Structural Integrity` | Department name from preferences |
| `{STATUS}` | `COMPLETED` | Job pack status |
| `{TASK_TYPE}` | `ROV & DIVE` | Task type classification |
| `{PLAN_TYPE}` | `SCHEDULED` | Campaign plan type |
| `{PROJECT_SCOPE}` | `Topside / Subsea` | Project scope areas |

### 3.2 Contractor & Client Organizations
| Tag Name | Example Value | Description |
|---|---|---|
| `{CONTRACTOR}` | `SWS` | Active contractor code from job pack metadata |
| `{CONTRACTOR_SHORT}` | `SWS` | Short code / Library ID of contractor |
| `{CONTRACTOR_SHORT_UPPER}` | `SWS` | Uppercase short code |
| `{CONTRACTOR_NAME}` | `Subsea World Solutions Sdn Bhd` | Full contractor company description |
| `{CONTRACTOR_NAME_UPPER}` | `SUBSEA WORLD SOLUTIONS SDN BHD`| Uppercase full contractor name |
| `{CONTRACTOR_ADDRESS}` | `Kuala Lumpur, Malaysia` | Registered address / comments |
| `{CONTRACTOR_REF}` | `CR-2026-SWS-01` | Contractor internal reference number |
| `{CONTRACT_REF}` | `CTR-PCSB-2026` | Client contract reference number |
| `{CLIENT_NAME}` | `PETRONAS CARIGALI SDN BHD` | Client organization full name (configured in Preferences → Company Information) |
| `{CLIENT_SHORT}` | `PCSB` | Client short code (configured in Preferences → Company Information) |
| `{CLIENT_SHORT_UPPER}` | `PCSB` | Client short code in uppercase |
| `{COMPANY_REP}` | `Ahmad Razak` | Client company representative |

### 3.3 Campaign Logistics & Vessels
| Tag Name | Example Value | Description |
|---|---|---|
| `{VESSEL_NAME}` | `SK LINE 808` | Primary inspection vessel |
| `{VESSELS_INVOLVED}` | `SK LINE 808, CREST MERCURY` | All vessels utilized during campaign |
| `{START_DATE}` | `12/08/2026` | Campaign start date (DD/MM/YYYY) |
| `{END_DATE}` | `28/08/2026` | Campaign finish date (DD/MM/YYYY) |
| `{INSPECTION_MODE}` | `ROV / AIR DIVING` | Inspection modes & methods |

### 3.4 Signatories & Authorizations
| Tag Name | Example Value | Description |
|---|---|---|
| `{PREPARED_BY}` | `John Doe` | Report author / data coordinator |
| `{PREPARED_DATE}` | `15/09/2026` | Date prepared |
| `{REVIEW_BY}` | `Jane Smith` | Technical reviewer / inspection engineer |
| `{REVIEW_DATE}` | `18/09/2026` | Date reviewed |
| `{APPROVE_BY}` | `Tan Sri Razif` | Approval authority / client manager |
| `{APPROVE_DATE}` | `20/09/2026` | Date approved |

### 3.5 Legacy T_ Aliases (Auto-mapped for Backwards Compatibility)
| Legacy Tag | Maps to |
|---|---|
| `{T_STR_TITLE}` | `{PLATFORM_TITLE}` |
| `{T_MON_YR}` | `{DATE}` |
| `{T_REPORT_NO}` | `{REPORT_NO}` |
| `{T_CLIENT}` | `{CLIENT_NAME}` |
| `{T_PROJECT}` | `{PROJECT_NO}` |
| `{T_VESSEL}` | `{VESSEL_NAME}` |
| `{T_INSPECTION_YEAR}` | `{INSPECTION_YEAR}` |
| `{T_VESSELS_INVOLVED}` | `{VESSELS_INVOLVED}` |
| `{T_CLIENT_SHORT}` | `{CLIENT_SHORT}` |

---

## 4. Sub-Report Full Page Pasting & Inclusions (`_PAGES` Tags)

The report generator can render any inspection report into high-resolution full-page images (with contractor logo on left, client logo on right, standard headers, tables, photos, and footers).

### 4.1 How to Paste Sub-Reports into DOCX Templates
To paste any sub-report into your Final Document template, insert a page loop:

```
{#RPHOTO_PAGES}
{%page_image}
{/RPHOTO_PAGES}
```

#### Fields Available Inside ANY `_PAGES` Loop:
- `{%page_image}` : Rendered full-page image (auto-scaled to fit Word document margins `[680, 800]`)
- `{%photo}` : Alias for `{%page_image}`
- `{qid}` : Page number / identifier (e.g. `Page 1`, `Page 2`)
- `{elevation}` : Elevation / Depth or `-`
- `{description}` : Rendered page description (e.g. `Rendered page 1 of report`)
- `{is_landscape}` : Boolean flag (`true`/`false`)
- `{@section_break}` : OpenXML section break to orient page landscape or portrait

#### Conditional Presence Flags for Every Sub-Report:
- `{#HAS_<TAG>_PAGES}` ... `{/HAS_<TAG>_PAGES}` : Displays only if sub-report has pages
- `{#NO_<TAG>_PAGES}` or `{^HAS_<TAG>_PAGES}` : Displays alternative content if no pages exist

---

### 4.2 Complete List of Sub-Report Page Tags

| Report Category | Template ID | Page Loop Tag | Presence Flag | Inverted Flag |
|---|---|---|---|---|
| **ROV Photography Report** | `rov-photo-report` | `{#RPHOTO_PAGES}` | `{#HAS_RPHOTO_PAGES}` | `{#NO_RPHOTO_PAGES}` |
| **ROV Photography Log** | `rov-photo-log-report` | `{#RPHOTO_LOG_PAGES}` | `{#HAS_RPHOTO_LOG_PAGES}` | `{#NO_RPHOTO_LOG_PAGES}` |
| **Diver Photography Report** | `diving-photo-report` | `{#DPHOTO_PAGES}` | `{#HAS_DPHOTO_PAGES}` | `{#NO_DPHOTO_PAGES}` |
| **Diver Photography Log** | `diving-photo-log-report` | `{#DPHOTO_LOG_PAGES}` | `{#HAS_DPHOTO_LOG_PAGES}` | `{#NO_DPHOTO_LOG_PAGES}` |
| **Defect / Anomaly Report** | `defect-anomaly-report` | `{#DFT_REPORT_PAGES}` | `{#HAS_DFT_REPORT_PAGES}` | `{#NO_DFT_REPORT_PAGES}` |
| **Findings Detail Report** | `findings-report` | `{#FND_REPORT_PAGES}` | `{#HAS_FND_REPORT_PAGES}` | `{#NO_FND_REPORT_PAGES}` |
| **Defect Summary Report** | `defect-summary` | `{#DEFECT_SUMMARY_PAGES}` | `{#HAS_DEFECT_SUMMARY_PAGES}` | `{#NO_DEFECT_SUMMARY_PAGES}` |
| **Findings Summary Report** | `findings-summary` | `{#FINDINGS_SUMMARY_PAGES}` | `{#HAS_FINDINGS_SUMMARY_PAGES}` | `{#NO_FINDINGS_SUMMARY_PAGES}` |
| **Pipeline Defect Summary** | `defect-summary-pipeline` | `{#DEFECT_SUMMARY_PIPELINE_PAGES}` | `{#HAS_DEFECT_SUMMARY_PIPELINE_PAGES}` | `{#NO_DEFECT_SUMMARY_PIPELINE_PAGES}` |
| **Pipeline Findings Summary**| `findings-summary-pipeline`| `{#FINDINGS_SUMMARY_PIPELINE_PAGES}`| `{#HAS_FINDINGS_SUMMARY_PIPELINE_PAGES}`| `{#NO_FINDINGS_SUMMARY_PIPELINE_PAGES}`|
| **Defect Criteria Report** | `defect-criteria-report` | `{#DEFECT_CRITERIA_PAGES}` | `{#HAS_DEFECT_CRITERIA_PAGES}` | `{#NO_DEFECT_CRITERIA_PAGES}` |
| **Job Pack Summary Report** | `jobpack-summary-report` | `{#JOBPACK_SUMMARY_PAGES}` | `{#HAS_JOBPACK_SUMMARY_PAGES}` | `{#NO_JOBPACK_SUMMARY_PAGES}` |
| **Work Scope Status Report** | `work-scope-status-report`| `{#WORK_SCOPE_STATUS_PAGES}`| `{#HAS_WORK_SCOPE_STATUS_PAGES}`| `{#NO_WORK_SCOPE_STATUS_PAGES}`|
| **Work Scope Incomplete** | `work-scope-incomplete-report`| `{#WORK_SCOPE_INCOMPLETE_PAGES}`| `{#HAS_WORK_SCOPE_INCOMPLETE_PAGES}`| `{#NO_WORK_SCOPE_INCOMPLETE_PAGES}`|
| **Diver Log Report** | `diver-log-report` | `{#DIVER_LOG_PAGES}` | `{#HAS_DIVER_LOG_PAGES}` | `{#NO_DIVER_LOG_PAGES}` |
| **Video Log Report** | `video-log-report` | `{#VIDEO_LOG_PAGES}` | `{#HAS_VIDEO_LOG_PAGES}` | `{#NO_VIDEO_LOG_PAGES}` |
| **Structure Summary** | `structure-summary` | `{#STRUCTURE_SUMMARY_PAGES}`| `{#HAS_STRUCTURE_SUMMARY_PAGES}`| `{#NO_STRUCTURE_SUMMARY_PAGES}`|
| **ROV CP Survey Report** | `rov-cp-report` | `{#RCP_PAGES}` *(or `{#CP_REPORT_PAGES}`)* | `{#HAS_RCP_PAGES}` | `{#NO_RCP_PAGES}` |
| **Diving CP Survey Report** | `diving-cpsurv-report` | `{#DCPSURV_PAGES}` *(or `{#DIVING_CP_PAGES}`)* | `{#HAS_DCPSURV_PAGES}` | `{#NO_DCPSURV_PAGES}` |
| **Diving CP Calibration** | `diving-cpclb-report` | `{#CPCLB_PAGES}` | `{#HAS_CPCLB_PAGES}` | `{#NO_CPCLB_PAGES}` |
| **ROV GVI Report** | `rov-gvi-report` | `{#RGVI_PAGES}` *(or `{#GVI_REPORT_PAGES}`)* | `{#HAS_RGVI_PAGES}` | `{#NO_RGVI_PAGES}` |
| **ROV Weld Inspection (WDI)**| `rov-rwdi-report` | `{#RWDI_PAGES}` | `{#HAS_RWDI_PAGES}` | `{#NO_RWDI_PAGES}` |
| **ROV Marine Growth (MGI)** | `rov-mgi-report` | `{#RMGI_PAGES}` *(or `{#MGI_REPORT_PAGES}`)* | `{#HAS_RMGI_PAGES}` | `{#NO_RMGI_PAGES}` |
| **Diving Marine Growth** | `diving-mgi-report` | `{#DMGI_PAGES}` | `{#HAS_DMGI_PAGES}` | `{#NO_DMGI_PAGES}` |
| **ROV Flooded Member (FMD)** | `rov-fmd-report` | `{#RFMD_PAGES}` *(or `{#FMD_REPORT_PAGES}`)* | `{#HAS_RFMD_PAGES}` | `{#NO_RFMD_PAGES}` |
| **Diving Flooded Member** | `diving-fmd-report` | `{#DFMD_PAGES}` | `{#HAS_DFMD_PAGES}` | `{#NO_DFMD_PAGES}` |
| **Diving Measurement (DMSR)**| `diving-measu-report` | `{#DMEAS_PAGES}` *(or `{#MEASU_PAGES}`)* | `{#HAS_DMEAS_PAGES}` | `{#NO_DMEAS_PAGES}` |
| **ROV Caisson Report** | `rov-rcasn-report` | `{#RCASN_PAGES}` | `{#HAS_RCASN_PAGES}` | `{#NO_RCASN_PAGES}` |
| **Diving Caisson (Underwater)**| `diving-dcasn-uw-report`| `{#DCASN_UW_PAGES}` | `{#HAS_DCASN_UW_PAGES}` | `{#NO_DCASN_UW_PAGES}` |
| **Diving Caisson (Topside)** | `diving-dcasn-ts-report`| `{#DCASN_TS_PAGES}` | `{#HAS_DCASN_TS_PAGES}` | `{#NO_DCASN_TS_PAGES}` |
| **ROV Conductor Report** | `rov-rcond-report` | `{#RCOND_PAGES}` | `{#HAS_RCOND_PAGES}` | `{#NO_RCOND_PAGES}` |
| **Diving Conductor (UW)** | `diving-dcond-uw-report`| `{#DCOND_UW_PAGES}` | `{#HAS_DCOND_UW_PAGES}` | `{#NO_DCOND_UW_PAGES}` |
| **Diving Conductor (TS)** | `diving-dcond-ts-report`| `{#DCOND_TS_PAGES}` | `{#HAS_DCOND_TS_PAGES}` | `{#NO_DCOND_TS_PAGES}` |
| **ROV Boat Landing Report** | `rov-bl-report` | `{#RBLTG_PAGES}` | `{#HAS_RBLTG_PAGES}` | `{#NO_RBLTG_PAGES}` |
| **ROV Riser Guard Report** | `rov-rg-report` | `{#RGUARD_PAGES}` | `{#HAS_RGUARD_PAGES}` | `{#NO_RGUARD_PAGES}` |
| **ROV Caisson Guard Report** | `rov-sg-report` | `{#RCG_PAGES}` | `{#HAS_RCG_PAGES}` | `{#NO_RCG_PAGES}` |
| **ROV Conductor Guard** | `rov-cu-report` | `{#RCDG_PAGES}` | `{#HAS_RCDG_PAGES}` | `{#NO_RCDG_PAGES}` |
| **ROV Riser Report** | `rrisi-report` | `{#RRISI_PAGES}` | `{#HAS_RRISI_PAGES}` | `{#NO_RRISI_PAGES}` |
| **Diving Riser Report** | `diving-rrisi-report` | `{#DRRISI_PAGES}` | `{#HAS_DRRISI_PAGES}` | `{#NO_DRRISI_PAGES}` |
| **ROV General Visual Anode (RGANI)** | `rov-anode-report` | `{#RGANI_REPORT_PAGES}` *(or `{#RGANI_PAGES}`)* | `{#HAS_RGANI_PAGES}` | `{#NO_RGANI_PAGES}` |
| **ROV Selected Anode (RSANI)** | `rov-anode-rsani-report` | `{#RSANI_REPORT_PAGES}` *(or `{#RSANI_PAGES}`)* | `{#HAS_RSANI_PAGES}` | `{#NO_RSANI_PAGES}` |
| **Diving Anode Report** | `diving-anode-report` | `{#ANODE_PAGES}` *(or `{#DAN_PAGES}`)* | `{#HAS_ANODE_PAGES}` | `{#NO_ANODE_PAGES}` |
| **Diving Anode Maintenance** | `diving-anmain-report` | `{#ANMAIN_PAGES}` | `{#HAS_ANMAIN_PAGES}` | `{#NO_ANMAIN_PAGES}` |
| **ROV Splash Zone Report** | `rov-splash-zone-report`| `{#RSZCI_PAGES}` *(or `{#SPLASH_ZONE_PAGES}`)* | `{#HAS_RSZCI_PAGES}` | `{#NO_RSZCI_PAGES}` |
| **Diving Splash Zone Report**| `diving-szone-report` | `{#DSZCI_PAGES}` | `{#HAS_DSZCI_PAGES}` | `{#NO_DSZCI_PAGES}` |
| **ROV Selected Node (CVI)** | `rov-selected-node-report`| `{#RSWNI_PAGES}` | `{#HAS_RSWNI_PAGES}` | `{#NO_RSWNI_PAGES}` |
| **Diving Node MPI** | `diving-mpins-report` | `{#MPINS_PAGES}` | `{#HAS_MPINS_PAGES}` | `{#NO_MPINS_PAGES}` |
| **ROV Seabed Survey Report** | `rov-seabed-report` | `{#RSEAB_PAGES}` | `{#HAS_RSEAB_PAGES}` | `{#NO_RSEAB_PAGES}` |
| **ROV Scour Survey Report** | `rov-scour-report` | `{#RSCOR_PAGES}` | `{#HAS_RSCOR_PAGES}` | `{#NO_RSCOR_PAGES}` |
| **ROV Navigation Report** | `rov-navig-report` | `{#NAVIG_PAGES}` *(or `{#RNAVIG_PAGES}`)* | `{#HAS_NAVIG_PAGES}` | `{#NO_NAVIG_PAGES}` |
| **ROV UT Thickness (UTWT)** | `utwt-report` | `{#RUTWT_PAGES}` | `{#HAS_RUTWT_PAGES}` | `{#NO_RUTWT_PAGES}` |
| **Diving UT Thickness (UTWTK)**| `diving-utwtk-report` | `{#UTWTK_PAGES}` | `{#HAS_UTWTK_PAGES}` | `{#NO_UTWTK_PAGES}` |
| **Diving Pipeline Crossing** | `diving-plco-report` | `{#PLCO_PAGES}` | `{#HAS_PLCO_PAGES}` | `{#NO_PLCO_PAGES}` |

---

## 5. Scope of Work (SOW) Status & Task Breakdown

### 5.1 SOW Summary Table (`{#SOW_SUMMARY}`)
Loop through `{#SOW_SUMMARY}` to print the campaign work scope completion register:

```
+----+---------+-------------------+----------------+-------------+---------------+-----------------+--------------+
| No | Task No | Inspection Name   | Scope Target   | Total QIDs  | Complete QIDs | Incomplete QIDs | Completion % |
+----+---------+-------------------+----------------+-------------+---------------+-----------------+--------------+
| {#SOW_SUMMARY}{no} | {task_no} | {task_name} | {scope_target} | {total_items} | {completed_items} | {incomplete_items} | {completion_pct}%{/SOW_SUMMARY} |
+----+---------+-------------------+----------------+-------------+---------------+-----------------+--------------+
```

#### Fields Available Inside `{#SOW_SUMMARY}`:
- `{no}` : Sequential row number
- `{task_no}` : Task / Scope identification number
- `{task_name}` : Inspection scope description (e.g. *“GVI of Jacket Framings”*)
- `{inspection_type}` : Inspection type code (e.g. `RGVI`, `RFMD`, `CP`)
- `{scope_target}` : Target component description
- `{total_items}` : Total planned scope items
- `{completed_items}` : Number of completed items
- `{incomplete_items}` : Number of remaining / incomplete items
- `{completion_pct}` : Numeric percentage completed (e.g. `100` or `75.5`)
- `{status}` : Status text (`COMPLETED`, `IN PROGRESS`, `INCOMPLETE`)
- `{remarks}` : Scope comments or deferral notes

---

## 6. Incomplete Scope & Outstanding Tasks Register

### 6.1 Incomplete Scope Collections
| Loop Collection | Condition Flag | Inverted Flag | Description |
|---|---|---|---|
| `{#INCOMPLETE_RECORDS}` | `{#HAS_INCOMPLETE_RECORDS}` | `{#NO_INCOMPLETE_RECORDS}` | All incomplete inspection records |
| `{#INCOMPLETE_ROV}` | `{#HAS_INCOMPLETE_ROV}` | `{#NO_INCOMPLETE_ROV}` | ROV incomplete scope items |
| `{#INCOMPLETE_DIVE}` | `{#HAS_INCOMPLETE_DIVE}` | `{#NO_INCOMPLETE_DIVE}` | Diver incomplete scope items |
| `{#OUTSTANDING_TASKS}` | `{#HAS_OUTSTANDING_TASKS}` | `{#NO_OUTSTANDING_TASKS}` | Scope of work outstanding task items |
| `{#OUTSTANDING_GROUPS}` | `{#HAS_OUTSTANDING_TASKS}` | `{#NO_OUTSTANDING_TASKS}` | Outstanding tasks grouped by inspection type |

### 6.2 Incomplete Scope Fields Inside Loops
- `{no}` : Sequential row number
- `{qid}` : Unique Component ID (e.g. `K-BRACE-ELV-24`)
- `{component_type}` : Component category (e.g. `HORIZONTAL BRACE`)
- `{elevation}` : Elevation or depth (e.g. `(-)24.0m`)
- `{inspection_type}` : Inspection method (e.g. `FMD`, `GVI`)
- `{task_name}` : Task description
- `{status}` : Status (`INCOMPLETE`, `DEFERRED`)
- `{incomplete_reason}` : Primary reason scope was not completed (e.g. *“Heavy sea state & current (>3.5 knots)”*)
- `{reason}` : Alias for `{incomplete_reason}`
- `{remarks}` : Detailed supervisor remarks
- `{action_plan}` : Proposed follow-up or deferral campaign action
- `{dive_no}` : Associated dive or ROV run number

---

## 7. Anomalies & Findings: ROV, Diving, Rectified & Not Rectified

### 7.1 Global Anomaly Collections
| Loop Collection | Condition Flag | Inverted Flag | Description |
|---|---|---|---|
| `{#ANOMALIES}` | `{#HAS_ANOMALIES}` | `{#NO_ANOMALIES}` | All platform anomalies |
| `{#ANOMALIES_ROV}` | `{#HAS_ANOMALIES_ROV}` | `{#NO_ANOMALIES_ROV}` | ROV inspection anomalies |
| `{#ANOMALIES_DIVE}` | `{#HAS_ANOMALIES_DIVE}` | `{#NO_ANOMALIES_DIVE}` | Diver inspection anomalies |
| `{#FINDINGS}` | `{#HAS_FINDINGS}` | `{#NO_FINDINGS}` | All general findings (non-anomalies) |
| `{#FINDINGS_ROV}` | `{#HAS_FINDINGS_ROV}` | `{#NO_FINDINGS_ROV}` | ROV findings |
| `{#FINDINGS_DIVE}` | `{#HAS_FINDINGS_DIVE}` | `{#NO_FINDINGS_DIVE}` | Diver findings |

### 7.2 Rectified vs. Not Rectified Registers
| Loop Collection | Condition Flag | Inverted Flag | Description |
|---|---|---|---|
| `{#RECTIFIED_ANOMALIES}` | `{#HAS_RECTIFIED_ANOMALIES}` | `{#NO_RECTIFIED_ANOMALIES}` | Rectified / resolved anomalies |
| `{#NOT_RECTIFIED_ANOMALIES}` | `{#HAS_NOT_RECTIFIED_ANOMALIES}` | `{#NO_NOT_RECTIFIED_ANOMALIES}` | Open / outstanding anomalies |

#### Rectification Fields Available Inside Loops:
- `{rectified}` : `"Yes"` / `"No"`
- `{rectified_status}` : `"Rectified"` / `"Not Rectified"`
- `{is_rectified}` : Boolean flag (`true`/`false`)
- `{rectified_remarks}` : Remedial action description (e.g. *“Cleared debris, re-inspected member, wall thickness confirmed within limits”*)
- `{rectification_remarks}` : Alias for `{rectified_remarks}`
- `{rectified_action}` : Remedial action title
- `{rectification_date}` : Date rectification verified (DD/MM/YYYY)
- `{rectified_date}` : Alias for `{rectification_date}`

### 7.3 Priority Filtered Collections
- `{#ANOMALIES_P1}` : Priority 1 critical anomalies (`{#HAS_ANOMALIES_P1}`)
- `{#ANOMALIES_P2}` : Priority 2 medium anomalies (`{#HAS_ANOMALIES_P2}`)
- `{#ANOMALIES_P3}` : Priority 3 low anomalies (`{#HAS_ANOMALIES_P3}`)

### 7.4 Section-Specific Anomaly Loops
| Component / Section | All Anomalies | ROV Specific | Diving Specific | Above Water (Topside) | Underwater (Subsea) |
|---|---|---|---|---|---|
| **GVI (Structure)** | `{#ANOMALIES_GVI}` | `{#ANOMALIES_GVI_ROV}` | `{#ANOMALIES_GVI_DIVE}` | `{#ANOMALIES_GVI_ABOVE}` | `{#ANOMALIES_GVI_UNDER}` |
| **Caissons** | `{#ANOMALIES_CAISSON}` | `{#ANOMALIES_CAISSON_ROV}` | `{#ANOMALIES_CAISSON_DIVE}` | `{#ANOMALIES_CAISSON_TOP}` | `{#ANOMALIES_CAISSON_SUB}` |
| **Conductors** | `{#ANOMALIES_CONDUCTOR}` | `{#ANOMALIES_CONDUCTOR_ROV}` | `{#ANOMALIES_CONDUCTOR_DIVE}` | `{#ANOMALIES_CONDUCTOR_TOP}` | `{#ANOMALIES_CONDUCTOR_SUB}` |
| **Risers** | `{#ANOMALIES_RISER}` | `{#ANOMALIES_RISER_ROV}` | `{#ANOMALIES_RISER_DIVE}` | `{#ANOMALIES_RISER_TOP}` | `{#ANOMALIES_RISER_SUB}` |
| **Boat Landing** | `{#ANOMALIES_BL}` | `{#ANOMALIES_BL_ROV}` | `{#ANOMALIES_BL_DIVE}` | `{#ANOMALIES_BL_TOP}` | `{#ANOMALIES_BL_SUB}` |
| **Boat Bumper** | `{#ANOMALIES_BOATBUMPER}` | `{#ANOMALIES_BOATBUMPER_ROV}` | `{#ANOMALIES_BOATBUMPER_DIVE}` | `{#ANOMALIES_BOATBUMPER_TOP}` | `{#ANOMALIES_BOATBUMPER_SUB}` |
| **Riser Guard** | `{#ANOMALIES_RISERGUARD}` | `{#ANOMALIES_RISERGUARD_ROV}` | `{#ANOMALIES_RISERGUARD_DIVE}` | `{#ANOMALIES_RISERGUARD_TOP}` | `{#ANOMALIES_RISERGUARD_SUB}` |
| **CP Survey** | `{#ANOMALIES_CP}` | `{#ANOMALIES_CP_ROV}` | `{#ANOMALIES_CP_DIVE}` | — | `{#ANOMALIES_CP}` |
| **FMD Survey** | `{#ANOMALIES_FMD}` | `{#ANOMALIES_FMD_ROV}` | `{#ANOMALIES_FMD_DIVE}` | — | `{#ANOMALIES_FMD}` |
| **Marine Growth** | `{#ANOMALIES_MGI}` | `{#ANOMALIES_MGI_ROV}` | `{#ANOMALIES_MGI_DIVE}` | — | `{#ANOMALIES_MGI}` |
| **Scour / Mudline** | `{#ANOMALIES_SCOUR}` | `{#ANOMALIES_SCOUR}` | `{#ANOMALIES_SCOUR}` | — | `{#ANOMALIES_SCOUR}` |
| **Seabed** | `{#ANOMALIES_SEABED}` | `{#ANOMALIES_SEABED}` | `{#ANOMALIES_SEABED}` | — | `{#ANOMALIES_SEABED}` |
| **Splash Zone** | `{#ANOMALIES_SPLASHZONE}`| — | `{#ANOMALIES_SPLASHZONE}`| `{#ANOMALIES_SPLASHZONE}` | — |
| **Anodes** | `{#ANOMALIES_ANODE}` | `{#ANOMALIES_ANODE}` | `{#ANOMALIES_ANODE}` | — | `{#ANOMALIES_ANODE}` |
| **Nodes (CVI/MPI)** | `{#ANOMALIES_NODE}` | `{#ANOMALIES_NODE}` | `{#ANOMALIES_NODE}` | — | `{#ANOMALIES_NODE}` |

### 7.5 Defect & Code Filter Tags
Filter anomalies directly by defect classification or component code:
- `{#ANOMALIES_DEFECT_CP}` (`{#HAS_ANOMALIES_DEFECT_CP}`, `{#NO_ANOMALIES_DEFECT_CP}`)
- `{#ANOMALIES_DEFECT_ANODE_WASTAGE}`
- `{#ANOMALIES_DEFECT_DEBRIS}`
- `{#ANOMALIES_DEFECT_VARIATION_TO_SPEC}`
- `{#ANOMALIES_DEFECT_MARINE_GROWTH}`
- `{#ANOMALIES_DEFECT_CORROSION}`
- `{#ANOMALIES_DEFECT_CRACK}`
- `{#ANOMALIES_DEFECT_DENT}`
- `{#ANOMALIES_DEFECT_<DEFECT_NAME>}` (Dynamic defect filter)
- `{#ANOMALIES_CODE_<COMPONENT_CODE>}` (Dynamic component filter)
- `{#ANOMALIES_INSP_<INSPECTION_TYPE>}` (Dynamic inspection method filter)

---

## 8. Detailed Raw Records Loops (`_RECORDS` Tags)

When raw tabular records are needed without full-page PDF images:

| Section | Loop Tag | Presence Tag | Inverted Tag | Key Row Fields |
|---|---|---|---|---|
| **GVI (All)** | `{#RECORDS_GVI}` | `{#HAS_RECORDS_GVI}` | `{#NO_RECORDS_GVI}` | `{no}`, `{qid}`, `{elevation}`, `{description}` |
| **GVI (ROV)** | `{#RECORDS_GVI_ROV}` | `{#HAS_RECORDS_GVI_ROV}` | `{#NO_RECORDS_GVI_ROV}` | `{no}`, `{qid}`, `{elevation}`, `{description}` |
| **GVI (Diver)** | `{#RECORDS_GVI_DIVE}` | `{#HAS_RECORDS_GVI_DIVE}` | `{#NO_RECORDS_GVI_DIVE}` | `{no}`, `{qid}`, `{elevation}`, `{description}` |
| **CP (ROV)** | `{#RECORDS_CP_ROV}` | `{#HAS_RECORDS_CP_ROV}` | `{#NO_RECORDS_CP_ROV}` | `{no}`, `{qid}`, `{elevation}`, `{cp_reading}`, `{status}` |
| **CP (Diver)** | `{#RECORDS_CP_DIVE}` | `{#HAS_RECORDS_CP_DIVE}` | `{#NO_RECORDS_CP_DIVE}` | `{no}`, `{qid}`, `{elevation}`, `{cp_reading}`, `{status}` |
| **FMD (General)**| `{#RECORDS_FMD}` | `{#HAS_RECORDS_FMD}` | `{#NO_RECORDS_FMD}` | `{no}`, `{qid}`, `{elevation}`, `{fmd_result}`, `{signal}` |
| **MGI (Marine)** | `{#RECORDS_MGI}` | `{#HAS_RECORDS_MGI}` | `{#NO_RECORDS_MGI}` | `{no}`, `{elevation}`, `{hard_thickness}`, `{soft_thickness}` |
| **Scour Survey** | `{#RECORDS_SCOUR}` | `{#HAS_RECORDS_SCOUR}` | `{#NO_RECORDS_SCOUR}` | `{no}`, `{leg_id}`, `{scour_depth}`, `{scour_width}` |
| **Seabed** | `{#RECORDS_SEABED}` | `{#HAS_RECORDS_SEABED}` | `{#NO_RECORDS_SEABED}` | `{no}`, `{item_desc}`, `{location}`, `{debris_size}` |

---

## 9. Statistics & KPI Matrix

### 9.1 Overall Metrics
- `{SOW_COMPLETION}` : Campaign completion percentage (e.g. `100%`)
- `{TOTAL_RECORDS}` : Total inspection records collected
- `{TOTAL_ANOMALIES}` : Total anomalies registered
- `{OPEN_ANOMALIES}` : Open / unrectified anomalies
- `{RECTIFIED_ANOMALIES}` : Rectified anomalies count
- `{P1_ANOMALIES}` : Priority 1 count
- `{P2_ANOMALIES}` : Priority 2 count
- `{P3_ANOMALIES}` : Priority 3 count
- `{CP_MIN}` / `{CP_MAX}` : Minimum / maximum CP potential readings (mV)
- `{MGI_AVG}` / `{MGI_MAX}` : Average / maximum marine growth thickness (mm)
- `{SCOUR_EXPOSED}` : Exposed scour pile count

### 9.2 Anomaly Statistical Table (`{#ANOMALY_SUMMARY_TABLE}`)
```
+--------------------------------+-----------------+---------------+-------------+
| Category                       | Not Rectified   | Rectified     | Total       |
+--------------------------------+-----------------+---------------+-------------+
| {#ANOMALY_SUMMARY_TABLE}{name} | {not_rectified} | {rectified}   | {total}{/ANOMALY_SUMMARY_TABLE} |
+--------------------------------+-----------------+---------------+-------------+
| TOTAL                          | {ANOMALY_SUMMARY_TOTAL_NOT_RECTIFIED} | {ANOMALY_SUMMARY_TOTAL_RECTIFIED} | {ANOMALY_SUMMARY_TOTAL} |
+--------------------------------+-----------------+---------------+-------------+
```

---

## 10. Graphical Charts & Visual Documentation

### 10.1 Auto-Generated Graphical Charts
Insert these image tags directly into your document template:
- `{%MGI_GRAPH}` : Marine Growth Profile vs Water Depth chart
- `{%SEABED_GRAPH}` : Seabed Bathymetry & Seabed Survey Map

### 10.2 Visual Documentation / Engineering Drawings
- Loop: `{#STRUCTURE_VISUALS}` ... `{/STRUCTURE_VISUALS}`
- Presence Flag: `{#HAS_VISUALS}` ... `{/HAS_VISUALS}`
- Fields: `{%photo}` (image), `{title}` (title), `{description}` (caption)

---

## 11. Table of Contents & Dynamic Paragraph Numbering

Use dynamic paragraph numbers in section titles to keep numbering aligned even when sections are reordered:

| Tag Name | Value Example | Description |
|---|---|---|
| `{PARAGRAPH_NO}` | `1.5` | Current section main paragraph number |
| `{PARAGRAPH_NO_1}` | `1.5.1` | Sub-paragraph 1 |
| `{PARAGRAPH_NO_2}` | `1.5.2` | Sub-paragraph 2 |
| `{PARAGRAPH_NO_3}` | `1.5.3` | Sub-paragraph 3 |
| `{PARAGRAPH_NO_4}` | `1.5.4` | Sub-paragraph 4 |
| `{PARAGRAPH_NO_5}` | `1.5.5` | Sub-paragraph 5 |
| `{PARAGRAPH_NO_ANOMALY_SUMMARY}` | `1.30.1` | Anomaly summary sub-heading |
| `{PARAGRAPH_NO_SOW_STATUS}` | `1.30.2` | Scope status sub-heading |
| `{PARAGRAPH_NO_ANOMALY_LIST}` | `1.30.3` | Anomaly register sub-heading |
| `{PARAGRAPH_NO_FINDINGS}` | `1.30.4` | Findings register sub-heading |
| `{PARAGRAPH_NO_INCOMPLETE_SCOPE}`| `1.31.1`| Incomplete scope sub-heading |
| `{PARAGRAPH_NO_OUTSTANDING_TASKS}`| `1.31.2`| Outstanding tasks sub-heading |

---

## 12. Ready-to-Copy Template Examples

### Example 1: Full-Page Inspection Sub-Reports Attachment
```
================================================================================
APPENDIX: DETAILED INSPECTION REPORTS & PHOTOGRAPHY LOGS
================================================================================

{#HAS_RPHOTO_PAGES}
ROV Photography Sheets
{#RPHOTO_PAGES}
{%page_image}
{/RPHOTO_PAGES}
{/HAS_RPHOTO_PAGES}

{#HAS_RPHOTO_LOG_PAGES}
ROV Photography Log
{#RPHOTO_LOG_PAGES}
{%page_image}
{/RPHOTO_LOG_PAGES}
{/HAS_RPHOTO_LOG_PAGES}

{#HAS_DFT_REPORT_PAGES}
Defect & Anomaly Inspection Report
{#DFT_REPORT_PAGES}
{%page_image}
{/DFT_REPORT_PAGES}
{/HAS_DFT_REPORT_PAGES}

{#HAS_RCP_PAGES}
Cathodic Potential (CP) Survey Report
{#RCP_PAGES}
{%page_image}
{/RCP_PAGES}
{/HAS_RCP_PAGES}
```

### Example 2: Rectified Anomalies Register
```
{#HAS_RECTIFIED_ANOMALIES}
Summary of Rectified Anomalies
+----+---------+-----------+----------------------+----------+-----------------------+------------+
| No | QID     | Elevation | Anomaly Description  | Priority | Rectification Remarks | Date       |
+----+---------+-----------+----------------------+----------+-----------------------+------------+
| {#RECTIFIED_ANOMALIES}{no} | {qid} | {elevation} | {defect_description} | {priority} | {rectified_remarks} | {rectification_date}{/RECTIFIED_ANOMALIES} |
+----+---------+-----------+----------------------+----------+-----------------------+------------+
{/HAS_RECTIFIED_ANOMALIES}
```

### Example 3: Incomplete Scope & Reasons Register
```
{#HAS_INCOMPLETE_RECORDS}
Incomplete Inspection Scope Summary
+----+---------+-----------+------------------+--------------------------------+-----------------------+--------------------+
| No | QID     | Elevation | Inspection Type  | Incomplete Reason              | Field Remarks         | Proposed Action    |
+----+---------+-----------+------------------+--------------------------------+-----------------------+--------------------+
| {#INCOMPLETE_RECORDS}{no} | {qid} | {elevation} | {inspection_type} | {incomplete_reason} | {remarks} | {action_plan}{/INCOMPLETE_RECORDS} |
+----+---------+-----------+------------------+--------------------------------+-----------------------+--------------------+
{/HAS_INCOMPLETE_RECORDS}
```

---

## 13. Extensibility & Future Tag Guidelines

When adding new custom tags or report modules in the future:
1. **Header Logos**: Always pair `{%CONTRACTOR_LOGO}` on the left and `{%CLIENT_LOGO}` on the right.
2. **Sub-Reports**: Any new sub-report added to the system automatically gets an alias in `report-data-mapper.ts`. Creating a template alias `XYZ` immediately gives you:
   - `{#XYZ_PAGES}` ... `{%page_image}` ... `{/XYZ_PAGES}`
   - `{#HAS_XYZ_PAGES}` and `{#NO_XYZ_PAGES}`
3. **Custom Variables**: Custom variables defined in **Executive Summary Settings > Custom Variables** (e.g. `SURVEYOR_NAME`, `CLIENT_REP_TITLE`) can be used directly as `{SURVEYOR_NAME}`.
4. **Dynamic Defect Filters**: Any defect classification code entered in IDAMS can be referenced as `{#ANOMALIES_DEFECT_<CODE>}` without modifying code.
