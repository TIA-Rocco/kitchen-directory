-- Brand Partners
-- Each company has a list of brand partners they have favourable relationships with
-- (e.g., authorized dealers, exclusive distributors). Stored as JSONB array of
-- { name, logo_url?, url? } objects. Admin authoring via Supabase dashboard or MCP.

alter table companies
  add column if not exists partners jsonb not null default '[]'::jsonb;

-- Backfill plausible brand partners for Shop at Stop (the featured supplier).
-- Other companies stay empty until Luke fills them in via the Supabase dashboard.
update companies
set partners = '[
  {
    "name": "Vitamix",
    "logo_url": "https://logo.clearbit.com/vitamix.com",
    "url": "https://www.vitamix.com/ca/en_us/commercial"
  },
  {
    "name": "Hobart",
    "logo_url": "https://logo.clearbit.com/hobartcorp.com",
    "url": "https://www.hobartcorp.com"
  },
  {
    "name": "Robot Coupe",
    "logo_url": "https://logo.clearbit.com/robot-coupe.com",
    "url": "https://www.robot-coupe.com/en-ca"
  }
]'::jsonb
where slug = 'shop-at-stop';
