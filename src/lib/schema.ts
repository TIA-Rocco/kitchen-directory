import type { Company, Review, FaqItem, ServiceCategory } from './types';

export function buildLocalBusinessSchema(company: Company, reviews: Review[]) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `https://kitchenequipment.ca/companies/${company.slug}`,
    name: company.name,
    description: company.description,
    url: `https://kitchenequipment.ca/companies/${company.slug}`,
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

  return schema;
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
        '@id': `https://kitchenequipment.ca/companies/${company.slug}`,
        name: company.name,
        url: `https://kitchenequipment.ca/companies/${company.slug}`,
      },
    })),
  };
}

export function buildWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Kitchen Equipment Canada',
    url: 'https://kitchenequipment.ca',
    description:
      'Find and compare the best commercial kitchen equipment suppliers in Canada. Independent ratings, reviews, and service comparisons.',
  };
}

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Kitchen Equipment Canada',
    url: 'https://kitchenequipment.ca',
    logo: 'https://kitchenequipment.ca/logo.svg',
  };
}
