import { describe, it, expect } from 'vitest';
import type { Company, Review, FaqItem, BlogPost, Partner } from '../types';
import {
  buildLocalBusinessSchema,
  buildAggregateRatingSchema,
  buildReviewSchema,
  buildFAQPageSchema,
  buildServiceSchema,
  buildItemListSchema,
  buildWebSiteSchema,
  buildOrganizationSchema,
  buildBlogPostingSchema,
  buildBlogIndexSchema,
  buildBrandSchema,
} from '../schema';

// ---------------------------------------------------------------------------
// Helpers – reusable fixtures
// ---------------------------------------------------------------------------

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'c1',
    name: 'Test Kitchen Co',
    slug: 'test-kitchen-co',
    description: 'A great kitchen supplier.',
    logo_url: 'https://example.com/logo.png',
    website_url: 'https://example.com',
    phone: '416-555-1234',
    email: 'info@example.com',
    address: {
      street: '123 Main St',
      city: 'Toronto',
      province: 'ON',
      postal_code: 'M5V 1A1',
    },
    ranking_score: 85,
    ranking_breakdown: {
      service_range: 8,
      customer_reviews: 9,
      industry_experience: 7,
      response_time: 8,
      pricing_transparency: 7,
      certifications: 6,
    },
    services: ['installation', 'repair'],
    faq: [],
    partners: [],
    is_featured: false,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-06-01T12:00:00Z',
    ...overrides,
  };
}

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: 'r1',
    company_id: 'c1',
    reviewer_name: 'Alice',
    rating: 5,
    service_category: 'installation',
    custom_service: null,
    review_text: 'Excellent service!',
    status: 'approved',
    created_at: '2024-03-10T08:30:00Z',
    ...overrides,
  };
}

