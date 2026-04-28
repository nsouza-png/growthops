-- Allow seller_email to be NULL in calls table
-- Webhooks (tldv-webhook) create the record before knowing the closer;
-- seller_email is populated later via MeetingReady attendees or enrich-call pipeline.
ALTER TABLE "GrowthPlatform".calls ALTER COLUMN seller_email DROP NOT NULL;
