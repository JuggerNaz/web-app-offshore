# Oracle to Postgres Migration: Conflict Resolution & Data Loss Prevention

This document records the design rules and implementation details of the 3-case conflict resolution strategy utilized during data migration. It ensures zero data loss and prevents accidental overwrites when structure IDs overlap between Oracle and Postgres databases.

---

## The Conflict Scenarios

When a structure is selected for migration from the Oracle database, there are three possible match scenarios against the target Postgres database (Supabase) based on the **ID** (`plat_id` or `pipe_id`) and the **Title/Name** of the structure.

### 🟢 Case 1: Same ID, Different Title (Collision)
*   **Scenario:** Oracle has a structure with ID `258` titled `"PLAT-B"`, but Postgres already has a structure with ID `258` titled `"PLAT-A"`.
*   **Logic:** 
    1.  Detect that the incoming Oracle ID exists in Postgres, but has a different title.
    2.  Prevent updating or overwriting `"PLAT-A"`.
    3.  Generate a brand-new unique ID in Postgres. It queries the database for the maximum existing ID and adds `1` (ensuring it is at least above `10000` to prevent future Oracle key conflicts).
    4.  Create the structure in Postgres under this new ID (e.g. `100258`).
    5.  Map all child tables, components, comments, and attachments under the new ID.
*   **Outcome:** Both structures coexist with separate IDs. Data is completely preserved.

### 🟢 Case 2: Different ID, Same Title (Alignment & Re-migration)
*   **Scenario:** Oracle has a structure with ID `258` titled `"PLAT-B"`, and Postgres already has `"PLAT-B"` but it was saved with ID `123` (or ID `100258` from a previous Case 1 run).
*   **Logic:**
    1.  Detect that a structure with the title `"PLAT-B"` already exists in Postgres.
    2.  Retrieve its existing Postgres ID (`123` or `100258`).
    3.  Skip creating a new platform record in Postgres, or update the existing one in-place while retaining its ID.
    4.  Set this existing Postgres ID as the active target for all components, child tables, comments, and attachments.
    5.  Clean and insert child data under the retrieved ID.
*   **Outcome:** Child data is correctly mapped to the existing platform without creating a duplicate.

### 🟢 Case 3: No Matching ID & Title (Standard Flow)
*   **Scenario:** Neither the ID nor the Title exists in Postgres.
*   **Logic:**
    1.  Create the new structure in Postgres using the original Oracle ID.
    2.  Clean and insert all child records under this ID.
*   **Outcome:** Normal first-time migration.

---

## Core Algorithm Block (in Backend Route)

1.  **Map Incoming Fields:** Build the mapped `pgRecord` from Oracle's `v_structure`/`PLATFORM` record.
2.  **Identify the Title Column:** Look up which PG column is mapped to Oracle `TITLE` or `NAME` (usually `title`).
3.  **Run Pre-Migration Postgres Lookups:**
    ```typescript
    // Fetch by ID
    const { data: existingById } = await supabase.from(targetTable).select('id, title').eq(conflictCol, originalOracleId).maybeSingle();
    // Fetch by Title (case-insensitive)
    const { data: existingByTitle } = await supabase.from(targetTable).select('id, title').ilike(titlePgCol, incomingTitle).maybeSingle();
    ```
4.  **Prioritize Title Matching (Alignment):**
    *   If `existingByTitle` is found: Use its ID. Set `resolvedStructureId = existingByTitle.plat_id`. Do not create a new platform.
    *   If `existingById` is found with a different title: Generate `resolvedStructureId = max(existing_max_id, 10000) + 1`. Create a new platform.
    *   Otherwise: Use `resolvedStructureId = originalOracleId`. Create a new platform.
5.  **Use `resolvedStructureId` for all downstream tables:** All inserts/deletes to components, elevations, comments, and attachments are linked to `resolvedStructureId`.

---

*Last Updated: May 20, 2026*  
*Status: Active & Implemented*
