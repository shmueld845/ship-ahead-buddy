-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'processor', 'rep');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles (just for display name + email cache)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Auto create profile + first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count int;
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  SELECT count(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'rep');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'rep');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Shipments
CREATE TABLE public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  customer text,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shipments_created_by_idx ON public.shipments(created_by);
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER shipments_updated_at BEFORE UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Reps view own, processors/admins view all" ON public.shipments
  FOR SELECT TO authenticated USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'processor')
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Reps create own shipments" ON public.shipments
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owner or admin update" ON public.shipments
  FOR UPDATE TO authenticated USING (
    created_by = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Owner or admin delete" ON public.shipments
  FOR DELETE TO authenticated USING (
    created_by = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );

-- Shipment items (each with own ship date + lead time)
CREATE TYPE public.item_status AS ENUM ('pending', 'ready', 'processing', 'shipped', 'cancelled');

CREATE TABLE public.shipment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  vendor text,
  quantity int,
  ship_date date NOT NULL,
  lead_time_days int NOT NULL CHECK (lead_time_days >= 0),
  process_date date GENERATED ALWAYS AS (ship_date - lead_time_days) STORED,
  status item_status NOT NULL DEFAULT 'pending',
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shipment_items_process_date_idx ON public.shipment_items(process_date);
CREATE INDEX shipment_items_shipment_idx ON public.shipment_items(shipment_id);
ALTER TABLE public.shipment_items ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER shipment_items_updated_at BEFORE UPDATE ON public.shipment_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "View items if can view shipment" ON public.shipment_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.shipments s WHERE s.id = shipment_id
      AND (s.created_by = auth.uid()
           OR public.has_role(auth.uid(), 'processor')
           OR public.has_role(auth.uid(), 'admin')))
  );
CREATE POLICY "Insert items if owner of shipment" ON public.shipment_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.shipments s WHERE s.id = shipment_id AND s.created_by = auth.uid())
  );
CREATE POLICY "Update items: owner, processor, admin" ON public.shipment_items
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.shipments s WHERE s.id = shipment_id
      AND (s.created_by = auth.uid()
           OR public.has_role(auth.uid(), 'processor')
           OR public.has_role(auth.uid(), 'admin')))
  );
CREATE POLICY "Delete items: owner or admin" ON public.shipment_items
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.shipments s WHERE s.id = shipment_id
      AND (s.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );

-- App settings (single row)
CREATE TABLE public.app_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  processor_email text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.app_settings (id) VALUES (1);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read settings" ON public.app_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update settings" ON public.app_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));