-- Add readable ID fields to QR, PR, and PO tables
-- Run this in Supabase SQL Editor

-- Add qr_number to qr table
ALTER TABLE public.qr ADD COLUMN IF NOT EXISTS qr_number text;

-- Add pr_number to pr table
ALTER TABLE public.pr ADD COLUMN IF NOT EXISTS pr_number text;

-- Add po_number to po table
ALTER TABLE public.po ADD COLUMN IF NOT EXISTS po_number text;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_qr_qr_number ON public.qr(qr_number);
CREATE INDEX IF NOT EXISTS idx_pr_pr_number ON public.pr(pr_number);
CREATE INDEX IF NOT EXISTS idx_po_po_number ON public.po(po_number);

-- Create a function to generate the next QR number
CREATE OR REPLACE FUNCTION generate_qr_number()
RETURNS text AS $$
DECLARE
  next_num integer;
  new_number text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(qr_number FROM 4) AS integer)), 0) + 1
  INTO next_num
  FROM public.qr
  WHERE qr_number ~ '^QR-\d+$';
  
  new_number := 'QR-' || LPAD(next_num::text, 3, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Create a function to generate the next PR number
CREATE OR REPLACE FUNCTION generate_pr_number()
RETURNS text AS $$
DECLARE
  next_num integer;
  new_number text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(pr_number FROM 4) AS integer)), 0) + 1
  INTO next_num
  FROM public.pr
  WHERE pr_number ~ '^PR-\d+$';
  
  new_number := 'PR-' || LPAD(next_num::text, 3, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Create a function to generate the next PO number
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS text AS $$
DECLARE
  next_num integer;
  new_number text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 4) AS integer)), 0) + 1
  INTO next_num
  FROM public.po
  WHERE po_number ~ '^PO-\d+$';
  
  new_number := 'PO-' || LPAD(next_num::text, 3, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to auto-generate numbers on insert
CREATE OR REPLACE FUNCTION set_qr_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.qr_number IS NULL OR NEW.qr_number = '' THEN
    NEW.qr_number := generate_qr_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_pr_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.pr_number IS NULL OR NEW.pr_number = '' THEN
    NEW.pr_number := generate_pr_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_po_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
    NEW.po_number := generate_po_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_set_qr_number ON public.qr;
DROP TRIGGER IF EXISTS trigger_set_pr_number ON public.pr;
DROP TRIGGER IF EXISTS trigger_set_po_number ON public.po;

-- Create triggers
CREATE TRIGGER trigger_set_qr_number
  BEFORE INSERT ON public.qr
  FOR EACH ROW
  EXECUTE FUNCTION set_qr_number();

CREATE TRIGGER trigger_set_pr_number
  BEFORE INSERT ON public.pr
  FOR EACH ROW
  EXECUTE FUNCTION set_pr_number();

CREATE TRIGGER trigger_set_po_number
  BEFORE INSERT ON public.po
  FOR EACH ROW
  EXECUTE FUNCTION set_po_number();

SELECT 'Readable ID fields and triggers created successfully!' AS message;
