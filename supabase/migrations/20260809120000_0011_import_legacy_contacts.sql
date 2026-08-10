/* Import the existing mail-admin contact audience into the rebuilt recipients table. */
DO $$
BEGIN
  IF to_regclass('public.contacts') IS NOT NULL THEN
    INSERT INTO public.recipients (
      email,
      full_name,
      username,
      country,
      status,
      metadata,
      created_at,
      updated_at
    )
    SELECT
      lower(trim(coalesce(nullif(email_normalized, ''), email))) AS email,
      nullif(trim(username), '') AS full_name,
      nullif(trim(username), '') AS username,
      nullif(trim(country_code), '') AS country,
      CASE
        WHEN lower(coalesce(status, 'active')) IN ('active','subscribed','verified') THEN 'active'
        ELSE lower(coalesce(status, 'active'))
      END AS status,
      jsonb_strip_nulls(jsonb_build_object(
        'legacy_contact_id', id::text,
        'external_user_id', external_user_id,
        'external_session_id', external_session_id
      )) AS metadata,
      coalesce(created_at, now()),
      now()
    FROM public.contacts
    WHERE coalesce(nullif(email_normalized, ''), nullif(email, '')) IS NOT NULL
      AND position('@' in coalesce(nullif(email_normalized, ''), email)) > 1
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
