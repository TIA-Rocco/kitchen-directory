export interface Company {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string | null;
  website_url: string | null;
  phone: string | null;
  email: string | null;
  address: {
    street: string;
    city: string;
    province: string;
    postal_code: string;
  };
  ranking_score: number;
  ranking_breakdown: RankingBreakdown;
  services: string[];
  certifications: string[];
  faq: FaqItem[];
  partners: Partner[];
  is_featured: boolean;
  // Attributed third-party Google Business Profile rating (display-only snapshot).
  // NEVER fed into the page's own AggregateRating JSON-LD — see src/lib/schema.ts.
  google_place_id: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  google_rating_as_of: string | null;
  google_place_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface RankingBreakdown {
  service_range: number;
  customer_reviews: number;
  industry_experience: number;
  response_time: number;
  pricing_transparency: number;
  certifications: number;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface Partner {
  name: string;
  logo_url?: string | null;
  url?: string | null;
}

export interface Review {
  id: string;
  company_id: string;
  reviewer_name: string;
  rating: number;
  service_category: string;
  custom_service: string | null;
  review_text: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  faq: FaqItem[];
}

export interface ContactSubmission {
  id: string;
  type: 'general' | 'update_profile';
  name: string;
  email: string;
  company_name: string | null;
  message: string;
  created_at: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  body: string;
  excerpt: string | null;
  featured_image_url: string | null;
  author: string;
  category: string | null;
  linked_companies: string[];
  meta_title: string | null;
  meta_description: string | null;
  status: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export const RANKING_WEIGHTS = {
  service_range: 0.20,
  customer_reviews: 0.25,
  industry_experience: 0.20,
  response_time: 0.15,
  pricing_transparency: 0.10,
  certifications: 0.10,
} as const;

export const RANKING_LABELS: Record<keyof RankingBreakdown, string> = {
  service_range: 'Service Range',
  customer_reviews: 'Customer Reviews',
  industry_experience: 'Industry Experience',
  response_time: 'Response Time',
  pricing_transparency: 'Pricing Transparency',
  certifications: 'Certifications',
};
