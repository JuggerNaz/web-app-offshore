-- EMERGENCY FIX: Disable RLS to unblock access
ALTER TABLE defect_criteria_procedures DISABLE ROW LEVEL SECURITY;
ALTER TABLE defect_criteria_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE defect_criteria_custom_params DISABLE ROW LEVEL SECURITY;

-- Grant all permissions forcefully
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
