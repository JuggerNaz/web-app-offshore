# Database Backup & Restore System Guide

This document outlines the backup/restore routine implementation, format comparison details, security rules, and troubleshooting instructions.

---

## 📊 Backup Format Comparison Details

When executing database backups, two format outputs are supported, each tailored to different operational needs:

| Feature | SQL Plaintext (`.sql`) | Compressed Binary (`.dump.gz`) |
| :--- | :--- | :--- |
| **Output Type** | Plaintext SQL script commands | Serialized JSON package compressed with `zlib` |
| **Local Binaries** | ❌ None required | ❌ None required |
| **Human Readable**| ✅ Yes, openable in any editor | ❌ No, compressed binary stream |
| **Restore Speed** | Moderate (executes statement-by-statement) | High (direct bulk insertions via transaction pool) |
| **File Size** | Moderate to Large | Small (highly compressed) |
| **Best For** | Inspecting data, executing manual edits | High-performance restorations, scheduled jobs |

---

## 🛠️ Implementation Details

### 1. Schema & Object Coverage
The routine queries system information schema tables to extract:
* **Table Structures**: Mapped columns, data types, lengths, constraints, defaults, and nullable flags.
* **Table Data**: Rows converted into dynamic parameters.
* **Custom Views**: Definitions sourced from `information_schema.views`.
* **Functions & Routines**: Sourced from `information_schema.routines`.
* **Sequences**: Resetting sequence watermarks.
* **Auth Schema (Supabase)**: User definitions and identities.

### 2. Constraints Bypass during Restore
To prevent foreign key checks or triggers from failing when executing restorations, the pipeline temporarily overrides system replica rules:
```sql
SET session_replication_role = 'replica';
-- Restores all objects and row data here...
SET session_replication_role = 'origin';
```

### 3. Supabase Auth Configuration
Direct `INSERT` statements into the `auth` schema by standard user roles are restricted. The import/restore handler handles these cases by:
* Attempting direct insert if executed as a database superuser.
* Programmatically creating them via the `@supabase/supabase-js` Admin Auth Client using the `SUPABASE_SERVICE_ROLE_KEY`.

---

## 🚀 How to Run the Routine

### Automated Operations (via Dashboard)
1. Navigate to **Utilities** -> **Database Backup** in the sidebar.
2. Select your desired settings (SQL vs Binary format, include views/functions/roles/auth).
3. Click **Run Backup**. Live logs will stream to the console.
4. Download or restore files from the **Backup Files History** table.

### File Storage Location
Backup files are stored locally in the root directory under:
`web-app-offshore/backups/`
