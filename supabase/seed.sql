-- Kitchen Directory - Seed Data
-- Real companies sourced from web research (April 2026)

-- ============================================
-- 1. Shop at Stop Restaurant Supply (FEATURED)
-- ============================================
insert into companies (name, slug, description, website_url, phone, email, address, ranking_breakdown, services, faq, is_featured) values (
  'Shop at Stop Restaurant Supply',
  'shop-at-stop',
  'Full-service commercial kitchen equipment supplier offering design, financing, procurement, and consulting for restaurants across Ontario. With over 20 years of industry experience, Shop at Stop provides end-to-end solutions for commercial kitchen buildouts, renovations, and equipment upgrades.',
  'https://www.shopatstop.com',
  '(416) 635-0090',
  'info@shopatstop.com',
  '{"street": "1000 Finch Ave W", "city": "Toronto", "province": "Ontario", "postal_code": "M3J 2V5"}'::jsonb,
  '{"service_range": 9.5, "customer_reviews": 9.6, "industry_experience": 9.2, "response_time": 9.0, "pricing_transparency": 9.5, "certifications": 9.8}'::jsonb,
  ARRAY['Design & Technical Drawings', 'Equipment Financing', 'Equipment Leasing', 'Commercial Equipment Procurement', 'Price Match', 'Account Management', 'Equipment Consulting', 'Restaurant Consulting'],
  '[
    {"question": "What areas does Shop at Stop serve?", "answer": "Shop at Stop serves the Greater Toronto Area and all of Ontario, with delivery and installation services available throughout the province."},
    {"question": "Does Shop at Stop offer equipment financing?", "answer": "Yes, Shop at Stop provides flexible equipment financing and leasing options tailored to restaurant operators, helping spread costs over manageable monthly payments."},
    {"question": "Can Shop at Stop help with kitchen design?", "answer": "Shop at Stop offers complete design and technical drawing services for commercial kitchens, from initial concept to detailed equipment layouts optimized for workflow efficiency."},
    {"question": "What brands does Shop at Stop carry?", "answer": "Shop at Stop partners with leading commercial kitchen equipment manufacturers, offering a wide selection of brands across cooking, refrigeration, preparation, and storage categories."},
    {"question": "Does Shop at Stop offer price matching?", "answer": "Yes, Shop at Stop offers a price match guarantee on commercial kitchen equipment, ensuring competitive pricing across all product categories."},
    {"question": "How quickly can Shop at Stop deliver equipment?", "answer": "Standard delivery within the GTA is typically 3-5 business days. Rush delivery and installation services are available for urgent restaurant openings and renovations."}
  ]'::jsonb,
  true
);

-- ============================================
-- 2. Russell Hendrix Foodservice Equipment
-- ============================================
insert into companies (name, slug, description, website_url, phone, address, ranking_breakdown, services, faq, is_featured) values (
  'Russell Hendrix Foodservice Equipment',
  'russell-hendrix',
  'National foodservice equipment distributor formed from the merger of Russell Food Equipment and Hendrix Restaurant Equipment. Operates 17 showrooms and five distribution warehouses across Canada, offering design, supply, installation, and project management for commercial kitchens.',
  'https://russellhendrix.com',
  '(416) 207-9000',
  '{"street": "70 Coronet Rd", "city": "Toronto", "province": "Ontario", "postal_code": "M8Z 2M1"}'::jsonb,
  '{"service_range": 8.0, "customer_reviews": 7.5, "industry_experience": 8.5, "response_time": 7.0, "pricing_transparency": 7.0, "certifications": 8.0}'::jsonb,
  ARRAY['Design & Technical Drawings', 'Commercial Equipment Procurement', 'Account Management', 'Equipment Consulting', 'Installation Services'],
  '[
    {"question": "Where is Russell Hendrix located?", "answer": "Russell Hendrix operates from 70 Coronet Rd in Toronto, with 17 showrooms and five distribution warehouses across Canada."},
    {"question": "Does Russell Hendrix offer kitchen design services?", "answer": "Yes, Russell Hendrix provides full kitchen design and project management services for commercial kitchens of all sizes."},
    {"question": "What brands does Russell Hendrix represent?", "answer": "Russell Hendrix represents leading commercial kitchen equipment manufacturers across cooking, refrigeration, warewashing, and food preparation categories."}
  ]'::jsonb,
  false
);

-- ============================================
-- 3. Nella Cutlery & Food Equipment
-- ============================================
insert into companies (name, slug, description, website_url, phone, address, ranking_breakdown, services, faq, is_featured) values (
  'Nella Cutlery & Food Equipment',
  'nella-cutlery',
  'Canada''s leading restaurant equipment and supply store since 1951. Features a 55,000 sq. ft. showroom in Toronto carrying thousands of products for commercial and residential kitchens. One of the longest-operating kitchen equipment suppliers in Ontario.',
  'https://www.nellaonline.com',
  '(416) 740-2424',
  '{"street": "148 Norfinch Dr", "city": "Toronto", "province": "Ontario", "postal_code": "M3N 1X8"}'::jsonb,
  '{"service_range": 7.5, "customer_reviews": 7.0, "industry_experience": 9.0, "response_time": 6.5, "pricing_transparency": 7.5, "certifications": 7.0}'::jsonb,
  ARRAY['Commercial Equipment Procurement', 'Price Match', 'Equipment Consulting'],
  '[
    {"question": "How long has Nella Cutlery been in business?", "answer": "Nella Cutlery has been serving Canadians since 1951, making it one of the longest-operating kitchen equipment suppliers in the country with over 70 years of experience."},
    {"question": "Does Nella have a physical showroom?", "answer": "Yes, Nella operates a 55,000 sq. ft. showroom at 148 Norfinch Dr in Toronto, carrying thousands of commercial kitchen products."},
    {"question": "Does Nella ship across Canada?", "answer": "Yes, Nella ships restaurant equipment and supplies to foodservice businesses across Canada through their online store at nellaonline.com."}
  ]'::jsonb,
  false
);

