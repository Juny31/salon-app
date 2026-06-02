-- ============================================
-- SALON APP — Tables et politiques RLS
-- À coller dans le SQL Editor de Supabase
-- ============================================

-- 1. Clients
CREATE TABLE IF NOT EXISTS salon_clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE salon_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "salon_clients_all" ON salon_clients USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Services (catalogue)
CREATE TABLE IF NOT EXISTS salon_services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'Autre',
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  duration_minutes INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE salon_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "salon_services_all" ON salon_services USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Visites / Ventes
CREATE TABLE IF NOT EXISTS salon_visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES salon_clients(id) ON DELETE SET NULL,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'especes',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE salon_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "salon_visits_all" ON salon_visits USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Prestations d'une visite
CREATE TABLE IF NOT EXISTS salon_visit_services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID REFERENCES salon_visits(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES salon_services(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  quantity INTEGER DEFAULT 1
);
ALTER TABLE salon_visit_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "salon_visit_services_all" ON salon_visit_services
  USING (EXISTS (SELECT 1 FROM salon_visits WHERE salon_visits.id = visit_id AND salon_visits.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM salon_visits WHERE salon_visits.id = visit_id AND salon_visits.user_id = auth.uid()));

-- 5. Produits (stock)
CREATE TABLE IF NOT EXISTS salon_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'Autre',
  stock_quantity DECIMAL(10,2) DEFAULT 0,
  min_stock DECIMAL(10,2) DEFAULT 0,
  unit TEXT DEFAULT 'unité',
  price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE salon_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "salon_products_all" ON salon_products USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Mouvements de stock
CREATE TABLE IF NOT EXISTS salon_stock_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES salon_products(id) ON DELETE CASCADE NOT NULL,
  quantity_change DECIMAL(10,2) NOT NULL,
  reason TEXT,
  movement_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE salon_stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "salon_stock_movements_all" ON salon_stock_movements USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
