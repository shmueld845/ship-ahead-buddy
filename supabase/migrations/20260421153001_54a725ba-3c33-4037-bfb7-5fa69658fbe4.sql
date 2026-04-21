-- Drop existing update/delete policies
DROP POLICY IF EXISTS "Owner or admin update" ON public.shipments;
DROP POLICY IF EXISTS "Owner or admin delete" ON public.shipments;

-- Processors and admins can update any shipment
CREATE POLICY "Processor or admin update"
ON public.shipments
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'processor'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
);

-- Owner can update own shipment (reps editing their own)
CREATE POLICY "Owner update own"
ON public.shipments
FOR UPDATE
TO authenticated
USING (created_by = auth.uid());

-- Processor or admin can delete any shipment
CREATE POLICY "Processor or admin delete"
ON public.shipments
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'processor'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
);

-- Owner can delete own shipment
CREATE POLICY "Owner delete own"
ON public.shipments
FOR DELETE
TO authenticated
USING (created_by = auth.uid());