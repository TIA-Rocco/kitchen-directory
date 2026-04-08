-- Webhook trigger: rebuild site when a review is approved
-- Requires pg_net extension (enabled by default on Supabase)
-- The Vercel deploy hook URL should be stored in Supabase Vault
-- as a secret named 'vercel_deploy_hook'

-- This migration creates the trigger function.
-- The actual webhook URL must be configured in the Supabase Dashboard
-- under Database > Webhooks after the project is created.

-- Alternative: use Supabase Database Webhooks UI to create this
-- without SQL. Go to Database > Webhooks > Create Webhook:
--   Table: reviews
--   Events: UPDATE
--   Filter: status = 'approved'
--   HTTP method: POST
--   URL: (Vercel deploy hook URL)

-- For now, create a notify function that can be wired to pg_net later
create or replace function notify_review_approved()
returns trigger as $$
begin
  if new.status = 'approved' and (old.status is null or old.status != 'approved') then
    -- Log the approval (visible in Supabase logs)
    raise notice 'Review % approved for company %', new.id, new.company_id;

    -- When pg_net and deploy hook are configured, uncomment:
    -- perform net.http_post(
    --   url := (select decrypted_secret from vault.decrypted_secrets where name = 'vercel_deploy_hook'),
    --   body := '{}'::jsonb
    -- );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_review_approved
  after update of status on reviews
  for each row
  when (new.status = 'approved')
  execute function notify_review_approved();
