-- =====================================================
-- Scope of Work (SOW) System - Redesigned Structure
-- =====================================================
-- This creates a relational structure for tracking inspection scope
-- with support for component-level inspection tracking and elevation breakup

-- =====================================================
-- 0. Create Sequences
-- =====================================================
-- Sequence for u_sow table
CREATE SEQUENCE IF NOT EXISTS public.u_sow_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- Sequence for u_sow_items table
CREATE SEQUENCE IF NOT EXISTS public.u_sow_items_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- =====================================================
-- 1. SOW Header Table
-- =====================================================
-- Stores the main SOW record for each structure in a job pack
CREATE TABLE IF NOT EXISTS public.u_sow (
  id INTEGER PRIMARY KEY DEFAULT nextval('public.u_sow_id_seq'),
  
  -- Foreign Keys (BIGINT to match existing schema)
  jobpack_id BIGINT NOT NULL,
  structure_id BIGINT NOT NULL,
  
  -- Structure Information (denormalized for quick access)
  structure_type VARCHAR(50) NOT NULL, -- 'PLATFORM' or 'PIPELINE'
  structure_title VARCHAR(255),
  
  -- Report Information
  report_numbers JSONB DEFAULT '[]'::jsonb, -- Array of report numbers: [{"number": "RPT-001", "contractor_ref": "CNT-123", "date": "2024-01-01"}]
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Status tracking
  total_items INTEGER DEFAULT 0,
  completed_items INTEGER DEFAULT 0,
  incomplete_items INTEGER DEFAULT 0,
  pending_items INTEGER DEFAULT 0,
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(255),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by VARCHAR(255),
  
  -- Constraints
  CONSTRAINT unique_sow_per_structure UNIQUE (jobpack_id, structure_id)
);

-- Set sequence ownership
ALTER SEQUENCE public.u_sow_id_seq OWNED BY public.u_sow.id;

-- =====================================================
-- 2. SOW Items Table (Component-Inspection Mapping)
-- =====================================================
-- Stores individual component-inspection combinations with status
CREATE TABLE IF NOT EXISTS public.u_sow_items (
  id INTEGER PRIMARY KEY DEFAULT nextval('public.u_sow_items_id_seq'),
  
  -- Foreign Keys (BIGINT to match existing schema)
  sow_id INTEGER NOT NULL REFERENCES public.u_sow(id) ON DELETE CASCADE,
  component_id BIGINT NOT NULL, -- From structure_components table
  inspection_type_id BIGINT NOT NULL, -- From u_lib_list where lib_code = 'INSPECTION_TYPE'
  
  -- Component Information (denormalized for performance)
  component_qid VARCHAR(255),
  component_type VARCHAR(100),
  
  -- Inspection Information (denormalized)
  inspection_code VARCHAR(50),
  inspection_name VARCHAR(255),
  
  -- Elevation Breakup Support
  -- If elevation_required = true, inspection needs to be done at multiple elevations
  elevation_required BOOLEAN DEFAULT FALSE,
  elevation_data JSONB DEFAULT '[]'::jsonb, 
  -- Format: [
  --   {"elevation": "EL +10.5", "status": "completed", "inspection_count": 2, "last_inspection_date": "2024-01-15"},
  --   {"elevation": "EL +5.0", "status": "pending", "inspection_count": 0}
  -- ]
  
  -- Overall Status for this component-inspection combination
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'incomplete'
  
  -- Inspection tracking
  inspection_count INTEGER DEFAULT 0,
  last_inspection_date TIMESTAMPTZ,
  
  -- Notes
  notes TEXT,
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(255),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by VARCHAR(255),
  
  -- Constraints
  CONSTRAINT unique_component_inspection UNIQUE (sow_id, component_id, inspection_type_id),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'incomplete'))
);

-- Set sequence ownership
ALTER SEQUENCE public.u_sow_items_id_seq OWNED BY public.u_sow_items.id;

-- =====================================================
-- 3. Indexes for Performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_sow_jobpack ON public.u_sow(jobpack_id);
CREATE INDEX IF NOT EXISTS idx_sow_structure ON public.u_sow(structure_id);
CREATE INDEX IF NOT EXISTS idx_sow_created_at ON public.u_sow(created_at);

CREATE INDEX IF NOT EXISTS idx_sow_items_sow ON public.u_sow_items(sow_id);
CREATE INDEX IF NOT EXISTS idx_sow_items_component ON public.u_sow_items(component_id);
CREATE INDEX IF NOT EXISTS idx_sow_items_inspection ON public.u_sow_items(inspection_type_id);
CREATE INDEX IF NOT EXISTS idx_sow_items_status ON public.u_sow_items(status);

