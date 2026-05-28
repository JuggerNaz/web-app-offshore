require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const sql = `
CREATE OR REPLACE FUNCTION fn_learn_numbering_pattern(
    p_user_id VARCHAR,
    p_pattern_type VARCHAR,
    p_sample_value VARCHAR
)
RETURNS void AS $$
DECLARE
    v_format VARCHAR;
    v_sequence_number INTEGER;
BEGIN
    -- Extract pattern format from sample value
    -- Example: "DIVE-2026-001" -> "DIVE-{YYYY}-{###}"
    v_format := regexp_replace(p_sample_value, '\\d{4}', '{YYYY}', 'g');
    v_format := regexp_replace(v_format, '\\d{3,}', '{###}', 'g');
    v_format := regexp_replace(v_format, '\\d{2}', '{##}', 'g');
    v_format := regexp_replace(v_format, '\\d{1}', '{#}', 'g');
    
    -- Extract sequence number (last numeric segment) safely
    IF p_sample_value ~ '\\d+$' THEN
        v_sequence_number := CAST(regexp_replace(p_sample_value, '.*?(\\d+)$', '\\1') AS INTEGER);
    ELSE
        v_sequence_number := 0;
    END IF;
    
    -- Insert or update pattern
    INSERT INTO insp_numbering_patterns (
        user_id, pattern_type, pattern_format, 
        sample_values, last_sequence_number, usage_count
    ) VALUES (
        p_user_id, p_pattern_type, v_format,
        ARRAY[p_sample_value], v_sequence_number, 1
    )
    ON CONFLICT (user_id, pattern_type, pattern_format) 
    DO UPDATE SET
        sample_values = array_append(
            CASE 
                WHEN array_length(insp_numbering_patterns.sample_values, 1) >= 10 
                THEN insp_numbering_patterns.sample_values[2:10]
                ELSE insp_numbering_patterns.sample_values
            END,
            p_sample_value
        ),
        last_sequence_number = v_sequence_number,
        usage_count = insp_numbering_patterns.usage_count + 1,
        confidence_score = LEAST(100.0, insp_numbering_patterns.confidence_score + 5.0),
        last_used_date = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;
  `;

  console.log('Attempting exec_sql with { sql }...');
  const { data: d1, error: e1 } = await supabase.rpc('exec_sql', { sql });
  if (!e1) {
    console.log('Success via exec_sql with sql!', d1);
    return;
  }
  console.log('Failed exec_sql with { sql }:', e1.message);

  console.log('Attempting exec_sql with { sql_query }...');
  const { data: d2, error: e2 } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (!e2) {
    console.log('Success via exec_sql with sql_query!', d2);
    return;
  }
  console.log('Failed exec_sql with { sql_query }:', e2.message);

  console.log('Attempting query_sql with { sql }...');
  const { data: d3, error: e3 } = await supabase.rpc('query_sql', { sql });
  if (!e3) {
    console.log('Success via query_sql with sql!', d3);
    return;
  }
  console.log('Failed query_sql with { sql }:', e3.message);
}

run();
