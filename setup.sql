-- ═════════════════════════════════════════════════════════════
-- BREWED — Supabase Table Setup
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS recetas (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    timestamptz DEFAULT now(),

  -- General
  nombre        text NOT NULL,
  metodo        text NOT NULL,
  fecha         date,
  notas         text,

  -- Coffee
  nombre_cafe   text,
  origen        text,
  tostador      text,
  proceso       text,
  tueste        text,

  -- Photo (base64 data URL stored as text)
  foto_url      text,

  -- Grinder
  tipo_molino     text,
  modelo_molino   text,
  clicks_molienda integer,
  grind_setting   text,

  -- Water
  temperatura   text,
  temp_unit     text DEFAULT 'C',
  calidad_agua  text,

  -- Dose
  coffee_grams  text,
  water_grams   text,
  ratio         text,
  yield_grams   text,
  tiempo_total  text,

  -- Stages (JSON array)
  etapas        jsonb DEFAULT '[]'::jsonb,

  -- Social
  likes         integer DEFAULT 0
);

-- Enable Row Level Security (open for all — public feed)
ALTER TABLE recetas ENABLE ROW LEVEL SECURITY;

-- Allow anyone with the anon key to read all recipes
CREATE POLICY "Public read" ON recetas
  FOR SELECT USING (true);

-- Allow anyone with the anon key to insert recipes
CREATE POLICY "Public insert" ON recetas
  FOR INSERT WITH CHECK (true);

-- Allow anyone with the anon key to update recipes (for likes + edits)
CREATE POLICY "Public update" ON recetas
  FOR UPDATE USING (true);

-- Allow anyone with the anon key to delete recipes
CREATE POLICY "Public delete" ON recetas
  FOR DELETE USING (true);
