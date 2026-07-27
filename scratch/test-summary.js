const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function run() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Let's get all unique jobpacks and structures from insp_records
  const { data: records, error } = await supabase
    .from("insp_records")
    .select(`
        insp_id,
        status,
        has_anomaly,
        inspection_type_id,
        inspection_type_code,
        inspection_data,
        description,
        component_type,
        component_id,
        dive_job_id,
        rov_job_id,
        sow_report_no,
        jobpack_id,
        structure_components:component_id!left(
            id, q_id, code, metadata
        ),
        inspection_type:inspection_type_id!left(id, code, name),
        insp_anomalies(anomaly_id, anomaly_ref_no, status, defect_type_code, defect_category_code, priority_code, record_category, defect_description)
    `);

  if (error) {
    console.error("Query Error:", error.message);
    return;
  }

  console.log(`Successfully fetched ${records.length} records. Testing mapping logic...`);

  let errorCount = 0;
  records.forEach((r, idx) => {
    try {
      const anomaly = r.insp_anomalies?.[0];
      let defectCode = (
          anomaly?.defect_type_code ||
          anomaly?.defect_category_code ||
          r.inspection_data?.defectCode ||
          r.inspection_data?.defect_code ||
          r.inspection_data?.defect_type ||
          r.inspection_type_code ||
          r.inspection_type?.code ||
          "N/A"
      );
      if (typeof defectCode === 'string') {
          defectCode = defectCode.trim();
          if (defectCode.toLowerCase() === 'undefined' || defectCode === '') {
              defectCode = r.inspection_type_code || r.inspection_type?.code || "N/A";
          }
      } else {
          defectCode = "N/A";
      }

      const compMeta = r.structure_components?.metadata || {};
      const elv1 = compMeta.elv_1 !== undefined && compMeta.elv_1 !== null ? compMeta.elv_1 : null;
      const elv2 = compMeta.elv_2 !== undefined && compMeta.elv_2 !== null ? compMeta.elv_2 : null;
      const compElev = elv1 !== null
          ? (elv2 !== null && elv1 !== elv2
              ? `${elv1} to ${elv2}`
              : `${elv1}`)
          : null;

      let inspectionElev = null;
      if (r.inspection_data && typeof r.inspection_data === 'object') {
          const keys = Object.keys(r.inspection_data);
          const targetKey = keys.find(k => {
              const lk = k.toLowerCase();
              return (lk.includes('elevation') || lk.includes('depth') || lk === 'elv' || lk === 'dep');
          });
          if (targetKey) {
              inspectionElev = r.inspection_data[targetKey];
          }
      }

      const elevation = (
          r.elevation ||
          inspectionElev ||
          r.inspection_data?.elevation ||
          r.inspection_data?.depth ||
          r.inspection_data?.water_depth ||
          compElev ||
          "-"
      );
    } catch (e) {
      errorCount++;
      console.error(`Error mapping record at index ${idx}:`, e.message, r);
    }
  });

  console.log(`Mapping test completed. Errors found: ${errorCount}`);
}

run();
