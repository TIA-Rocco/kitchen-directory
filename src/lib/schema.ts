import type { Company, Review, FaqItem, BlogPost, Partner } from './types';

export function buildLocalBusinessSchema(company: Company, reviews: Review[]) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `https://www.kitchenequipment.ca/companies/${company.slug}/`,
    name: company.name,
    description: company.description,
    url: `https://www.kitchenequipment.ca/companies/${company.slug}/`,
  };

  if (company.address) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: company.address.street,
      addressLocality: company.address.city,
      addressRegion: company.address.province,
      postalCode: company.address.postal_code,
      addressCountry: 'CA',
    };
  }

  if (company.phone) schema.telephone = company.phone;
  if (company.email) schema.email = company.email;
  if (company.website_url) schema.sameAs = company.website_url;
  if (company.logo_url) schema.image = company.logo_url;

  const aggregateRating = buildAggregateRatingSchema(reviews);
  if (aggregateRating) schema.aggregateRating = aggregateRating;

  if (company.partners && company.partners.length > 0) {
    schema.brand = company.partners.map(buildBrandSchema);
  }

  return schema;
}

export function buildBrandSchema(partner: Partner) {
  const brand: Record<string, unknown> = {
    '@type': 'Brand',
    name: partner.name,
  };
  if (partner.url) brand.url = partner.url;
  if (partner.logo_url) brand.logo = partner.logo_url;
  return brand;
}

export function buildAggregateRatingSchema(reviews: Review[]) {
  const approved = reviews.filter((r) => r.status === 'approved');
  if (approved.length === 0) return null;

  const sum = approved.reduce((acc, r) => acc + r.rating, 0);
  const average = Math.round((sum / approved.length) * 10) / 10;

  return {
    '@type': 'AggregateRating',
    ratingValue: average,
    bestRating: 5,
    worstRating: 1,
    reviewCount: approved.length,
  };
}

export function buildReviewSchema(review: Review, companyName: string) {
  return {
    '@type': 'Review',
    author: {
      '@type': 'Person',
      name: review.reviewer_name,
    },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: review.rating,
      bestRating: 5,
      worstRating: 1,
    },
    reviewBody: review.review_text,
    datePublished: review.created_at.split('T')[0],
    itemReviewed: {
      '@type': 'LocalBusiness',
      name: companyName,
    },
  };
}

export function buildFAQPageSchema(faqs: FaqItem[]) {
  if (!faqs || faqs.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function buildServiceSchema(serviceName: string, companyName: string) {
  return {
    '@type': 'Service',
    name: serviceName,
    provider: {
      '@type': 'LocalBusiness',
      name: companyName,
    },
  };
}

export function buildItemListSchema(
  companies: Company[],
  listName: string,
  listUrl: string
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    url: listUrl,
    numberOfItems: companies.length,
    itemListElement: companies.map((company, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'LocalBusiness',
        '@id': `https://www.kitchenequipment.ca/companies/${company.slug}/`,
        name: company.name,
        url: `https://www.kitchenequipment.ca/companies/${company.slug}/`,
      },
    })),
  };
}

export function buildWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Kitchen Equipment Canada',
    url: 'https://www.kitchenequipment.ca/',
    description:
      'Find and compare the best commercial kitchen equipment suppliers in Canada. Independent ratings, reviews, and service comparisons.',
  };
}

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Kitchen Equipment Canada',
    url: 'https://www.kitchenequipment.ca/',
    logo: 'https://www.kitchenequipment.ca/brand/logo.svg',
  };
}

export function buildBlogPostingSchema(
  post: BlogPost,
  linkedCompanies: Company[] = []
) {
  const url = `https://www.kitchenequipment.ca/blog/${post.slug}/`;
  const datePublished = post.published_at
    ? post.published_at.split('T')[0]
    : post.created_at.split('T')[0];

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': url,
    headline: post.title,
    url,
    datePublished,
    dateModified: post.updated_at.split('T')[0],
    author: {
      '@type': 'Organization',
      name: post.author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Kitchen Equipment Canada',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.kitchenequipment.ca/brand/logo.svg',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  };

  if (post.excerpt) schema.description = post.excerpt;
  if (post.featured_image_url) schema.image = post.featured_image_url;
  if (post.category) schema.articleSection = post.category;

  if (linkedCompanies.length > 0) {
    schema.mentions = linkedCompanies.map((c) => ({
      '@type': 'LocalBusiness',
      '@id': `https://www.kitchenequipment.ca/companies/${c.slug}/`,
      name: c.name,
      url: `https://www.kitchenequipment.ca/companies/${c.slug}/`,
    }));
  }

  return schema;
}

export function buildBlogIndexSchema(posts: BlogPost[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': 'https://www.kitchenequipment.ca/blog/',
    url: 'https://www.kitchenequipment.ca/blog/',
    name: 'Kitchen Equipment Canada Blog',
    description:
      'Buying guides, reviews, and industry insights for commercial kitchen equipment buyers in Canada.',
    blogPost: posts.map((post) => ({
      '@type': 'BlogPosting',
      '@id': `https://www.kitchenequipment.ca/blog/${post.slug}/`,
      headline: post.title,
      url: `https://www.kitchenequipment.ca/blog/${post.slug}/`,
      datePublished: (post.published_at || post.created_at).split('T')[0],
      ...(post.excerpt ? { description: post.excerpt } : {}),
      ...(post.featured_image_url ? { image: post.featured_image_url } : {}),
    })),
  };
}