-- =====================================================
-- 4. Row Level Security
-- =====================================================
ALTER TABLE public.u_sow ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.u_sow_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for u_sow
CREATE POLICY "Enable read access for all users" ON public.u_sow
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.u_sow
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public.u_sow
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users" ON public.u_sow
  FOR DELETE USING (true);

-- RLS Policies for u_sow_items
CREATE POLICY "Enable read access for all users" ON public.u_sow_items
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.u_sow_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public.u_sow_items
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users" ON public.u_sow_items
  FOR DELETE USING (true);

-- =====================================================
-- 5. Trigger to Update SOW Header Counts
-- =====================================================
CREATE OR REPLACE FUNCTION update_sow_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the counts in the parent SOW record
  UPDATE public.u_sow
  SET 
    total_items = (SELECT COUNT(*) FROM public.u_sow_items WHERE sow_id = NEW.sow_id),
    completed_items = (SELECT COUNT(*) FROM public.u_sow_items WHERE sow_id = NEW.sow_id AND status = 'completed'),
    incomplete_items = (SELECT COUNT(*) FROM public.u_sow_items WHERE sow_id = NEW.sow_id AND status = 'incomplete'),
    pending_items = (SELECT COUNT(*) FROM public.u_sow_items WHERE sow_id = NEW.sow_id AND status = 'pending'),
    updated_at = NOW()
  WHERE id = NEW.sow_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sow_counts
AFTER INSERT OR UPDATE OR DELETE ON public.u_sow_items
FOR EACH ROW
EXECUTE FUNCTION update_sow_counts();

-- =====================================================
-- 6. Comments for Documentation
-- =====================================================
COMMENT ON TABLE public.u_sow IS 'Scope of Work header - one record per structure in a job pack';
COMMENT ON TABLE public.u_sow_items IS 'SOW items - component-inspection combinations with status tracking';

COMMENT ON COLUMN public.u_sow.id IS 'Sequential ID for SOW record';
COMMENT ON COLUMN public.u_sow.jobpack_id IS 'Reference to job pack';
COMMENT ON COLUMN public.u_sow.structure_id IS 'Reference to structure (platform/pipeline)';
COMMENT ON COLUMN public.u_sow.report_numbers IS 'Array of report numbers and contractor references';

COMMENT ON COLUMN public.u_sow_items.id IS 'Sequential ID for SOW item';
COMMENT ON COLUMN public.u_sow_items.sow_id IS 'Reference to parent SOW record';
COMMENT ON COLUMN public.u_sow_items.component_id IS 'Reference to component from structure_components table';
COMMENT ON COLUMN public.u_sow_items.inspection_type_id IS 'Reference to inspection type from u_lib_list';
COMMENT ON COLUMN public.u_sow_items.elevation_required IS 'If true, inspection needs elevation breakup';
COMMENT ON COLUMN public.u_sow_items.elevation_data IS 'Array of elevation-specific inspection data';
COMMENT ON COLUMN public.u_sow_items.status IS 'Overall status: pending, completed, or incomplete';
COMMENT ON COLUMN public.u_sow_items.inspection_count IS 'Number of inspections performed';

-- =====================================================
-- 7. Sample Query Examples
-- =====================================================
/*
-- Get SOW for a specific job pack and structure
SELECT 
  s.*,
  (SELECT COUNT(*) FROM u_sow_items WHERE sow_id = s.id) as total_items
FROM u_sow s
WHERE jobpack_id = 'your-jobpack-id' 
  AND structure_id = 'your-structure-id';

-- Get all SOW items with component and inspection details
SELECT 
  si.*,
  sc.qid as component_qid,
  sc.type as component_type,
  il.code as inspection_code,
  il.name as inspection_name
FROM u_sow_items si
LEFT JOIN structure_components sc ON si.component_id = sc.id
LEFT JOIN u_lib_list il ON si.inspection_type_id = il.id
WHERE si.sow_id = 1;

-- Get SOW items grouped by status
SELECT 
  status,
  COUNT(*) as count,
  ARRAY_AGG(component_qid) as components
FROM u_sow_items
WHERE sow_id = 1
GROUP BY status;

-- Get components requiring elevation breakup
SELECT 
  si.*,
  jsonb_array_length(si.elevation_data) as elevation_count
FROM u_sow_items si
WHERE si.sow_id = 1 
  AND si.elevation_required = true;
*/

