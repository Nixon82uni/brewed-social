-- ═════════════════════════════════════════════════════════════
-- BREWED Phase 5 — Notifications, Comment Replies & Comment Likes
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ═════════════════════════════════════════════════════════════

-- ── 1. Notificaciones table ──────────────────────────────
CREATE TABLE IF NOT EXISTS notificaciones (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  actor_id    uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('follow','like','comment','reply','comment_like')),
  recipe_id   uuid REFERENCES recetas(id) ON DELETE CASCADE,
  comment_id  uuid REFERENCES comentarios(id) ON DELETE CASCADE,
  read        boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_user     ON notificaciones(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_created  ON notificaciones(created_at DESC);

ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "notif_select" ON notificaciones
  FOR SELECT USING (auth.uid() = user_id);

-- Any authenticated user can insert (to notify others)
CREATE POLICY "notif_insert" ON notificaciones
  FOR INSERT WITH CHECK (auth.uid() = actor_id);

-- Users can update their own (mark as read)
CREATE POLICY "notif_update" ON notificaciones
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own
CREATE POLICY "notif_delete" ON notificaciones
  FOR DELETE USING (auth.uid() = user_id);

-- ── 2. Add parent_id to comentarios (reply threading) ────
ALTER TABLE comentarios ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES comentarios(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_comentarios_parent ON comentarios(parent_id);

-- ── 3. Comment likes table ───────────────────────────────
CREATE TABLE IF NOT EXISTS comment_likes (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id  uuid NOT NULL REFERENCES comentarios(id) ON DELETE CASCADE,
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(comment_id, perfil_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_perfil  ON comment_likes(perfil_id);

ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comment_likes_select" ON comment_likes FOR SELECT USING (true);
CREATE POLICY "comment_likes_insert" ON comment_likes FOR INSERT WITH CHECK (auth.uid() = perfil_id);
CREATE POLICY "comment_likes_delete" ON comment_likes FOR DELETE USING (auth.uid() = perfil_id);

-- ── 4. Recipe saves / bookmarks ──────────────────────────
CREATE TABLE IF NOT EXISTS recipe_saves (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id   uuid NOT NULL REFERENCES recetas(id) ON DELETE CASCADE,
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(recipe_id, perfil_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_saves_perfil ON recipe_saves(perfil_id);
CREATE INDEX IF NOT EXISTS idx_recipe_saves_recipe ON recipe_saves(recipe_id);

ALTER TABLE recipe_saves ENABLE ROW LEVEL SECURITY;

-- Only the saver can see their own saves on the profile, but counts need to be readable by anyone
CREATE POLICY "saves_select" ON recipe_saves FOR SELECT USING (true);
CREATE POLICY "saves_insert" ON recipe_saves FOR INSERT WITH CHECK (auth.uid() = perfil_id);
CREATE POLICY "saves_delete" ON recipe_saves FOR DELETE USING (auth.uid() = perfil_id);
