-- =============================================================================
-- Promoter profile photos — Storage policies for bucket `club-flyers`
-- =============================================================================
--
-- WHY THE SQL EDITOR FAILS (ERROR 42501: must be owner of relation objects)
-- ---------------------------------------------------------------------------
-- On hosted Supabase, `storage.objects` is owned by the storage subsystem, not
-- your project's `postgres` role. Running CREATE POLICY / DROP POLICY on
-- `storage.objects` in the SQL Editor therefore fails with "must be owner".
--
-- WHAT TO DO INSTEAD
-- ---------------------------------------------------------------------------
-- Use the Dashboard (this creates policies with the correct ownership):
--
--   1. Supabase Dashboard → Storage → open bucket `club-flyers`
--   2. Tab "Policies" → New policy → "For full customization" (or equivalent)
--   3. Create the three policies below (INSERT, UPDATE, DELETE), role:
--      `authenticated`, bucket `club-flyers`.
--
-- Policy definitions (paste into the policy SQL / expression fields). Adjust
-- the bucket name if yours is not `club-flyers`.
--
-- -----------------------------------------------------------------------------
-- Policy name: promoter_profile_images_insert_own
-- Operation:  INSERT
-- Role:        authenticated
-- WITH CHECK:
-- -----------------------------------------------------------------------------
/*
(
  bucket_id = 'club-flyers'
  and (storage.foldername(name))[1] = 'promoter-profiles'
  and (storage.foldername(name))[2] = (
    select p.id::text
    from public.promoters p
    where p.user_id = auth.uid()
    limit 1
  )
)
*/
--
-- -----------------------------------------------------------------------------
-- Policy name: promoter_profile_images_update_own
-- Operation:  UPDATE
-- Role:        authenticated
-- USING (and repeat same expression as WITH CHECK if the UI asks for both):
-- -----------------------------------------------------------------------------
/*
(
  bucket_id = 'club-flyers'
  and (storage.foldername(name))[1] = 'promoter-profiles'
  and (storage.foldername(name))[2] = (
    select p.id::text from public.promoters p where p.user_id = auth.uid() limit 1
  )
)
*/
--
-- -----------------------------------------------------------------------------
-- Policy name: promoter_profile_images_delete_own
-- Operation:  DELETE
-- Role:        authenticated
-- USING:
-- -----------------------------------------------------------------------------
/*
(
  bucket_id = 'club-flyers'
  and (storage.foldername(name))[1] = 'promoter-profiles'
  and (storage.foldername(name))[2] = (
    select p.id::text from public.promoters p where p.user_id = auth.uid() limit 1
  )
)
*/
--
-- Upload path used by the app: `promoter-profiles/{promoters.id}/...`
-- Docs: https://supabase.com/docs/guides/storage/security/access-control
--
-- =============================================================================
-- Self-hosted Postgres only (superuser / storage owner): executable SQL below
-- =============================================================================
-- Uncomment ONLY if your session owns `storage.objects` (rare on Supabase Cloud).

/*
drop policy if exists promoter_profile_images_insert_own on storage.objects;
create policy promoter_profile_images_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'club-flyers'
    and (storage.foldername(name))[1] = 'promoter-profiles'
    and (storage.foldername(name))[2] = (
      select p.id::text
      from public.promoters p
      where p.user_id = auth.uid()
      limit 1
    )
  );

drop policy if exists promoter_profile_images_update_own on storage.objects;
create policy promoter_profile_images_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'club-flyers'
    and (storage.foldername(name))[1] = 'promoter-profiles'
    and (storage.foldername(name))[2] = (
      select p.id::text from public.promoters p where p.user_id = auth.uid() limit 1
    )
  );

drop policy if exists promoter_profile_images_delete_own on storage.objects;
create policy promoter_profile_images_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'club-flyers'
    and (storage.foldername(name))[1] = 'promoter-profiles'
    and (storage.foldername(name))[2] = (
      select p.id::text from public.promoters p where p.user_id = auth.uid() limit 1
    )
  );
*/
