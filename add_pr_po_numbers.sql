-- Add PR and PO number columns with auto-increment triggers
-- This creates readable IDs like PR-001, PR-002, PO-001, PO-002

-- ===================================================
-- Add pr_number column to PR table
-- ===================================================

ALTER TABLE public.pr ADD COLUMN IF NOT EXISTS pr_number TEXT;

-- Create index on pr_number
CREATE INDEX IF NOT EXISTS idx_pr_pr_number ON public.pr(pr_number);

-- ===================================================
-- Add po_number column to PO table  
-- ===================================================

ALTER TABLE public.po ADD COLUMN IF NOT EXISTS po_number TEXT;

-- Create index on po_number
CREATE INDEX IF NOT EXISTS idx_po_po_number ON public.po(po_number);

-- ===================================================
-- Create function to generate PR numbers
-- ===================================================

CREATE OR REPLACE FUNCTION public.generate_pr_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  new_pr_number TEXT;
BEGIN
  -- Get the next number by counting existing PRs
  SELECT COUNT(*) + 1 INTO next_num FROM public.pr WHERE pr_number IS NOT NULL;
  
  -- Generate PR number like PR-001, PR-002, etc.
  new_pr_number := 'PR-' || LPAD(next_num::TEXT, 3, '0');
  
  -- Assign to the new row
  NEW.pr_number := new_pr_number;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===================================================
-- Create function to generate PO numbers
-- ===================================================

CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  new_po_number TEXT;
BEGIN
  -- Get the next number by counting existing POs
  SELECT COUNT(*) + 1 INTO next_num FROM public.po WHERE po_number IS NOT NULL;
  
  -- Generate PO number like PO-001, PO-002, etc.
  new_po_number := 'PO-' || LPAD(next_num::TEXT, 3, '0');
  
  -- Assign to the new row
  NEW.po_number := new_po_number;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===================================================
-- Create triggers
-- ===================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS set_pr_number ON public.pr;
DROP TRIGGER IF EXISTS set_po_number ON public.po;

-- Create trigger for PR
CREATE TRIGGER set_pr_number
  BEFORE INSERT ON public.pr
  FOR EACH ROW
  WHEN (NEW.pr_number IS NULL)
  EXECUTE FUNCTION public.generate_pr_number();

-- Create trigger for PO
CREATE TRIGGER set_po_number
  BEFORE INSERT ON public.po
  FOR EACH ROW
  WHEN (NEW.po_number IS NULL)
  EXECUTE FUNCTION public.generate_po_number();

-- ===================================================
-- Backfill existing PRs with numbers
-- ===================================================

DO $$
DECLARE
  pr_record RECORD;
  counter INTEGER := 0;
BEGIN
  FOR pr_record IN 
    SELECT id FROM public.pr 
    WHERE pr_number IS NULL 
    ORDER BY created_at
  LOOP
    counter := counter + 1;
    UPDATE public.pr 
    SET pr_number = 'PR-' || LPAD(counter::TEXT, 3, '0')
    WHERE id = pr_record.id;
  END LOOP;
END $$;

-- ===================================================
-- Backfill existing POs with numbers
-- ===================================================

DO $$
DECLARE
  po_record RECORD;
  counter INTEGER := 0;
BEGIN
  FOR po_record IN 
    SELECT id FROM public.po 
    WHERE po_number IS NULL 
    ORDER BY created_at
  LOOP
    counter := counter + 1;
    UPDATE public.po 
    SET po_number = 'PO-' || LPAD(counter::TEXT, 3, '0')
    WHERE id = po_record.id;
  END LOOP;
END $$;

-- Success message
SELECT 'PR and PO number columns added successfully!' AS message;
