# Reference Memory Document: Multi-Jobpack Migration & QID Component Matching

## 1. Core Architecture & Workflow

In offshore asset integrity management, inspection survey campaigns for a platform or pipeline occur across multiple survey years (e.g. 2013 ROV, 2017 Diving, 2021 Survey) and may originate from different Oracle database instances.

The Data Migration Pipeline implements a 2-phase non-destructive incremental migration strategy:

### Phase 1: Initial Structure & Baseline Jobpack Migration
- Migrates the structure master specifications (`u_pipeline` or `platform`), parent structure record, and baseline components (`structure_components`).
- Auto-creates the default Pipeline trunkline component (`PIPE-MAIN-01`, `Q_ID: PIPE-<str_id>`) with KP range matching the pipeline's total length (`0.000` to `plength km`).
- Migrates the initial jobpack, SOW, ROV/diving deployments, video logs, inspection records, findings, anomalies, and attachments.

### Phase 2: Incremental Multi-Jobpack Migration & Preservation Rules
- **Multi-Jobpack Selection**: Users can select individual job packs or multi-select/batch all job packs via checkboxes in the UI ([`app/dashboard/utilities/migration/page.tsx`](file:///c:/Users/nq352/Documents/GitHub/web-app-offshore/app/dashboard/utilities/migration/page.tsx)).
- **Incremental Preservation Switches**:
  - `updateStructureSpecs` (Default `false`): Skips overwriting structure specs if the structure already exists in PostgreSQL, preserving clean specs.
  - `updateComponentSpecs` (Default `false`): Skips overwriting component specs in PostgreSQL if matching components already exist.
  - `insertNewComponents` (Default `true`): Discovers and inserts new components found in the selected survey campaign.
  - `migrateAttachments` (Default `true`): Migrates attachments without deleting previously migrated media files.

---

## 2. Cross-Database QID Component Reconciliation Engine

Across different Oracle databases, the numeric `COMP_ID` often differs for the same physical component, but the **`Q_ID`** (or **`ID_NO`**, e.g., `PIPE-1010`, `LEG-A1`, `BRACE-01`) is the canonical physical identifier.

### 2-Tier Resolution Logic ([`app/api/migration/execute/route.ts`](file:///c:/Users/nq352/Documents/GitHub/web-app-offshore/app/api/migration/execute/route.ts)):
1. Pre-index existing PostgreSQL components for the structure:
   - `existingCompByQIdMap`: `Map<string, number>` (`q_id.toLowerCase().trim() -> pg_id`)
   - `existingCompByIdNoMap`: `Map<string, number>` (`id_no.toLowerCase().trim() -> pg_id`)
   - `existingCompByCompIdMap`: `Map<number, number>` (`comp_id -> pg_id`)
2. For each incoming component from Oracle:
   - Match by `Q_ID` first.
   - If not found, match by `ID_NO`.
   - If not found, match by `COMP_ID`.
3. If matched:
   - Register the Oracle `COMP_ID` to the existing PostgreSQL ID in `compIdMap` and `qIdMap`.
   - All inspection findings, video logs, ROV/diving surveys, and attachments link to this existing PostgreSQL component.
   - Only update `structure_components` if `updateComponentSpecs === true`.
4. If not matched:
   - If `insertNewComponents === true`, insert as a new component and record its new PostgreSQL ID.

---

## 3. Scoped Relational Purging & Data Safety

- Purging during migration re-runs is strictly scoped to `oracle_insp_no IN (selectedInspNos)`.
- When migrating Jobpack 2, earlier survey campaigns (Jobpack 1) are **never deleted or modified**.

---

## 4. Multi-Jobpack Data Propagation & Relational Matching

When migrating multiple job packs simultaneously or incrementally:
- **`INSPNO` Matching Across All Entities**:
  - `LOGS`: Filters across all active `INSPNO`s using `INSPNO IN (...)` / `targetSet.has(INSPNO)`.
  - **Video Tapes & Video Logs**: Groups video tapes by `TAPE_NO` and links them to their corresponding `INSPNO` / `jobpack_id` without limiting to the first job pack.
  - **ROV & Diving Jobs**: Created and linked for each `INSPNO` campaign, including automatic default job fallback (`DEFAULT-${inspNo}-ROV` / `DEFAULT-${inspNo}-DIV`) when legacy dive logs are unassociated.
  - **Primary Inspections (`PLATGI` & `ALLINSPID`)**: Primary inspection rows and type tables (CP, Debris, Marine Growth, Coating, Cathodic Protection, Visual) are retrieved and migrated for all selected `INSPNO`s.
  - **Pipeline Navigation Surveys (`NAVIG`)**: Iterates and maps navigation records across all selected `INSPNO` campaigns in [`utils/pipeline-migration-handler.ts`](file:///c:/Users/nq352/Documents/GitHub/web-app-offshore/utils/pipeline-migration-handler.ts).
  - **SOW Report Number Matching**: Resolves `sow_report_no` dynamically matching both the component and the campaign's `INSPNO`.
  - **Attachments (`U_ATTACH_1`)**: Multi-jobpack attachment ingestion ensuring all files across the selected `INSPNO`s are copied to storage and recorded in `asset_attachments`.

---

## 5. Key File References

- **Migration UI & Selection Controls**: [`app/dashboard/utilities/migration/page.tsx`](file:///c:/Users/nq352/Documents/GitHub/web-app-offshore/app/dashboard/utilities/migration/page.tsx)
- **Backend Migration Executor & QID Engine**: [`app/api/migration/execute/route.ts`](file:///c:/Users/nq352/Documents/GitHub/web-app-offshore/app/api/migration/execute/route.ts)
- **Pipeline Specialized Handlers**: [`utils/pipeline-migration-handler.ts`](file:///c:/Users/nq352/Documents/GitHub/web-app-offshore/utils/pipeline-migration-handler.ts)
- **Component Edit Dialog & KP Mapping**: [`components/dialogs/component-edit-dialog.tsx`](file:///c:/Users/nq352/Documents/GitHub/web-app-offshore/components/dialogs/component-edit-dialog.tsx)
