const oracledb = require("oracledb");
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [key, ...value] = line.split('=');
    if (key && value) acc[key.trim()] = value.join('=').trim();
    return acc;
  }, {});

const supabase = createClient(
  envConfig.NEXT_PUBLIC_SUPABASE_URL,
  envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  let conn;
  try {
    oracledb.initOracleClient({ libDir: "C:\\instantclient64_12_2" });
    conn = await oracledb.getConnection({
      user: "sko251",
      password: "sko251",
      connectString: "nq-35:1522/orcl10"
    });

    console.log("Connected to Oracle. Fetching primary BSINS inspections...");

    // 1. Fetch primary inspections from ALLINSPID (Filtered to BSINS type for testing)
    const selectCols = ['INSP_ID', 'INSPNO', 'COMP_ID', 'INSP_TYPE'];
    const primaryRes = await conn.execute(
      `SELECT ${selectCols.join(', ')} 
       FROM ALLINSPID 
       WHERE INSP_ID = 83580`
    );

    const primaryRows = primaryRes.rows.map(row => {
      const obj = {};
      selectCols.forEach((name, idx) => {
        obj[name] = row[idx];
      });
      return obj;
    });

    console.log(`Fetched ${primaryRows.length} primary BSINS inspections.`);

    // 2. Fetch specific BSINS table columns
    const typeCode = "BSINS";
    console.log(`Querying Oracle table ${typeCode} dynamically (SELECT *)...`);
    const typeRes = await conn.execute(
      `SELECT * FROM ${typeCode} WHERE INSP_ID = 83580`
    );

    const metaNames = typeRes.metaData.map(m => m.name.toUpperCase());
    const typeDataByInspId = {};

    typeRes.rows.forEach(row => {
      const inspIdIdx = metaNames.indexOf('INSP_ID');
      if (inspIdIdx === -1) return;
      const inspId = Number(row[inspIdIdx]);
      if (!inspId) return;

      const mappedData = {};
      metaNames.forEach((colName, idx) => {
        const val = row[idx];
        if (val !== undefined && val !== null) {
          const lowerColName = colName.toLowerCase();
          mappedData[lowerColName] = val;
          mappedData[colName] = val;
        }
      });

      typeDataByInspId[inspId] = mappedData;
    });

    // 3. Apply the custom BSINS mapping block exactly as written in route.ts
    for (let i = 0; i < primaryRows.length; i++) {
      const rowObj = primaryRows[i];
      const legacyInspId = Number(rowObj.INSP_ID);
      const legacyInspNo = String(rowObj.INSPNO || "").trim();
      const legacyCompId = Number(rowObj.COMP_ID);
      const legacyInspType = String(rowObj.INSP_TYPE || "").trim();
      const typCode = legacyInspType.toUpperCase().trim() || 'UNKNOWN';

      const mappedTypeData = typeDataByInspId[legacyInspId] || {};

      const combinedData = {
        ...rowObj,
        ...mappedTypeData
      };

      const inspectionDataObj = {
        inspno: legacyInspNo,
        str_id: "327",
        comp_id: String(legacyCompId),
        insp_id: String(legacyInspId)
      };

      Object.keys(combinedData).forEach(k => {
        let val = combinedData[k];
        inspectionDataObj[k] = val;
        inspectionDataObj[k.toLowerCase()] = val;
      });

      // BSINS specific mapping code:
      if (typCode.toUpperCase() === 'BSINS') {
        // Map Member Fields
        inspectionDataObj.no_bolts_pres_memb = typeof combinedData.no_bolts_pres_memb === 'number' ? combinedData.no_bolts_pres_memb : (combinedData.NO_BOLTS_PRES_MEMB !== undefined && combinedData.NO_BOLTS_PRES_MEMB !== null ? Number(combinedData.NO_BOLTS_PRES_MEMB) : null);
        inspectionDataObj.no_bolts_loose_memb = typeof combinedData.no_bolts_loose_memb === 'number' ? combinedData.no_bolts_loose_memb : (combinedData.NO_BOLTS_LOSE_MEMB !== undefined && combinedData.NO_BOLTS_LOSE_MEMB !== null ? Number(combinedData.NO_BOLTS_LOSE_MEMB) : null);
        inspectionDataObj.no_bolts_miss_memb = typeof combinedData.no_bolts_miss_memb === 'number' ? combinedData.no_bolts_miss_memb : (combinedData.NO_BOLTS_MIS_MEMB !== undefined && combinedData.NO_BOLTS_MIS_MEMB !== null ? Number(combinedData.NO_BOLTS_MIS_MEMB) : null);
        
        inspectionDataObj.max_gap_top_member = typeof combinedData.max_gap_top_member === 'number' ? combinedData.max_gap_top_member : (combinedData.GAP_TOP_MEMB !== undefined && combinedData.GAP_TOP_MEMB !== null ? Number(combinedData.GAP_TOP_MEMB) : null);
        inspectionDataObj.max_gap_bottom_member = typeof combinedData.max_gap_bottom_member === 'number' ? combinedData.max_gap_bottom_member : (combinedData.GAP_BOT_MEMB !== undefined && combinedData.GAP_BOT_MEMB !== null ? Number(combinedData.GAP_BOT_MEMB) : null);
        inspectionDataObj.max_flange_misalign_member = typeof combinedData.max_flange_misalign_member === 'number' ? combinedData.max_flange_misalign_member : (combinedData.FLNG_MEMB !== undefined && combinedData.FLNG_MEMB !== null ? Number(combinedData.FLNG_MEMB) : null);
        
        inspectionDataObj.member_clamp_cp = typeof combinedData.member_clamp_cp === 'number' ? combinedData.member_clamp_cp : (combinedData.MEMB_CLMP_CP !== undefined && combinedData.MEMB_CLMP_CP !== null ? Number(combinedData.MEMB_CLMP_CP) : null);
        inspectionDataObj.member_cp = typeof combinedData.member_cp === 'number' ? combinedData.member_cp : (combinedData.MEMB_CP !== undefined && combinedData.MEMB_CP !== null ? Number(combinedData.MEMB_CP) : null);
        inspectionDataObj.member_cp_2 = typeof combinedData.member_cp_2 === 'number' ? combinedData.member_cp_2 : null; // CP 2 doesn't exist in Oracle BSINS

        // Units for member fields
        inspectionDataObj.max_gap_top_member_unit = "mm";
        inspectionDataObj.max_gap_bottom_member_unit = "mm";
        inspectionDataObj.max_flange_misalign_member_unit = "mm";

        // Map Brace Fields
        inspectionDataObj.no_bolts_pres_brace = typeof combinedData.no_bolts_pres_brace === 'number' ? combinedData.no_bolts_pres_brace : (combinedData.NO_BOLTS_PRES_COMP !== undefined && combinedData.NO_BOLTS_PRES_COMP !== null ? Number(combinedData.NO_BOLTS_PRES_COMP) : null);
        inspectionDataObj.no_bolts_loose_brace = typeof combinedData.no_bolts_loose_brace === 'number' ? combinedData.no_bolts_loose_brace : (combinedData.NO_BOLTS_LOSE_COMP !== undefined && combinedData.NO_BOLTS_LOSE_COMP !== null ? Number(combinedData.NO_BOLTS_LOSE_COMP) : null);
        inspectionDataObj.no_bolts_miss_brace = typeof combinedData.no_bolts_miss_brace === 'number' ? combinedData.no_bolts_miss_brace : (combinedData.NO_BOLTS_MIS_COMP !== undefined && combinedData.NO_BOLTS_MIS_COMP !== null ? Number(combinedData.NO_BOLTS_MIS_COMP) : null);
        
        inspectionDataObj.max_gap_top_brace = typeof combinedData.max_gap_top_brace === 'number' ? combinedData.max_gap_top_brace : (combinedData.GAP_TOP_COMP !== undefined && combinedData.GAP_TOP_COMP !== null ? Number(combinedData.GAP_TOP_COMP) : null);
        inspectionDataObj.max_gap_bottom_brace = typeof combinedData.max_gap_bottom_brace === 'number' ? combinedData.max_gap_bottom_brace : (combinedData.GAP_BOT_COMP !== undefined && combinedData.GAP_BOT_COMP !== null ? Number(combinedData.GAP_BOT_COMP) : null);
        inspectionDataObj.max_flange_misalign_brace = typeof combinedData.max_flange_misalign_brace === 'number' ? combinedData.max_flange_misalign_brace : (combinedData.FLNG_COMP !== undefined && combinedData.FLNG_COMP !== null ? Number(combinedData.FLNG_COMP) : null);

        // Units for brace fields
        inspectionDataObj.max_gap_top_brace_unit = "mm";
        inspectionDataObj.max_gap_bottom_brace_unit = "mm";
        inspectionDataObj.max_flange_misalign_brace_unit = "mm";

        // Map Appurtenance Fields
        inspectionDataObj.appurtenance_clamp_type = combinedData.appurtenance_clamp_type || combinedData.RSR_CLMP_TYPE || "—";
        inspectionDataObj.appurtenance_cp = typeof combinedData.appurtenance_cp === 'number' ? combinedData.appurtenance_cp : (combinedData.RISER_CP !== undefined && combinedData.RISER_CP !== null ? Number(combinedData.RISER_CP) : null);
        inspectionDataObj.appurtenance_clamp_cp = typeof combinedData.appurtenance_clamp_cp === 'number' ? combinedData.appurtenance_clamp_cp : (combinedData.RISER_CLMP_CP !== undefined && combinedData.RISER_CLMP_CP !== null ? Number(combinedData.RISER_CLMP_CP) : null);
        inspectionDataObj.stub_cp = typeof combinedData.stub_cp === 'number' ? combinedData.stub_cp : (combinedData.STUB_CP !== undefined && combinedData.STUB_CP !== null ? Number(combinedData.STUB_CP) : null);

        // Map General Fields (Boolean Conversion)
        const toBool = (val) => {
          if (val === undefined || val === null) return false;
          if (typeof val === 'boolean') return val;
          const num = Number(val);
          return num === 1;
        };

        inspectionDataObj.clamp_coating_satisfactory = toBool(combinedData.clamp_coating_satisfactory !== undefined ? combinedData.clamp_coating_satisfactory : combinedData.CLMP_COATING);
        inspectionDataObj.all_bolts_double_nutted = toBool(combinedData.all_bolts_double_nutted !== undefined ? combinedData.all_bolts_double_nutted : combinedData.BOLTS_NUTTED);
        inspectionDataObj.liner_present_member_end = toBool(combinedData.liner_present_member_end !== undefined ? combinedData.liner_present_member_end : combinedData.LINER_MEMB);
        inspectionDataObj.earthing_wire_or_bolt_present = toBool(combinedData.earthing_wire_or_bolt_present !== undefined ? combinedData.earthing_wire_or_bolt_present : combinedData.EARTHWIRE_BOLT);
        inspectionDataObj.liner_present_component_end = toBool(combinedData.liner_present_component_end !== undefined ? combinedData.liner_present_component_end : combinedData.LINER_COMP);
        inspectionDataObj.washers_present_all_bolts = toBool(combinedData.washers_present_all_bolts !== undefined ? combinedData.washers_present_all_bolts : combinedData.WASHER_PRES);
      }

      console.log(`\n--- Mapped Record ${i + 1} (Oracle ID: ${legacyInspId}) ---`);
      console.log("Member Fields:");
      console.log(` - Bolts Present: ${inspectionDataObj.no_bolts_pres_memb}`);
      console.log(` - Bolts Loose: ${inspectionDataObj.no_bolts_loose_memb}`);
      console.log(` - Bolts Missing: ${inspectionDataObj.no_bolts_miss_memb}`);
      console.log(` - Max Gap Top: ${inspectionDataObj.max_gap_top_member} ${inspectionDataObj.max_gap_top_member_unit}`);
      console.log(` - Max Gap Bottom: ${inspectionDataObj.max_gap_bottom_member} ${inspectionDataObj.max_gap_bottom_member_unit}`);
      console.log(` - Max Flange Misalign: ${inspectionDataObj.max_flange_misalign_member} ${inspectionDataObj.max_flange_misalign_member_unit}`);
      console.log(` - Clamp CP: ${inspectionDataObj.member_clamp_cp} mV`);
      console.log(` - CP 1: ${inspectionDataObj.member_cp} mV`);
      console.log(` - CP 2: ${inspectionDataObj.member_cp_2} mV`);

      console.log("Brace Fields:");
      console.log(` - Bolts Present: ${inspectionDataObj.no_bolts_pres_brace}`);
      console.log(` - Bolts Loose: ${inspectionDataObj.no_bolts_loose_brace}`);
      console.log(` - Bolts Missing: ${inspectionDataObj.no_bolts_miss_brace}`);
      console.log(` - Max Gap Top: ${inspectionDataObj.max_gap_top_brace} ${inspectionDataObj.max_gap_top_brace_unit}`);
      console.log(` - Max Gap Bottom: ${inspectionDataObj.max_gap_bottom_brace} ${inspectionDataObj.max_gap_bottom_brace_unit}`);
      console.log(` - Max Flange Misalign: ${inspectionDataObj.max_flange_misalign_brace} ${inspectionDataObj.max_flange_misalign_brace_unit}`);

      console.log("Appurtenance Fields:");
      console.log(` - Clamp Type: ${inspectionDataObj.appurtenance_clamp_type}`);
      console.log(` - Appurtenance CP: ${inspectionDataObj.appurtenance_cp} mV`);
      console.log(` - Clamp CP: ${inspectionDataObj.appurtenance_clamp_cp} mV`);
      console.log(` - Stub CP: ${inspectionDataObj.stub_cp} mV`);

      console.log("General Fields (Booleans):");
      console.log(` - Coating Satisfactory: ${inspectionDataObj.clamp_coating_satisfactory}`);
      console.log(` - Double Nutted: ${inspectionDataObj.all_bolts_double_nutted}`);
      console.log(` - Liner @ Member: ${inspectionDataObj.liner_present_member_end}`);
      console.log(` - Earthing Wire/Bolt: ${inspectionDataObj.earthing_wire_or_bolt_present}`);
      console.log(` - Liner @ Component: ${inspectionDataObj.liner_present_component_end}`);
      console.log(` - Washers Present: ${inspectionDataObj.washers_present_all_bolts}`);
    }

  } catch (err) {
    console.error("Error in test script:", err);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

run();