function makeBlogPost(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    id: 'b1',
    title: 'Best Commercial Knives for 2026',
    slug: 'best-commercial-knives-2026',
    body: '# Hello\n\nSome **markdown** body.',
    excerpt: 'A guide to the best commercial knives.',
    featured_image_url: 'https://example.com/knife.jpg',
    author: 'Kitchen Equipment Editorial',
    category: 'Buying Guides',
    linked_companies: [],
    meta_title: null,
    meta_description: null,
    status: 'published',
    published_at: '2026-04-01T00:00:00Z',
    created_at: '2026-03-25T00:00:00Z',
    updated_at: '2026-04-02T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildLocalBusinessSchema
// ---------------------------------------------------------------------------

describe('buildLocalBusinessSchema', () => {
  it('returns correct structure for a fully-populated company with reviews', () => {
    const company = makeCompany();
    const reviews = [makeReview()];
    const schema = buildLocalBusinessSchema(company, reviews);

    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('LocalBusiness');
    expect(schema['@id']).toBe(
      'https://kitchenequipment.ca/companies/test-kitchen-co'
    );
    expect(schema.name).toBe('Test Kitchen Co');
    expect(schema.description).toBe('A great kitchen supplier.');
    expect(schema.url).toBe(
      'https://kitchenequipment.ca/companies/test-kitchen-co'
    );
    expect(schema.telephone).toBe('416-555-1234');
    expect(schema.email).toBe('info@example.com');
    expect(schema.sameAs).toBe('https://example.com');
    expect(schema.image).toBe('https://example.com/logo.png');

    // Address
    expect(schema.address).toEqual({
      '@type': 'PostalAddress',
      streetAddress: '123 Main St',
      addressLocality: 'Toronto',
      addressRegion: 'ON',
      postalCode: 'M5V 1A1',
      addressCountry: 'CA',
    });

    // Aggregate rating should be present
    expect(schema.aggregateRating).toBeDefined();
  });

  it('omits optional fields when they are null', () => {
    const company = makeCompany({
      phone: null,
      email: null,
      website_url: null,
      logo_url: null,
      address: undefined as unknown as Company['address'],
    });
    const schema = buildLocalBusinessSchema(company, []);

    expect(schema.telephone).toBeUndefined();
    expect(schema.email).toBeUndefined();
    expect(schema.sameAs).toBeUndefined();
    expect(schema.image).toBeUndefined();
    expect(schema.address).toBeUndefined();
  });

  it('omits aggregateRating when there are no approved reviews', () => {
    const company = makeCompany();
    const reviews = [makeReview({ status: 'pending' })];
    const schema = buildLocalBusinessSchema(company, reviews);

    expect(schema.aggregateRating).toBeUndefined();
  });

  it('includes aggregateRating when reviews are present', () => {
    const company = makeCompany();
    const reviews = [
      makeReview({ rating: 4 }),
      makeReview({ id: 'r2', rating: 5, reviewer_name: 'Bob' }),
    ];
    const schema = buildLocalBusinessSchema(company, reviews);

    expect(schema.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: 4.5,
      bestRating: 5,
      worstRating: 1,
      reviewCount: 2,
    });
  });

  it('omits brand array when partners are empty', () => {
    const company = makeCompany({ partners: [] });
    const schema = buildLocalBusinessSchema(company, []);
    expect(schema.brand).toBeUndefined();
  });

  it('includes brand array when partners are present', () => {
    const partners: Partner[] = [
      { name: 'Vitamix', url: 'https://vitamix.com', logo_url: 'https://vitamix.com/logo.png' },
      { name: 'Hobart' },
    ];
    const company = makeCompany({ partners });
    const schema = buildLocalBusinessSchema(company, []);

    expect(schema.brand).toEqual([
      {
        '@type': 'Brand',
        name: 'Vitamix',
        url: 'https://vitamix.com',
        logo: 'https://vitamix.com/logo.png',
      },
      {
        '@type': 'Brand',
        name: 'Hobart',
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// buildBrandSchema
// ---------------------------------------------------------------------------

describe('buildBrandSchema', () => {
  it('includes only name when other fields are absent', () => {
    expect(buildBrandSchema({ name: 'Vitamix' })).toEqual({
      '@type': 'Brand',
      name: 'Vitamix',
    });
  });

  it('includes url and logo when present', () => {
    expect(
      buildBrandSchema({
        name: 'Vitamix',
        url: 'https://vitamix.com',
        logo_url: 'https://vitamix.com/logo.png',
      })
    ).toEqual({
      '@type': 'Brand',
      name: 'Vitamix',
      url: 'https://vitamix.com',
      logo: 'https://vitamix.com/logo.png',
    });
  });

  it('treats null url and logo_url as absent', () => {
    const schema = buildBrandSchema({ name: 'Hobart', url: null, logo_url: null });
    expect(schema).toEqual({ '@type': 'Brand', name: 'Hobart' });
  });
});

// ---------------------------------------------------------------------------
// buildAggregateRatingSchema
// ---------------------------------------------------------------------------

describe('buildAggregateRatingSchema', () => {
  it('returns null when reviews array is empty', () => {
    expect(buildAggregateRatingSchema([])).toBeNull();
  });

  it('returns null when all reviews are non-approved', () => {
    const reviews = [
      makeReview({ status: 'pending' }),
      makeReview({ id: 'r2', status: 'rejected' }),
    ];
    expect(buildAggregateRatingSchema(reviews)).toBeNull();
  });

  it('calculates correctly for a single approved review', () => {
    const reviews = [makeReview({ rating: 3 })];
    expect(buildAggregateRatingSchema(reviews)).toEqual({
      '@type': 'AggregateRating',
      ratingValue: 3,
      bestRating: 5,
      worstRating: 1,
      reviewCount: 1,
    });
  });

  it('calculates average across multiple approved reviews', () => {
    const reviews = [
      makeReview({ rating: 4 }),
      makeReview({ id: 'r2', rating: 5, reviewer_name: 'Bob' }),
      makeReview({ id: 'r3', rating: 3, reviewer_name: 'Carol' }),
    ];
    // (4 + 5 + 3) / 3 = 4.0
    expect(buildAggregateRatingSchema(reviews)).toEqual({
      '@type': 'AggregateRating',
      ratingValue: 4,
      bestRating: 5,
      worstRating: 1,
      reviewCount: 3,
    });
  });

  it('filters to approved-only and rounds to one decimal', () => {
    const reviews = [
      makeReview({ rating: 4 }),
      makeReview({ id: 'r2', rating: 5, reviewer_name: 'Bob' }),
      makeReview({ id: 'r3', rating: 2, status: 'pending' }),
    ];
    // Only approved: (4 + 5) / 2 = 4.5
    expect(buildAggregateRatingSchema(reviews)).toEqual({
      '@type': 'AggregateRating',
      ratingValue: 4.5,
      bestRating: 5,
      worstRating: 1,
      reviewCount: 2,
    });
  });

  it('rounds average to one decimal place', () => {
    const reviews = [
      makeReview({ rating: 3 }),
      makeReview({ id: 'r2', rating: 5, reviewer_name: 'Bob' }),
      makeReview({ id: 'r3', rating: 4, reviewer_name: 'Carol' }),
    ];
    // (3 + 5 + 4) / 3 = 4.0
    expect(buildAggregateRatingSchema(reviews)!.ratingValue).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// buildReviewSchema
// ---------------------------------------------------------------------------

describe('buildReviewSchema', () => {
  it('produces correct structure with date formatted as YYYY-MM-DD', () => {
    const review = makeReview({
      created_at: '2024-07-20T14:30:00Z',
      rating: 4,
      reviewer_name: 'Dave',
      review_text: 'Good stuff.',
    });
    const schema = buildReviewSchema(review, 'Acme Corp');

    expect(schema).toEqual({
      '@type': 'Review',
      author: { '@type': 'Person', name: 'Dave' },
      reviewRating: {
        '@type': 'Rating',
        ratingValue: 4,
        bestRating: 5,
        worstRating: 1,
      },
      reviewBody: 'Good stuff.',
      datePublished: '2024-07-20',
      itemReviewed: { '@type': 'LocalBusiness', name: 'Acme Corp' },
    });
  });

  it('handles created_at without time component', () => {
    const review = makeReview({ created_at: '2024-01-01' });
    const schema = buildReviewSchema(review, 'Test Co');
    expect(schema.datePublished).toBe('2024-01-01');
  });
});

// ---------------------------------------------------------------------------
// buildFAQPageSchema
// ---------------------------------------------------------------------------

describe('buildFAQPageSchema', () => {
  it('returns null for an empty array', () => {
    expect(buildFAQPageSchema([])).toBeNull();
  });

  it('returns null for a falsy value', () => {
    expect(buildFAQPageSchema(null as unknown as FaqItem[])).toBeNull();
    expect(buildFAQPageSchema(undefined as unknown as FaqItem[])).toBeNull();
  });

  it('produces correct FAQ-LD structure', () => {
    const faqs: FaqItem[] = [
      { question: 'What is this?', answer: 'A directory.' },
      { question: 'Is it free?', answer: 'Yes.' },
    ];
    const schema = buildFAQPageSchema(faqs);

    expect(schema).toEqual({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is this?',
          acceptedAnswer: { '@type': 'Answer', text: 'A directory.' },
        },
        {
          '@type': 'Question',
          name: 'Is it free?',
          acceptedAnswer: { '@type': 'Answer', text: 'Yes.' },
        },
      ],
    });
  });
});

// ---------------------------------------------------------------------------
// buildServiceSchema
// ---------------------------------------------------------------------------

describe('buildServiceSchema', () => {
  it('returns correct structure', () => {
    const schema = buildServiceSchema('Repair', 'Acme Corp');
    expect(schema).toEqual({
      '@type': 'Service',
      name: 'Repair',
      provider: { '@type': 'LocalBusiness', name: 'Acme Corp' },
    });
  });
});

// ---------------------------------------------------------------------------
// buildItemListSchema
// ---------------------------------------------------------------------------

describe('buildItemListSchema', () => {
  it('assigns correct 1-based positions', () => {
    const companies = [
      makeCompany({ slug: 'alpha', name: 'Alpha' }),
      makeCompany({ id: 'c2', slug: 'beta', name: 'Beta' }),
    ];
    const schema = buildItemListSchema(
      companies,
      'Top Suppliers',
      'https://kitchenequipment.ca/suppliers'
    );

    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('ItemList');
    expect(schema.name).toBe('Top Suppliers');
    expect(schema.url).toBe('https://kitchenequipment.ca/suppliers');
    expect(schema.numberOfItems).toBe(2);
    expect(schema.itemListElement).toHaveLength(2);
    expect(schema.itemListElement[0].position).toBe(1);
    expect(schema.itemListElement[1].position).toBe(2);
    expect(schema.itemListElement[0].item.name).toBe('Alpha');
    expect(schema.itemListElement[1].item['@id']).toBe(
      'https://kitchenequipment.ca/companies/beta'
    );
  });

  it('handles an empty company list', () => {
    const schema = buildItemListSchema([], 'Empty', 'https://example.com');

    expect(schema.numberOfItems).toBe(0);
    expect(schema.itemListElement).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildWebSiteSchema
// ---------------------------------------------------------------------------

describe('buildWebSiteSchema', () => {
  it('returns correct static structure', () => {
    const schema = buildWebSiteSchema();

    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('WebSite');
    expect(schema.name).toBe('Kitchen Equipment Canada');
    expect(schema.url).toBe('https://kitchenequipment.ca');
    expect(schema.description).toContain('commercial kitchen equipment');
  });
});

// ---------------------------------------------------------------------------
// buildOrganizationSchema
// ---------------------------------------------------------------------------

describe('buildOrganizationSchema', () => {
  it('returns correct static structure', () => {
    const schema = buildOrganizationSchema();

    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('Organization');
    expect(schema.name).toBe('Kitchen Equipment Canada');
    expect(schema.url).toBe('https://kitchenequipment.ca');
    expect(schema.logo).toBe('https://kitchenequipment.ca/logo.svg');
  });
});

// ---------------------------------------------------------------------------
// buildBlogPostingSchema
// ---------------------------------------------------------------------------

describe('buildBlogPostingSchema', () => {
  it('returns full structure for a populated post', () => {
    const post = makeBlogPost();
    const schema = buildBlogPostingSchema(post);

    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('BlogPosting');
    expect(schema['@id']).toBe(
      'https://kitchenequipment.ca/blog/best-commercial-knives-2026'
    );
    expect(schema.headline).toBe('Best Commercial Knives for 2026');
    expect(schema.url).toBe(
      'https://kitchenequipment.ca/blog/best-commercial-knives-2026'
    );
    expect(schema.datePublished).toBe('2026-04-01');
    expect(schema.dateModified).toBe('2026-04-02');
    expect(schema.description).toBe('A guide to the best commercial knives.');
    expect(schema.image).toBe('https://example.com/knife.jpg');
    expect(schema.articleSection).toBe('Buying Guides');
    expect(schema.author).toEqual({
      '@type': 'Organization',
      name: 'Kitchen Equipment Editorial',
    });
    expect(schema.publisher).toEqual({
      '@type': 'Organization',
      name: 'Kitchen Equipment Canada',
      logo: {
        '@type': 'ImageObject',
        url: 'https://kitchenequipment.ca/logo.svg',
      },
    });
    expect(schema.mainEntityOfPage).toEqual({
      '@type': 'WebPage',
      '@id': 'https://kitchenequipment.ca/blog/best-commercial-knives-2026',
    });
    expect(schema.mentions).toBeUndefined();
  });

  it('falls back to created_at when published_at is null', () => {
    const post = makeBlogPost({ published_at: null });
    const schema = buildBlogPostingSchema(post);
    expect(schema.datePublished).toBe('2026-03-25');
  });

  it('omits optional fields when absent', () => {
    const post = makeBlogPost({
      excerpt: null,
      featured_image_url: null,
      category: null,
    });
    const schema = buildBlogPostingSchema(post);
    expect(schema.description).toBeUndefined();
    expect(schema.image).toBeUndefined();
    expect(schema.articleSection).toBeUndefined();
  });

  it('includes mentions array when linked companies are passed', () => {
    const post = makeBlogPost();
    const linked = [makeCompany({ slug: 'shop-at-stop', name: 'Shop at Stop' })];
    const schema = buildBlogPostingSchema(post, linked);

    expect(schema.mentions).toEqual([
      {
        '@type': 'LocalBusiness',
        '@id': 'https://kitchenequipment.ca/companies/shop-at-stop',
        name: 'Shop at Stop',
        url: 'https://kitchenequipment.ca/companies/shop-at-stop',
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// buildBlogIndexSchema
// ---------------------------------------------------------------------------

describe('buildBlogIndexSchema', () => {
  it('returns Blog schema with empty list when no posts', () => {
    const schema = buildBlogIndexSchema([]);
    expect(schema['@type']).toBe('Blog');
    expect(schema.url).toBe('https://kitchenequipment.ca/blog');
    expect(schema.blogPost).toEqual([]);
  });

  it('lists posts with required fields', () => {
    const posts = [
      makeBlogPost(),
      makeBlogPost({
        id: 'b2',
        slug: 'second-post',
        title: 'Second Post',
        published_at: '2026-04-15T00:00:00Z',
        excerpt: null,
        featured_image_url: null,
      }),
    ];
    const schema = buildBlogIndexSchema(posts);

    expect(schema.blogPost).toHaveLength(2);
    expect(schema.blogPost[0]).toEqual({
      '@type': 'BlogPosting',
      '@id': 'https://kitchenequipment.ca/blog/best-commercial-knives-2026',
      headline: 'Best Commercial Knives for 2026',
      url: 'https://kitchenequipment.ca/blog/best-commercial-knives-2026',
      datePublished: '2026-04-01',
      description: 'A guide to the best commercial knives.',
      image: 'https://example.com/knife.jpg',
    });
    expect(schema.blogPost[1]).toEqual({
      '@type': 'BlogPosting',
      '@id': 'https://kitchenequipment.ca/blog/second-post',
      headline: 'Second Post',
      url: 'https://kitchenequipment.ca/blog/second-post',
      datePublished: '2026-04-15',
    });
  });
});
