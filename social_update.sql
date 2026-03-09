-- ═════════════════════════════════════════════════════════════
-- BREWED Phase 3 — Social Network Tables
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ═════════════════════════════════════════════════════════════

-- ── 1. Perfiles ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS perfiles (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  username        text UNIQUE NOT NULL,
  display_name    text NOT NULL,
  bio             text DEFAULT '',
  foto_perfil     text,
  equipo_molino   text DEFAULT '',
  equipo_cafetera text DEFAULT '',
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perfiles_read"   ON perfiles FOR SELECT USING (true);
CREATE POLICY "perfiles_insert" ON perfiles FOR INSERT WITH CHECK (true);
CREATE POLICY "perfiles_update" ON perfiles FOR UPDATE USING (true);
CREATE POLICY "perfiles_delete" ON perfiles FOR DELETE USING (true);

-- ── 2. Add author to recetas ──────────────────────────────
ALTER TABLE recetas ADD COLUMN IF NOT EXISTS perfil_id uuid REFERENCES perfiles(id) ON DELETE SET NULL;

-- ── 3. Follows ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follows (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  following_id  uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(follower_id, following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower  ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows_read"   ON follows FOR SELECT USING (true);
CREATE POLICY "follows_insert" ON follows FOR INSERT WITH CHECK (true);
CREATE POLICY "follows_delete" ON follows FOR DELETE USING (true);

-- ── 4. Comentarios ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comentarios (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  receta_id   uuid NOT NULL REFERENCES recetas(id) ON DELETE CASCADE,
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  contenido   text NOT NULL,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comentarios_receta ON comentarios(receta_id);

ALTER TABLE comentarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comentarios_read"   ON comentarios FOR SELECT USING (true);
CREATE POLICY "comentarios_insert" ON comentarios FOR INSERT WITH CHECK (true);
CREATE POLICY "comentarios_delete" ON comentarios FOR DELETE USING (true);

-- ── 5. Likes (unique per user per recipe) ─────────────────
CREATE TABLE IF NOT EXISTS recipe_likes (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  receta_id   uuid NOT NULL REFERENCES recetas(id) ON DELETE CASCADE,
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(receta_id, perfil_id)
);
CREATE INDEX IF NOT EXISTS idx_likes_receta ON recipe_likes(receta_id);
CREATE INDEX IF NOT EXISTS idx_likes_perfil ON recipe_likes(perfil_id);

ALTER TABLE recipe_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_read"   ON recipe_likes FOR SELECT USING (true);
CREATE POLICY "likes_insert" ON recipe_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "likes_delete" ON recipe_likes FOR DELETE USING (true);

-- ── 6. Indexes on recetas for social queries ──────────────
CREATE INDEX IF NOT EXISTS idx_recetas_perfil ON recetas(perfil_id);
CREATE INDEX IF NOT EXISTS idx_recetas_metodo ON recetas(metodo);
