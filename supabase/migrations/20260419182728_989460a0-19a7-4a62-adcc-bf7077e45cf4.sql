-- Drop the line items table (no longer needed)
DROP TABLE IF EXISTS public.shipment_items CASCADE;
DROP TYPE IF EXISTS public.item_status;

-- Add fields to shipments
ALTER TABLE public.shipments
  ADD COLUMN ship_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN reminder_date date,
  ADD COLUMN status text NOT NULL DEFAULT 'pending',
  ADD COLUMN created_notified_at timestamptz,
  ADD COLUMN reminder_notified_at timestamptz;

-- Drop the temporary default now that column exists
ALTER TABLE public.shipments ALTER COLUMN ship_date DROP DEFAULT;

CREATE INDEX shipments_ship_date_idx ON public.shipments(ship_date);
CREATE INDEX shipments_reminder_date_idx ON public.shipments(reminder_date);