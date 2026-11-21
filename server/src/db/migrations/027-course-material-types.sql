-- Add support for text/document course materials
ALTER TABLE course_materials
  ADD COLUMN IF NOT EXISTS material_type VARCHAR(20) NOT NULL DEFAULT 'file',
  ADD COLUMN IF NOT EXISTS content TEXT;

ALTER TABLE course_materials
  ALTER COLUMN material_url DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_materials_material_type_check'
  ) THEN
    ALTER TABLE course_materials
      ADD CONSTRAINT course_materials_material_type_check
      CHECK (material_type IN ('file', 'text'));
  END IF;
END $$;
