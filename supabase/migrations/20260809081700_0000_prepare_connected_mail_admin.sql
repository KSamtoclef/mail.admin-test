/*
Prepare the existing connected mail-admin project for the rebuilt dashboard.
Preserve legacy data by renaming only schema names that collide with the rebuild.
The existing contacts table remains untouched and is imported into recipients later.
*/
DO $$
BEGIN
  IF to_regclass('public.campaign_recipients') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='campaign_recipients' AND column_name='email'
     )
     AND to_regclass('public.legacy_campaign_recipients') IS NULL THEN
    ALTER TABLE public.campaign_recipients RENAME TO legacy_campaign_recipients;
    IF to_regclass('public.campaign_recipients_pkey') IS NOT NULL THEN
      ALTER INDEX public.campaign_recipients_pkey RENAME TO legacy_campaign_recipients_pkey;
    END IF;
  END IF;

  IF to_regclass('public.campaigns') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='campaigns' AND column_name='sender_email'
     )
     AND to_regclass('public.legacy_campaigns') IS NULL THEN
    ALTER TABLE public.campaigns RENAME TO legacy_campaigns;
    IF to_regclass('public.campaigns_pkey') IS NOT NULL THEN
      ALTER INDEX public.campaigns_pkey RENAME TO legacy_campaigns_pkey;
    END IF;
  END IF;

  IF to_regclass('public.suppression_list') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='suppression_list' AND column_name='email'
     )
     AND to_regclass('public.legacy_suppression_list') IS NULL THEN
    ALTER TABLE public.suppression_list RENAME TO legacy_suppression_list;
    IF to_regclass('public.suppression_list_pkey') IS NOT NULL THEN
      ALTER INDEX public.suppression_list_pkey RENAME TO legacy_suppression_list_pkey;
    END IF;
  END IF;
END $$;
