/// <reference path="../.astro/types.d.ts" />

import type { SupabaseClient, User } from '@supabase/supabase-js';

declare global {
  namespace App {
    interface Locals {
      user?: User;
      supabase?: SupabaseClient;
    }
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  readonly ADMIN_EMAILS: string;
  readonly PUBLIC_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