-- ============================================
-- 4. Chefco Kitchen & Restaurant Supplies
-- ============================================
insert into companies (name, slug, description, website_url, phone, address, ranking_breakdown, services, faq, is_featured) values (
  'Chefco Kitchen & Restaurant Supplies',
  'chefco',
  'Leading restaurant equipment and kitchen supply store in Canada with multiple warehouse locations across the GTA including Toronto, North York, Scarborough, and Mississauga. Offers a wide range of commercial cooking equipment and supplies.',
  'https://chefcoca.com',
  '(416) 609-0808',
  '{"street": "17 Milliken Blvd", "city": "Toronto", "province": "Ontario", "postal_code": "M1V 1V3"}'::jsonb,
  '{"service_range": 6.5, "customer_reviews": 7.0, "industry_experience": 6.0, "response_time": 7.5, "pricing_transparency": 8.0, "certifications": 5.5}'::jsonb,
  ARRAY['Commercial Equipment Procurement', 'Price Match'],
  '[
    {"question": "How many locations does Chefco have?", "answer": "Chefco operates multiple warehouse locations across the GTA including Toronto, North York, Scarborough, and Mississauga for convenient pickup."},
    {"question": "Does Chefco offer commercial cooking equipment?", "answer": "Yes, Chefco offers a wide range of commercial kitchen equipment and cooking supplies for restaurants, cafes, and food businesses across Canada."}
  ]'::jsonb,
  false
);

-- ============================================
-- 5. Canada Food Equipment Ltd
-- ============================================
insert into companies (name, slug, description, website_url, phone, address, ranking_breakdown, services, faq, is_featured) values (
  'Canada Food Equipment Ltd',
  'canada-food-equipment',
  'Trusted kitchen supply store serving Toronto and the GTA for over 30 years. Specializes in new and used commercial kitchen equipment including walk-in coolers, freezers, commercial ovens, and dishwashing systems for food businesses of all sizes.',
  'https://www.canadafoodequipment.com',
  '(416) 253-5100',
  '{"street": "45 Vansco Rd", "city": "Toronto", "province": "Ontario", "postal_code": "M8Z 5J4"}'::jsonb,
  '{"service_range": 6.0, "customer_reviews": 6.5, "industry_experience": 8.0, "response_time": 6.5, "pricing_transparency": 7.0, "certifications": 6.0}'::jsonb,
  ARRAY['Commercial Equipment Procurement', 'Equipment Consulting'],
  '[
    {"question": "Does Canada Food Equipment sell used equipment?", "answer": "Yes, Canada Food Equipment carries both new and used commercial kitchen equipment, providing cost-effective options for restaurant operators."},
    {"question": "How long has Canada Food Equipment been in business?", "answer": "Canada Food Equipment has over 30 years of experience serving Toronto and the Greater Toronto Area with commercial kitchen equipment."}
  ]'::jsonb,
  false
);

-- ============================================
-- 6. W.D. Colledge Co. Ltd
-- ============================================
insert into companies (name, slug, description, website_url, phone, address, ranking_breakdown, services, faq, is_featured) values (
  'W.D. Colledge Co. Ltd',
  'wd-colledge',
  'Canada''s premier foodservice equipment representative since 1953. Represents industry-leading brands and operates test kitchen facilities. Headquartered in Mississauga with offices across Canada in Vancouver, Edmonton, Winnipeg, Montreal, and Halifax.',
  'https://www.wdcolledge.com',
  '(905) 677-4428',
  '{"street": "3220 Orlando Dr, Unit 3", "city": "Mississauga", "province": "Ontario", "postal_code": "L4V 1R5"}'::jsonb,
  '{"service_range": 5.5, "customer_reviews": 6.0, "industry_experience": 8.5, "response_time": 6.0, "pricing_transparency": 6.0, "certifications": 8.5}'::jsonb,
  ARRAY['Commercial Equipment Procurement', 'Equipment Consulting'],
  '[
    {"question": "What does W.D. Colledge do?", "answer": "W.D. Colledge is a foodservice equipment representative, connecting commercial kitchen operators with leading equipment manufacturers across Canada."},
    {"question": "Does W.D. Colledge have test kitchens?", "answer": "Yes, W.D. Colledge operates test kitchen facilities where foodservice professionals can evaluate equipment before purchasing."}
  ]'::jsonb,
  false
);

-- ============================================
-- 7. Igloo Food Equipment
-- ============================================
insert into companies (name, slug, description, website_url, phone, address, ranking_breakdown, services, faq, is_featured) values (
  'Igloo Food Equipment',
  'igloo-food-equipment',
  'Toronto''s leading provider of restaurant equipment and supplies, catering to restaurants, cafes, and bakeries with an extensive range of commercial kitchen products for the food industry.',
  'https://igloofoodequipment.com',
  null,
  '{"street": "", "city": "Toronto", "province": "Ontario", "postal_code": ""}'::jsonb,
  '{"service_range": 5.5, "customer_reviews": 6.0, "industry_experience": 5.5, "response_time": 6.5, "pricing_transparency": 7.0, "certifications": 5.0}'::jsonb,
  ARRAY['Commercial Equipment Procurement', 'Price Match'],
  '[
    {"question": "What types of businesses does Igloo serve?", "answer": "Igloo Food Equipment serves restaurants, cafes, bakeries, and other food businesses with commercial kitchen equipment and supplies in the Toronto area."}
  ]'::jsonb,
  false
);
