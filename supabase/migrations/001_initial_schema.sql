-- Kitchen Directory - Initial Schema
-- kitchenequipment.ca

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- Service Categories
-- ============================================
create table service_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  description text not null default ''
);

insert into service_categories (name, slug, description) values
  ('Design & Technical Drawings', 'design-and-technical-drawings', 'Commercial kitchen design, layout planning, and technical drawing services'),
  ('Equipment Financing', 'equipment-financing', 'Financing options for commercial kitchen equipment purchases'),
  ('Equipment Leasing', 'equipment-leasing', 'Leasing programs for commercial kitchen equipment'),
  ('Commercial Equipment Procurement', 'commercial-equipment-procurement', 'Sourcing and purchasing commercial kitchen equipment'),
  ('Price Match', 'price-match', 'Price matching guarantees on commercial kitchen equipment'),
  ('Account Management', 'account-management', 'Dedicated account management for commercial kitchen clients'),
  ('Equipment Consulting', 'equipment-consulting', 'Expert consulting on commercial kitchen equipment selection'),
  ('Restaurant Consulting', 'restaurant-consulting', 'Full-service restaurant consulting including kitchen operations'),
  ('Installation Services', 'installation-services', 'Commercial kitchen equipment installation services (referral)');

-- ============================================
-- Companies
-- ============================================
create table companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  logo_url text,
  website_url text,
  phone text,
  email text,
  address jsonb not null default '{}',
  ranking_score numeric(3,1) not null default 0,
  ranking_breakdown jsonb not null default '{
    "service_range": 0,
    "customer_reviews": 0,
    "industry_experience": 0,
    "response_time": 0,
    "pricing_transparency": 0,
    "certifications": 0
  }',
  services text[] not null default '{}',
  faq jsonb not null default '[]',
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for slug lookups
create index idx_companies_slug on companies (slug);
-- Index for ranking sort
create index idx_companies_ranking on companies (ranking_score desc);

-- ============================================
-- Ranking score trigger (single source of truth)
-- Computes weighted average from ranking_breakdown
-- ============================================
create or replace function compute_ranking_score()
returns trigger as $$
declare
  breakdown jsonb;
  score numeric;
begin
  breakdown := new.ranking_breakdown;
  score := (
    (coalesce((breakdown->>'service_range')::numeric, 0) * 0.20) +
    (coalesce((breakdown->>'customer_reviews')::numeric, 0) * 0.25) +
    (coalesce((breakdown->>'industry_experience')::numeric, 0) * 0.20) +
    (coalesce((breakdown->>'response_time')::numeric, 0) * 0.15) +
    (coalesce((breakdown->>'pricing_transparency')::numeric, 0) * 0.10) +
    (coalesce((breakdown->>'certifications')::numeric, 0) * 0.10)
  );
  new.ranking_score := round(score, 1);
  return new;
end;
$$ language plpgsql;

create trigger trg_compute_ranking_score
  before insert or update of ranking_breakdown on companies
  for each row execute function compute_ranking_score();

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_companies_updated_at
  before update on companies
  for each row execute function update_updated_at();

-- ============================================
-- Reviews
-- ============================================
create type review_status as enum ('pending', 'approved', 'rejected');

create table reviews (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  reviewer_name text not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  service_category text not null,
  custom_service text,
  review_text text not null,
  status review_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- Index for company lookups
create index idx_reviews_company on reviews (company_id);
-- Index for status filtering
create index idx_reviews_status on reviews (status);
-- Composite index for approved reviews per company
create index idx_reviews_company_approved on reviews (company_id) where status = 'approved';

-- ============================================
-- Contact Submissions
-- ============================================
create type contact_type as enum ('general', 'update_profile');

create table contact_submissions (
  id uuid primary key default uuid_generate_v4(),
  type contact_type not null default 'general',
  name text not null,
  email text not null,
  company_name text,
  message text not null,
  created_at timestamptz not null default now()
);

-- ============================================
-- Row Level Security
-- ============================================

-- Companies: public read, no public write
alter table companies enable row level security;
create policy "Companies are publicly readable"
  on companies for select using (true);

-- Service categories: public read
alter table service_categories enable row level security;
create policy "Service categories are publicly readable"
  on service_categories for select using (true);

-- Reviews: public read for approved, insert allowed for anyone
alter table reviews enable row level security;
create policy "Approved reviews are publicly readable"
  on reviews for select using (status = 'approved');
create policy "Anyone can submit a review"
  on reviews for insert with check (true);

-- Contact submissions: insert only (no public read)
alter table contact_submissions enable row level security;
create policy "Anyone can submit a contact form"
  on contact_submissions for insert with check (true);
