-- Add PR number column
ALTER TABLE public.pr ADD COLUMN IF NOT EXISTS pr_number TEXT;
CREATE INDEX IF NOT EXISTS idx_pr_pr_number ON public.pr(pr_number);

-- Add PO number column
ALTER TABLE public.po ADD COLUMN IF NOT EXISTS po_number TEXT;
CREATE INDEX IF NOT EXISTS idx_po_po_number ON public.po(po_number);

-- Function to generate PR numbers
CREATE OR REPLACE FUNCTION public.generate_pr_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  new_pr_number TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO next_num FROM public.pr WHERE pr_number IS NOT NULL;
  new_pr_number := 'PR-' || LPAD(next_num::TEXT, 3, '0');
  NEW.pr_number := new_pr_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate PO numbers
CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  new_po_number TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO next_num FROM public.po WHERE po_number IS NOT NULL;
  new_po_number := 'PO-' || LPAD(next_num::TEXT, 3, '0');
  NEW.po_number := new_po_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers
DROP TRIGGER IF EXISTS set_pr_number ON public.pr;
DROP TRIGGER IF EXISTS set_po_number ON public.po;

-- Create PR trigger
CREATE TRIGGER set_pr_number
  BEFORE INSERT ON public.pr
  FOR EACH ROW
  WHEN (NEW.pr_number IS NULL)
  EXECUTE FUNCTION public.generate_pr_number();

-- Create PO trigger
CREATE TRIGGER set_po_number
  BEFORE INSERT ON public.po
  FOR EACH ROW
  WHEN (NEW.po_number IS NULL)
  EXECUTE FUNCTION public.generate_po_number();

-- Backfill existing PRs
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

-- Backfill existing POs
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

SELECT 'PR and PO numbers added successfully' AS message;
