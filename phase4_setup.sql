-- ═════════════════════════════════════════════════════════════
-- BREWED Phase 4 — Auth, Storage & Privacy
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ═════════════════════════════════════════════════════════════

-- ── 1. Add visibility to recetas ──────────────────────────
ALTER TABLE recetas ADD COLUMN IF NOT EXISTS visibilidad text DEFAULT 'publica'
  CHECK (visibilidad IN ('publica','seguidores','privada'));

-- ── 2. Drop old permissive RLS policies ───────────────────
DO $$ BEGIN
  -- perfiles
  DROP POLICY IF EXISTS "perfiles_read"   ON perfiles;
  DROP POLICY IF EXISTS "perfiles_insert" ON perfiles;
  DROP POLICY IF EXISTS "perfiles_update" ON perfiles;
  DROP POLICY IF EXISTS "perfiles_delete" ON perfiles;
  -- recetas
  DROP POLICY IF EXISTS "Public read"     ON recetas;
  DROP POLICY IF EXISTS "Public insert"   ON recetas;
  DROP POLICY IF EXISTS "Public update"   ON recetas;
  DROP POLICY IF EXISTS "Public delete"   ON recetas;
  -- follows
  DROP POLICY IF EXISTS "follows_read"    ON follows;
  DROP POLICY IF EXISTS "follows_insert"  ON follows;
  DROP POLICY IF EXISTS "follows_delete"  ON follows;
  -- comentarios
  DROP POLICY IF EXISTS "comentarios_read"   ON comentarios;
  DROP POLICY IF EXISTS "comentarios_insert" ON comentarios;
  DROP POLICY IF EXISTS "comentarios_delete" ON comentarios;
  -- recipe_likes
  DROP POLICY IF EXISTS "likes_read"   ON recipe_likes;
  DROP POLICY IF EXISTS "likes_insert" ON recipe_likes;
  DROP POLICY IF EXISTS "likes_delete" ON recipe_likes;
END $$;

-- ── 3. Auth-aware RLS for perfiles ────────────────────────
CREATE POLICY "perfiles_select" ON perfiles FOR SELECT USING (true);
CREATE POLICY "perfiles_insert" ON perfiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "perfiles_update" ON perfiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "perfiles_delete" ON perfiles FOR DELETE USING (auth.uid() = id);

-- ── 4. Auth-aware RLS for recetas ─────────────────────────
-- Anyone can read public recipes; auth users can read seguidores if following
CREATE POLICY "recetas_select" ON recetas FOR SELECT USING (
  visibilidad = 'publica'
  OR (auth.uid() = perfil_id)
  OR (visibilidad = 'seguidores' AND EXISTS (
    SELECT 1 FROM follows WHERE follower_id = auth.uid() AND following_id = recetas.perfil_id
  ))
);
CREATE POLICY "recetas_insert" ON recetas FOR INSERT WITH CHECK (auth.uid() = perfil_id);
CREATE POLICY "recetas_update" ON recetas FOR UPDATE USING (auth.uid() = perfil_id);
CREATE POLICY "recetas_delete" ON recetas FOR DELETE USING (auth.uid() = perfil_id);

-- ── 5. Auth-aware RLS for follows ─────────────────────────
CREATE POLICY "follows_select" ON follows FOR SELECT USING (true);
CREATE POLICY "follows_insert" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- ── 6. Auth-aware RLS for comentarios ─────────────────────
CREATE POLICY "comentarios_select" ON comentarios FOR SELECT USING (true);
CREATE POLICY "comentarios_insert" ON comentarios FOR INSERT WITH CHECK (auth.uid() = perfil_id);
CREATE POLICY "comentarios_delete" ON comentarios FOR DELETE USING (auth.uid() = perfil_id);

-- ── 7. Auth-aware RLS for recipe_likes ────────────────────
CREATE POLICY "likes_select" ON recipe_likes FOR SELECT USING (true);
CREATE POLICY "likes_insert" ON recipe_likes FOR INSERT WITH CHECK (auth.uid() = perfil_id);
CREATE POLICY "likes_delete" ON recipe_likes FOR DELETE USING (auth.uid() = perfil_id);

-- ── 8. Storage RLS for 'avatars' bucket ───────────────────
-- Public read
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Auth users can upload to their own folder
CREATE POLICY "avatars_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Auth users can update their own files
CREATE POLICY "avatars_auth_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Auth users can delete their own files
CREATE POLICY "avatars_auth_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 9. Storage RLS for 'recipes' bucket ───────────────────
-- Public read
CREATE POLICY "recipes_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'recipes');

-- Auth users can upload
CREATE POLICY "recipes_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'recipes'
    AND auth.uid() IS NOT NULL
  );

-- Auth users can delete their own files
CREATE POLICY "recipes_auth_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'recipes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

