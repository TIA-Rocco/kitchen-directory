-- Blog
-- AEO-focused content (e.g., "Best kitchen knife brands for commercial kitchens").
-- Authored in Supabase dashboard or via Supabase MCP. Markdown body rendered at build.
-- Publishing flips status -> 'published' which fires a Vercel deploy hook.

create type blog_post_status as enum ('draft', 'published');

create table blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  body text not null default '',
  excerpt text,
  featured_image_url text,
  author text not null default 'Kitchen Equipment Editorial',
  category text,
  linked_companies uuid[] not null default '{}',
  meta_title text,
  meta_description text,
  status blog_post_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_blog_posts_slug on blog_posts (slug);
create index idx_blog_posts_status_published on blog_posts (status, published_at desc);

-- Reuse update_updated_at() defined in 001_initial_schema.sql
create trigger trg_blog_posts_updated_at
  before update on blog_posts
  for each row execute function update_updated_at();

-- RLS: published posts are public, drafts are not
alter table blog_posts enable row level security;
create policy "Published blog posts are publicly readable"
  on blog_posts for select using (status = 'published');

-- Deploy hook: rebuild SSG when a post transitions to 'published'.
-- Mirrors the pattern in 002_review_webhook.sql. The actual Vercel deploy hook URL
-- should live in Supabase Vault as 'vercel_deploy_hook' (or be wired via the
-- Database > Webhooks UI). For now this just logs.
create or replace function notify_blog_post_published()
returns trigger as $$
begin
  if new.status = 'published' and (old.status is null or old.status != 'published') then
    raise notice 'Blog post % published (slug: %)', new.id, new.slug;

    -- When pg_net and deploy hook are configured, uncomment:
    -- perform net.http_post(
    --   url := (select decrypted_secret from vault.decrypted_secrets where name = 'vercel_deploy_hook'),
    --   body := '{}'::jsonb
    -- );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_blog_post_published
  after insert or update of status on blog_posts
  for each row
  when (new.status = 'published')
  execute function notify_blog_post_published();
