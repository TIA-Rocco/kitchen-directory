#!/usr/bin/env node
/*
 * build-companies-seed.cjs
 * ------------------------------------------------------------------
 * Emits supabase/seed/ten_companies_per_service.sql — adds verified, real
 * Canadian (Ontario-preferred) commercial kitchen equipment companies so every
 * /services/[slug] category lists at least 10 suppliers (Price Match is the one
 * exception: only ~7 Canadian companies publish a real price-match policy, so it
 * is kept truthful at 7 rather than padded).
 *
 * Every company below was verified by opening its website / a reputable listing.
 * Services are tagged ONLY where there was explicit evidence the company offers
 * them. No fabricated phone numbers, addresses, emails, or statistics.
 *
 * Ranking_breakdown is editorial (6 weighted criteria). All composites land
 * BELOW Shop at Stop (9.4) and at/under the top competitor (Russell Hendrix 7.7),
 * preserving S.T.O.P as the #1 listing. The DB trigger computes ranking_score.
 *
 * Usage: node scripts/build-companies-seed.cjs > /dev/null
 *        (writes supabase/seed/ten_companies_per_service.sql)
 */
const fs = require('fs');
const path = require('path');

// --- Editorial ranking_breakdown profiles (composite shown in comment) --------
const RB = {
  '76': { service_range: 8.0, customer_reviews: 7.5, industry_experience: 8.0, response_time: 7.5, pricing_transparency: 7.0, certifications: 7.0 }, // 7.6
  '74': { service_range: 8.0, customer_reviews: 7.5, industry_experience: 7.5, response_time: 7.0, pricing_transparency: 7.0, certifications: 7.0 }, // 7.4
  '71': { service_range: 7.5, customer_reviews: 7.0, industry_experience: 7.5, response_time: 7.0, pricing_transparency: 6.5, certifications: 6.5 }, // 7.1
  '69': { service_range: 7.0, customer_reviews: 6.5, industry_experience: 7.5, response_time: 7.0, pricing_transparency: 6.5, certifications: 6.5 }, // 6.9
  '66': { service_range: 7.0, customer_reviews: 6.5, industry_experience: 7.0, response_time: 6.5, pricing_transparency: 6.0, certifications: 6.0 }, // 6.6
  '63': { service_range: 6.5, customer_reviews: 6.5, industry_experience: 6.5, response_time: 6.0, pricing_transparency: 6.0, certifications: 6.0 }, // 6.3
  '61': { service_range: 6.5, customer_reviews: 6.0, industry_experience: 6.5, response_time: 6.0, pricing_transparency: 5.5, certifications: 5.5 }, // 6.1
  '58': { service_range: 6.0, customer_reviews: 5.5, industry_experience: 6.0, response_time: 6.0, pricing_transparency: 6.0, certifications: 5.5 }, // 5.8
  '56': { service_range: 6.0, customer_reviews: 5.5, industry_experience: 6.0, response_time: 5.5, pricing_transparency: 5.5, certifications: 5.0 }, // 5.65
  '54': { service_range: 5.5, customer_reviews: 5.5, industry_experience: 5.5, response_time: 5.5, pricing_transparency: 5.0, certifications: 5.0 }, // 5.4
};

// Canonical service names (must match service_categories.name exactly)
const S = {
  AM: 'Account Management',
  CEP: 'Commercial Equipment Procurement',
  DTD: 'Design & Technical Drawings',
  EC: 'Equipment Consulting',
  EF: 'Equipment Financing',
  EL: 'Equipment Leasing',
  INS: 'Installation Services',
  PM: 'Price Match',
  RC: 'Restaurant Consulting',
};

// --- Verified new companies ---------------------------------------------------
const COMPANIES = [
  {
    name: 'TFI Food Equipment Solutions', slug: 'tfi-food-equipment',
    website: 'https://www.tficanada.com', phone: '(905) 790-2211', email: null,
    street: '5945 Airport Rd, Suite 170', city: 'Mississauga', province: 'Ontario', postal: 'L4V 1R9',
    description: 'TFI Food Equipment Solutions is one of Canada’s largest commercial foodservice equipment suppliers, with over 60 years in business and a Mississauga showroom plus a Bolton parts warehouse. It handles equipment sales, financing and leasing, professional installation, training and 24/7 service for national chains and independent operators.',
    services: [S.CEP, S.EF, S.EL, S.INS, S.AM, S.EC],
    certifications: [], rb: '76',
  },
  {
    name: 'United Trimen', slug: 'united-trimen',
    website: 'https://unitedtrimen.com', phone: '1-800-461-0000', email: 'sales@unitedtrimen.com',
    street: '1250 Ormont Dr', city: 'Toronto', province: 'Ontario', postal: 'M9L 2V4',
    description: 'United Trimen is a North York based commercial foodservice equipment and smallwares distributor and a subsidiary of Gordon Food Service. It designs, sells and installs commercial kitchen solutions for stadiums, hospitals and restaurant chains, offering a single nationwide source backed by a 24-hour service hotline.',
    services: [S.INS, S.AM, S.DTD, S.CEP],
    certifications: [], rb: '74',
  },
  {
    name: 'Doyon Despres', slug: 'doyon-despres',
    website: 'https://www.doyondespres.com', phone: '1-866-444-1110', email: null,
    street: '525 rue du Marais', city: 'Quebec City', province: 'Quebec', postal: 'G1M 2Y2',
    description: 'Doyon Despres is one of Quebec’s largest full-service foodservice equipment dealers, fabricators and suppliers, formed from the merger of Doyon Cuisine and Despres Laporte. It carries thousands of products across a network of branches, provides commercial kitchen design, and publishes a guaranteed best-price policy.',
    services: [S.PM, S.CEP, S.DTD, S.INS, S.AM],
    certifications: [], rb: '74',
  },
  {
    name: 'HESCO Foodservice', slug: 'hesco-foodservice',
    website: 'https://hesco.ca', phone: '(437) 568-2013', email: null,
    street: null, city: 'Toronto', province: 'Ontario', postal: null,
    description: 'HESCO is a commercial kitchen and restaurant equipment dealer with locations in Edmonton, Calgary and Toronto. It offers kitchen design, equipment sales and consulting, professional installation, and a financing and leasing program delivered through partners Econolease and SilverChef.',
    services: [S.CEP, S.DTD, S.EC, S.EF, S.EL, S.INS],
    certifications: [], rb: '71',
  },
  {
    name: 'Hubert Canada', slug: 'hubert-canada',
    website: 'https://www.hubert.ca', phone: '1-888-835-7929', email: null,
    street: '20 Valleywood Drive, Suite 108', city: 'Markham', province: 'Ontario', postal: 'L3R 6G1',
    description: 'Hubert Canada is a Markham based distributor of foodservice equipment, supplies and food-merchandising solutions. It serves multi-location and retail foodservice operators with tailored account programs spanning equipment selection, rollout and ongoing optimization, supported by dedicated account-management staff.',
    services: [S.AM, S.CEP],
    certifications: [], rb: '71',
  },
  {
    name: 'Econolease Financial Services', slug: 'econolease',
    website: 'https://www.econolease.com', phone: '1-888-473-9309', email: null,
    street: '30 Rolark Drive', city: 'Toronto', province: 'Ontario', postal: 'M1R 4G2',
    description: 'Econolease is a dedicated equipment financing provider for the hospitality and foodservice industry, widely cited as a leading Canadian commercial-kitchen equipment financier. It offers leases, loans and a Rent-Try-Buy program, each supported by a dedicated account manager. It is a Certified B Corporation.',
    services: [S.EF, S.EL, S.AM],
    certifications: ['Certified B Corporation'], rb: '71',
  },
  {
    name: 'Bouthillette Parizeau (BPA)', slug: 'bouthillette-parizeau',
    website: 'https://bpa.ca', phone: '(416) 499-8000', email: null,
    street: '200 King St. West, Suite 310', city: 'Toronto', province: 'Ontario', postal: 'M5H 3T4',
    description: 'Bouthillette Parizeau (BPA) is a Canadian engineering and consulting firm with a dedicated Food Services division and offices across Canada, including Toronto. It provides study and design of commercial, institutional and agrifood kitchens, including functional programming, layouts, CAD drawings, equipment consulting and budgeting.',
    services: [S.DTD, S.EC],
    certifications: [], rb: '71',
  },
  {
    name: 'Browne Foodservice', slug: 'browne-foodservice',
    website: 'https://brownefoodservice.com', phone: '1-866-475-6104', email: 'cs@browneco.com',
    street: '390 Addison Hall Circle', city: 'Aurora', province: 'Ontario', postal: 'L4G 7C7',
    description: 'Browne Foodservice (Browne & Co.) is an Ontario based designer, manufacturer and distributor of foodservice smallwares and equipment including cookware, tabletop, buffet and barware. With roughly 75 years in business, it serves foodservice and retail through a regional account-management and national-accounts structure.',
    services: [S.AM, S.CEP],
    certifications: [], rb: '69',
  },
  {
    name: 'Celco Inc.', slug: 'celco',
    website: 'https://www.celco.ca', phone: '(905) 364-5200', email: null,
    street: '6135 Danville Rd', city: 'Mississauga', province: 'Ontario', postal: 'L5T 2H7',
    description: 'Celco is a Mississauga based, Canada-wide distributor of commercial foodservice equipment founded in 1975. It supports multi-location restaurant brands across foodservice, grocery, healthcare and institutional sectors with a network of market specialists, a consultative approach, plus equipment training, installation and service.',
    services: [S.CEP, S.EC, S.INS, S.AM],
    certifications: ['MAFSI member'], rb: '69',
  },
  {
    name: 'BakeMax', slug: 'bakemax',
    website: 'https://bakemax.com', phone: '1-800-565-2253', email: 'OrderDesk@BakeMax.com',
    street: '20 Caribou St', city: 'Moncton', province: 'New Brunswick', postal: 'E1H 0P3',
    description: 'BakeMax (Titan Ventures International) is a Canadian bakery, pizza and commercial kitchen equipment manufacturer and dealer with a national dealer network. It supplies a broad range of foodservice equipment and offers restaurant equipment financing and leasing through a partnership with Econolease.',
    services: [S.CEP, S.EF, S.EL],
    certifications: [], rb: '69',
  },
  {
    name: 'KAIZEN Foodservice Planning & Design', slug: 'kaizen-foodservice',
    website: 'https://www.kaizenfood.com', phone: '(905) 338-3222', email: null,
    street: 'Unit 14, 1525 Cornwall Rd', city: 'Oakville', province: 'Ontario', postal: 'L6J 0B2',
    description: 'KAIZEN Foodservice Planning & Design is an Oakville based, full-service foodservice planning and design consultancy serving the institutional sector. Its FCSI-credentialed consultants, project managers and REVIT technologists deliver facility design, equipment specification and operational advisory services alongside project architects and engineers.',
    services: [S.DTD, S.EC, S.RC],
    certifications: ['FCSI Professional Members'], rb: '69',
  },
  {
    name: 'Paragon Food Equipment', slug: 'paragon-food-equipment',
    website: 'https://www.paragondirect.ca', phone: '(604) 255-9991', email: null,
    street: '760 E. Hastings St', city: 'Vancouver', province: 'British Columbia', postal: 'V6A 1R5',
    description: 'Paragon Food Equipment is a Vancouver based commercial restaurant and kitchen equipment dealer that has served foodservice professionals for roughly 40 years and ships across Canada. It carries top-brand equipment and smallwares, runs a documented Price Match Guarantee, and offers lease, rent and financing options.',
    services: [S.CEP, S.EF, S.EL, S.PM],
    certifications: [], rb: '69',
  },
  {
    name: 'GBS Foodservice Equipment', slug: 'gbs-foodservice',
    website: 'https://gbscooks.com', phone: '(905) 829-5534', email: null,
    street: '2871 Brighton Road', city: 'Oakville', province: 'Ontario', postal: 'L6H 6C9',
    description: 'GBS Foodservice Equipment is an Oakville based national distributor and service provider, founded in 1974, representing 18 leading lines of foodservice equipment. It supports customers through a coast-to-coast service network of on-staff technicians and partner service companies and a dedicated account-management team.',
    services: [S.AM, S.CEP],
    certifications: [], rb: '66',
  },
  {
    name: 'fsSTRATEGY Inc.', slug: 'fsstrategy',
    website: 'https://www.fsstrategy.com', phone: '(416) 229-2290', email: 'nextsteps@fsstrategy.com',
    street: null, city: 'Toronto', province: 'Ontario', postal: null,
    description: 'fsSTRATEGY is a professional consulting firm serving the hospitality industry with special emphasis on foodservice, operating from Toronto and Montreal. It delivers strategic and business plans, feasibility analyses, concept development, operations reviews, menu optimization and foodservice master plans.',
    services: [S.RC, S.DTD, S.EC],
    certifications: ['CMC-Canada member', 'ISHC member'], rb: '66',
  },
  {
    name: 'NewCap Leasing', slug: 'newcap-leasing',
    website: 'https://www.newcapleasing.com', phone: '(416) 645-0286', email: null,
    street: '222 Norfinch Drive', city: 'Toronto', province: 'Ontario', postal: 'M3N 1X8',
    description: 'NewCap Leasing is a Canadian commercial equipment leasing and financing firm founded in 2012 that finances new and used restaurant and foodservice equipment including refrigeration, ovens, ice machines and mixers. It offers lease-to-own, working capital loans and equipment refinancing with fast approvals across Canada.',
    services: [S.EF, S.EL],
    certifications: [], rb: '66',
  },
  {
    name: 'Babak Food Equipment', slug: 'babak-food-equipment',
    website: 'https://babakfoodequipment.com', phone: '(604) 566-9747', email: null,
    street: '7190 Randolph Ave', city: 'Burnaby', province: 'British Columbia', postal: 'V5J 4W6',
    description: 'Babak Food Equipment is a Burnaby based commercial restaurant equipment dealer, with a Laval office, offering equipment sales, service and repair, consultation and design, metal fabrication, and leasing and financing options. It also advertises price matching, subject to some restrictions.',
    services: [S.CEP, S.EC, S.DTD, S.EF, S.EL, S.INS, S.PM, S.RC],
    certifications: [], rb: '66',
  },
  {
    name: 'ADL Fournisseur Commercial', slug: 'adl-fournisseur-commercial',
    website: 'https://goadl.com', phone: '1-800-463-7113', email: 'info@goadl.com',
    street: '1639 Autoroute 440 Ouest', city: 'Laval', province: 'Quebec', postal: 'H7L 3W3',
    description: 'ADL Fournisseur Commercial is a Laval based commercial restaurant equipment supplier operating since 1988. It imports, manufactures and sells commercial cooking equipment, refrigeration, stainless steel work tables, food-prep machinery and walk-in cold rooms, advertises a best-price policy, offers financing, and delivers and installs cold rooms.',
    services: [S.PM, S.CEP, S.EF, S.INS],
    certifications: [], rb: '66',
  },
  {
    name: 'J.F.S. Restaurant Equipment', slug: 'jfs-restaurant-equipment',
    website: 'https://www.jfsltd.com', phone: '(416) 242-2971', email: null,
    street: '2009 Lawrence Ave W, Unit 18', city: 'Toronto', province: 'Ontario', postal: 'M9N 3V2',
    description: 'J.F.S. Restaurant Equipment is a Toronto based restaurant equipment and supply store founded in 1979, serving the GTA. It sources and supplies commercial kitchen equipment, tableware, bar supplies and furniture, offers practical equipment guidance, and provides lease-purchase options.',
    services: [S.CEP, S.EC, S.EL],
    certifications: [], rb: '66',
  },
  {
    name: 'KRG Hospitality', slug: 'krg-hospitality',
    website: 'https://krghospitality.com', phone: '1-866-575-9552', email: 'Success@KRGhospitality.com',
    street: '140 Yonge Street', city: 'Toronto', province: 'Ontario', postal: null,
    description: 'KRG Hospitality is a hospitality consulting agency founded in 2009 specializing in pre-opening strategy for bars, restaurants and hotels. It delivers feasibility studies, concept and brand development, business plans, financial modeling, menu development and end-to-end project coordination.',
    services: [S.RC],
    certifications: [], rb: '66',
  },
  {
    name: 'Brama Inc.', slug: 'brama',
    website: 'https://bramainc.com', phone: '(905) 760-9200', email: 'customer@bramainc.com',
    street: '175 Romina Drive', city: 'Vaughan', province: 'Ontario', postal: 'L4K 4V3',
    description: 'Brama is a Vaughan based supplier of commercial kitchen and foodservice equipment and supplies operating since 1982. It runs a showroom and an extensive product catalog serving restaurants across Toronto and the GTA.',
    services: [S.CEP],
    certifications: [], rb: '63',
  },
  {
    name: 'Foundry Kitchens', slug: 'foundry-kitchens',
    website: 'https://foundrykitchens.com', phone: '(604) 216-2566', email: 'info@foundrykitchens.com',
    street: '1020 East Cordova Street', city: 'Vancouver', province: 'British Columbia', postal: 'V6A 4A3',
    description: 'Foundry Kitchens is a Canadian foodservice design agency, custom stainless fabrication shop and equipment dealership established in 2001. It provides foodservice facility design, equipment supply and installation, and actively serves the Greater Toronto Area in addition to its Vancouver base.',
    services: [S.DTD, S.CEP, S.INS],
    certifications: [], rb: '63',
  },
  {
    name: 'ProXpedite Inc.', slug: 'proxpedite',
    website: 'https://proxpedite.ca', phone: '1-877-776-9123', email: 'info@proxpedite.com',
    street: '4226 Raney Cres.', city: 'London', province: 'Ontario', postal: 'N6L 1C3',
    description: 'ProXpedite is a London, Ontario firm founded in 2014 specializing in commercial kitchen design and installation. It sources equipment, stages and consolidates delivery from its warehouses, and installs complete kitchens including exhaust hoods and refrigeration using certified installers across the GTA and Western Ontario.',
    services: [S.DTD, S.INS, S.CEP, S.EC],
    certifications: [], rb: '63',
  },
  {
    name: 'Continental Restaurant Equipment', slug: 'continental-restaurant-equipment',
    website: 'https://continentalrestaurantequipment.ca', phone: '(416) 783-5907', email: 'continentalrestaurantequipment@gmail.com',
    street: '287 Bridgeland Ave', city: 'Toronto', province: 'Ontario', postal: 'M6A 1Z4',
    description: 'Continental Restaurant Equipment is a Toronto supplier of commercial kitchen equipment, refrigeration and cooking equipment in business since 1994. It offers pre- and post-purchase support from experienced equipment people and equipment financing through an Econolease partnership.',
    services: [S.CEP, S.EC, S.EF],
    certifications: [], rb: '63',
  },
  {
    name: 'Mehmi Financial Group', slug: 'mehmi-financial-group',
    website: 'https://www.mehmigroup.com', phone: '(437) 777-5901', email: null,
    street: '77 City Centre Dr, Suite 501', city: 'Mississauga', province: 'Ontario', postal: 'L5B 1M5',
    description: 'Mehmi Financial Group is an Ontario based lending and leasing firm that structures restaurant and foodservice equipment financing, including loans, leases, sale-leaseback and equipment lines of credit, for ranges, fryers, dishwashers, walk-ins and ice machines, with fast approvals across Canada.',
    services: [S.EF, S.EL],
    certifications: [], rb: '63',
  },
  {
    name: 'MCK Equipment', slug: 'mck-equipment',
    website: 'https://mckonline.ca', phone: '1-833-978-8833', email: 'sales@mckequipment.ca',
    street: '3603 Millar Ave #4', city: 'Saskatoon', province: 'Saskatchewan', postal: 'S7P 0B2',
    description: 'MCK Equipment (Marquis Commercial Kitchen) is a Canadian commercial kitchen equipment retailer with a Saskatoon showroom and Canada-wide online sales. It offers financing and leasing for hospitality equipment through partners Econolease and NewCap, including Rent-Try-Buy and lease-to-own options.',
    services: [S.CEP, S.EF, S.EL],
    certifications: [], rb: '63',
  },
  {
    name: 'Canadian Restaurant Supply', slug: 'canadian-restaurant-supply',
    website: 'https://www.canadianrestaurantsupply.com', phone: '(250) 979-1442', email: null,
    street: '6 - 2604 Enterprise Way', city: 'Kelowna', province: 'British Columbia', postal: 'V1X 7Y5',
    description: 'Canadian Restaurant Supply is a Kelowna based commercial kitchen design and equipment firm with a team of consultants, designers and project managers. It outfits restaurants with comprehensive kitchen design, equipment supply and consulting, and offers financing and leasing through Econolease.',
    services: [S.RC, S.DTD, S.EC, S.CEP, S.EF, S.EL],
    certifications: [], rb: '63',
  },
  {
    name: 'Commercial Kitchen Build', slug: 'commercial-kitchen-build',
    website: 'https://commercialkitchenbuild.ca', phone: '(905) 616-2523', email: 'office@constructionatapex.com',
    street: '60 Bristol Rd East, Suite 249', city: 'Mississauga', province: 'Ontario', postal: 'L4Z 3K8',
    description: 'Commercial Kitchen Build (operated by Apex Consulting and Management) is a Mississauga based commercial kitchen design-build firm. It designs, supplies and installs commercial kitchen equipment, exhaust hood systems and fire suppression for GTA foodservice businesses, with a focus on fire-code and building-standard compliance.',
    services: [S.CEP, S.DTD, S.INS, S.EC],
    certifications: [], rb: '61',
  },
  {
    name: 'KAF Bar Supplies', slug: 'kaf-bar-supplies',
    website: 'https://kafsupplies.com', phone: '(905) 997-5231', email: 'info@kafsupplies.com',
    street: '4140A Sladeview Crescent', city: 'Mississauga', province: 'Ontario', postal: 'L5L 6A1',
    description: 'KAF Bar Supplies is a Mississauga based supplier serving bars and restaurants across the GTA. Alongside commercial kitchen and bar equipment, it offers custom kitchen and bar design, layout and space planning, equipment consulting and sourcing, and broader restaurant and bar planning services.',
    services: [S.CEP, S.DTD, S.EC, S.RC],
    certifications: [], rb: '61',
  },
  {
    name: 'Old Fashioned Restaurants', slug: 'ofr-concepts',
    website: 'https://www.ofrconcepts.ca', phone: '(416) 677-1281', email: null,
    street: '19 Barberry Place', city: 'Toronto', province: 'Ontario', postal: 'M2K 3E3',
    description: 'Old Fashioned Restaurants (OFR Concepts) is a Toronto hospitality consulting firm founded in 2014. It helps restaurateurs open and operate profitable businesses through concept design, pre-construction project management, kitchen and equipment layout, equipment sourcing, menu engineering and operational audits.',
    services: [S.RC, S.DTD, S.EC, S.CEP],
    certifications: [], rb: '61',
  },
  {
    name: 'Enterprise Restaurant Consulting', slug: 'enterprise-restaurant-consulting',
    website: 'https://erestaurantconsulting.ca', phone: '(647) 209-4153', email: 'support@erc1.net',
    street: '5800 Ambler Dr., Unit 114', city: 'Mississauga', province: 'Ontario', postal: null,
    description: 'Enterprise Restaurant Consulting is a Mississauga based restaurant and franchise consulting firm helping quick-service and full-service brands scale. It delivers operations and SOP development, menu engineering and food costing, franchise development, and kitchen design with equipment layout and sourcing.',
    services: [S.RC, S.DTD, S.EC, S.CEP],
    certifications: [], rb: '61',
  },
  {
    name: 'Fincap Financial Group', slug: 'fincap-financial-group',
    website: 'https://www.fincapfinancialgroup.ca', phone: '(819) 643-9997', email: 'info@fincapfinancialgroup.ca',
    street: '510 Blvd. Maloney E, Suite 104', city: 'Gatineau', province: 'Quebec', postal: 'J8P 1E7',
    description: 'Fincap Financial Group is a Canadian equipment finance company that arranges restaurant equipment financing and leasing for new and used equipment such as pizza ovens, fryers, dishwashers, ice machines and cold rooms, working with a network of lenders for fast approvals.',
    services: [S.EF, S.EL],
    certifications: [], rb: '61',
  },
  {
    name: 'Zanduco Restaurant Equipment & Supplies', slug: 'zanduco',
    website: 'https://www.zanduco.com/ca', phone: '1-855-926-3826', email: 'sales@zanduco.com',
    street: '2185 N Sheridan Way', city: 'Mississauga', province: 'Ontario', postal: 'L5K 1A4',
    description: 'Zanduco is a Mississauga based online commercial kitchen equipment and supplies retailer serving Canada and the US. It carries a full catalog of commercial kitchen equipment and smallwares and offers a documented Price Match Guarantee on qualifying products.',
    services: [S.CEP, S.PM],
    certifications: [], rb: '61',
  },
  {
    name: 'The Cook’s Mate', slug: 'the-cooks-mate',
    website: 'https://thecooksmate.com', phone: '(416) 759-8122', email: null,
    street: '505 Ellesmere Road, Unit 1', city: 'Toronto', province: 'Ontario', postal: 'M1R 4E5',
    description: 'The Cook’s Mate is a Scarborough based commercial restaurant equipment supplier offering equipment sales, delivery and installation across Ontario, plus leasing and financing through a partner. It operates a RATIONAL demo kitchen and supports operators before and after purchase.',
    services: [S.CEP, S.EC, S.EF, S.EL, S.INS],
    certifications: [], rb: '61',
  },
  {
    name: 'iFoodEquipment.ca', slug: 'ifoodequipment',
    website: 'https://ifoodequipment.ca', phone: '(905) 544-0577', email: null,
    street: '223 Avondale Street', city: 'Hamilton', province: 'Ontario', postal: 'L8L 7C4',
    description: 'iFoodEquipment.ca is a family-owned Hamilton based restaurant equipment and supplies dealer selling refrigeration, food prep tools and smallwares Canada-wide. It runs a restaurant equipment rental and financing program with a 12-month rent-try-buy that can convert to lease-to-own.',
    services: [S.CEP, S.EF, S.EL],
    certifications: [], rb: '58',
  },
  {
    name: 'Ontario Restaurant Supply', slug: 'ontario-restaurant-supply',
    website: 'https://ontariorestaurantsupply.ca', phone: '(226) 330-0333', email: null,
    street: '530 First Street', city: 'London', province: 'Ontario', postal: null,
    description: 'Ontario Restaurant Supply is a locally owned, family operated London, Ontario restaurant equipment store carrying brand-name new and used commercial kitchen equipment. It advertises a price match guarantee and lowest-price positioning on brand-name equipment.',
    services: [S.CEP, S.PM],
    certifications: [], rb: '58',
  },
  {
    name: 'A1 Cash and Carry', slug: 'a1-cash-and-carry',
    website: 'https://www.a1cashandcarry.com', phone: '(905) 676-9950', email: 'ecommerce@a1cashandcarry.com',
    street: '6400 Kennedy Road', city: 'Mississauga', province: 'Ontario', postal: null,
    description: 'A1 Cash and Carry is a wholesale food and restaurant supply cash-and-carry chain headquartered in Mississauga, with additional GTA stores in Etobicoke, North York and Burlington. It sells restaurant equipment, wares and supplies online and in-store.',
    services: [S.CEP],
    certifications: [], rb: '58',
  },
  {
    name: 'Franchise 360', slug: 'franchise-360',
    website: 'https://franchise360.ca', phone: '(647) 945-7999', email: 'info@franchise360.ca',
    street: null, city: 'Toronto', province: 'Ontario', postal: null,
    description: 'Franchise 360 is a Toronto restaurant and franchise consultancy guiding projects from inception to launch. It provides business planning and feasibility assessment, branding, menu development, standard operating procedures, build-out management, recruiting and ongoing operational and management services.',
    services: [S.RC, S.CEP],
    certifications: [], rb: '58',
  },
  {
    name: 'MP HVAC Corporation', slug: 'mp-hvac',
    website: 'https://www.mphvaccorporation.com', phone: '(416) 825-0911', email: 'info@mphvaccorporation.com',
    street: null, city: 'Scarborough', province: 'Ontario', postal: null,
    description: 'MP HVAC Corporation is a Scarborough based HVAC company serving Toronto and the GTA, specializing in commercial kitchen exhaust hood and canopy installation, make-up air units, ductwork, exhaust fans and UL 300 fire suppression, including complete turnkey installs.',
    services: [S.INS],
    certifications: ['TSSA Certified', 'UL 300 Fire Suppression', 'G1 Licensed Gas Technicians'], rb: '58',
  },
  {
    name: 'Apex Electric and Mechanical', slug: 'apex-electric-mechanical',
    website: 'https://apexelectricmechanical.ca', phone: '(416) 273-9800', email: null,
    street: '263 Dixon Road, Unit 1110', city: 'Toronto', province: 'Ontario', postal: 'M9R 1R6',
    description: 'Apex Electric and Mechanical is a Toronto and GTA contractor, established in 2016, that installs, repairs and inspects commercial kitchen hoods and exhaust systems for restaurants, ghost kitchens, food trucks, cafeterias and institutional foodservice, including Type I and II hoods, make-up air integration and Ansul fire suppression.',
    services: [S.INS],
    certifications: ['TSSA Certified Gas Contractor', 'ECRA/ESA Licensed Electrical Contractor', '313A Certified Refrigeration Mechanics', 'WSIB Registered'], rb: '58',
  },
  {
    name: 'Avondale Commercial Solutions', slug: 'avondale-commercial-solutions',
    website: 'https://avondale-commercial-solutions.ueniweb.com', phone: null, email: null,
    street: null, city: 'Hamilton', province: 'Ontario', postal: null,
    description: 'Avondale Commercial Solutions is a Hamilton, Ontario commercial kitchen consultant with over 20 years in the foodservice industry. It focuses on a straightforward approach to kitchen design, floor plan layouts, and equipment specification and procurement.',
    services: [S.DTD, S.EC, S.CEP],
    certifications: [], rb: '56',
  },
  {
    name: 'Toronto Restaurant Consultants', slug: 'toronto-restaurant-consultants',
    website: 'https://www.restaurantconsultant.ca', phone: null, email: null,
    street: null, city: 'Toronto', province: 'Ontario', postal: null,
    description: 'Toronto Restaurant Consultants is a Toronto restaurant consulting firm offering operations support, menu engineering, commercial kitchen design, culinary recruitment, and beverage, POS and marketing services for quick-service through fine-dining establishments.',
    services: [S.RC, S.DTD],
    certifications: [], rb: '56',
  },
  {
    name: 'Fried Sage Hospitality', slug: 'fried-sage-hospitality',
    website: 'https://www.friedsage.com', phone: null, email: null,
    street: null, city: 'Hamilton', province: 'Ontario', postal: null,
    description: 'Fried Sage Hospitality is a Hamilton, Ontario chef-led hospitality consultancy that partners with restaurants, hotels and food businesses on concept development, menu engineering, brand strategy and kitchen performance optimization.',
    services: [S.RC],
    certifications: [], rb: '56',
  },
  {
    name: 'MB Food Equipment', slug: 'mb-food-equipment',
    website: 'https://mbfoodequipment.com', phone: '(289) 993-5999', email: 'mbfoodequipment@gmail.com',
    street: '447 Speers Road, Unit 15', city: 'Oakville', province: 'Ontario', postal: 'L6K 3S7',
    description: 'MB Food Equipment is an Oakville based dealer of used commercial foodservice equipment serving the GTA, carrying a large inventory and representing manufacturers from across the foodservice equipment industry.',
    services: [S.CEP],
    certifications: [], rb: '54',
  },
  {
    name: 'Kitchen Treasure Restaurant Supplies', slug: 'kitchen-treasure',
    website: 'https://www.kitchentreasuresupplies.com', phone: '(416) 832-1361', email: null,
    street: '955 Middlefield Rd, Unit 4', city: 'Scarborough', province: 'Ontario', postal: 'M1V 5E2',
    description: 'Kitchen Treasure Restaurant Supplies is a Scarborough based restaurant and kitchen supply retailer and wholesaler established in 2012, with two Scarborough locations open to the public for both retail and wholesale customers.',
    services: [S.CEP],
    certifications: [], rb: '54',
  },
];

// --- Existing companies whose service tags need a truthful correction ---------
// Nella, Chefco and Igloo were tagged "Price Match" but none publish such a
// policy (verified June 2026). Remove the unsupported tag.
const SERVICE_FIXES = [
  { slug: 'nella-cutlery', services: [S.CEP, S.EC] },
  { slug: 'chefco', services: [S.CEP] },
  { slug: 'igloo-food-equipment', services: [S.CEP] },
];

// --- Self-hosted logos (public/logos/<file>) -------------------------------
// Real brand logos fetched from each company's site (apple-touch-icon / icon /
// og:image) or icon service, reviewed by hand. 8 companies have no usable logo
// and intentionally keep the letter-placeholder (bakemax, gbs-foodservice,
// mp-hvac, ofr-concepts, ifoodequipment, avondale-commercial-solutions,
// canadian-restaurant-supply, toronto-restaurant-consultants).
const LOGO_FILES = {
  'a1-cash-and-carry': 'a1-cash-and-carry.png',
  'adl-fournisseur-commercial': 'adl-fournisseur-commercial.png',
  'apex-electric-mechanical': 'apex-electric-mechanical.png',
  'babak-food-equipment': 'babak-food-equipment.png',
  'bouthillette-parizeau': 'bouthillette-parizeau.png',
  'brama': 'brama.png',
  'browne-foodservice': 'browne-foodservice.png',
  'celco': 'celco.png',
  'commercial-kitchen-build': 'commercial-kitchen-build.png',
  'continental-restaurant-equipment': 'continental-restaurant-equipment.png',
  'doyon-despres': 'doyon-despres.png',
  'econolease': 'econolease.png',
  'enterprise-restaurant-consulting': 'enterprise-restaurant-consulting.png',
  'fincap-financial-group': 'fincap-financial-group.png',
  'foundry-kitchens': 'foundry-kitchens.png',
  'franchise-360': 'franchise-360.png',
  'fried-sage-hospitality': 'fried-sage-hospitality.png',
  'fsstrategy': 'fsstrategy.png',
  'hesco-foodservice': 'hesco-foodservice.png',
  'hubert-canada': 'hubert-canada.png',
  'jfs-restaurant-equipment': 'jfs-restaurant-equipment.png',
  'kaf-bar-supplies': 'kaf-bar-supplies.png',
  'kaizen-foodservice': 'kaizen-foodservice.png',
  'kitchen-treasure': 'kitchen-treasure.png',
  'krg-hospitality': 'krg-hospitality.png',
  'mb-food-equipment': 'mb-food-equipment.png',
  'mck-equipment': 'mck-equipment.png',
  'mehmi-financial-group': 'mehmi-financial-group.png',
  'newcap-leasing': 'newcap-leasing.svg',
  'ontario-restaurant-supply': 'ontario-restaurant-supply.png',
  'paragon-food-equipment': 'paragon-food-equipment.png',
  'proxpedite': 'proxpedite.png',
  'tfi-food-equipment': 'tfi-food-equipment.png',
  'the-cooks-mate': 'the-cooks-mate.png',
  'united-trimen': 'united-trimen.png',
  'zanduco': 'zanduco.png',
  // second pass: header-scraped logos
  'bakemax': 'bakemax.png',
  'gbs-foodservice': 'gbs-foodservice.png',
  'avondale-commercial-solutions': 'avondale-commercial-solutions.png',
  'mp-hvac': 'mp-hvac.png',
  'canadian-restaurant-supply': 'canadian-restaurant-supply.png',
};

// --- SQL helpers --------------------------------------------------------------
function sqlStr(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}
function sqlTextArray(arr) {
  if (!arr || arr.length === 0) return `'{}'::text[]`;
  const items = arr.map((s) => `'${String(s).replace(/'/g, "''")}'`).join(', ');
  return `ARRAY[${items}]::text[]`;
}
function sqlJsonb(obj) {
  return `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`;
}
function faqFor(c) {
  const loc = c.street ? `${c.street}, ${c.city}, ${c.province}` : `${c.city}, ${c.province}`;
  const svc = c.services.join(', ');
  return [
    { question: `Where is ${c.name} located?`, answer: `${c.name} is based in ${loc}, Canada.` },
    { question: `What services does ${c.name} offer for commercial kitchens?`, answer: `${c.name} offers ${svc}.` },
  ];
}

// --- Emit SQL -----------------------------------------------------------------
const out = [];
out.push('-- ten_companies_per_service.sql');
out.push('-- Generated by scripts/build-companies-seed.cjs');
out.push('-- Adds verified real Canadian (Ontario-preferred) commercial kitchen');
out.push('-- equipment companies so every /services/[slug] category lists >=10');
out.push('-- suppliers (Price Match kept truthful at 7). All ranking composites are');
out.push('-- below Shop at Stop (9.4); S.T.O.P remains the #1 listing.');
out.push('');
out.push('begin;');
out.push('');
out.push('-- Silence the per-row deploy-hook during the bulk load; the merge/deploy');
out.push('-- to main rebuilds the SSG site once from the new data.');
out.push('alter table public.companies disable trigger trg_company_changed;');
out.push('');
out.push('-- Truthful correction: remove unsupported Price Match tags.');
for (const f of SERVICE_FIXES) {
  out.push(`update public.companies set services = ${sqlTextArray(f.services)} where slug = ${sqlStr(f.slug)};`);
}
out.push('');

for (const c of COMPANIES) {
  const rb = RB[c.rb];
  if (!rb) throw new Error(`Unknown ranking profile ${c.rb} for ${c.name}`);
  const address = { street: c.street || null, city: c.city, province: c.province, postal_code: c.postal || null };
  out.push(`-- ${c.name}`);
  out.push(`insert into public.companies (name, slug, description, website_url, phone, email, address, services, certifications, partners, is_featured, ranking_breakdown)`);
  out.push(`values (`);
  out.push(`  ${sqlStr(c.name)}, ${sqlStr(c.slug)}, ${sqlStr(c.description)},`);
  out.push(`  ${sqlStr(c.website)}, ${sqlStr(c.phone)}, ${sqlStr(c.email)},`);
  out.push(`  ${sqlJsonb(address)},`);
  out.push(`  ${sqlTextArray(c.services)},`);
  out.push(`  ${sqlTextArray(c.certifications)},`);
  out.push(`  '[]'::jsonb, false, ${sqlJsonb(rb)}`);
  out.push(`)`);
  out.push(`on conflict (slug) do update set`);
  out.push(`  name = excluded.name, description = excluded.description, website_url = excluded.website_url,`);
  out.push(`  phone = excluded.phone, email = excluded.email, address = excluded.address,`);
  out.push(`  services = excluded.services, certifications = excluded.certifications,`);
  out.push(`  ranking_breakdown = excluded.ranking_breakdown;`);
  out.push('');
}

// Factual FAQ per new company, derived in-DB from verified name/address/services
// (keeps the seed file compact and the answers truthful by construction).
const newSlugs = COMPANIES.map((c) => `'${c.slug}'`).join(', ');
out.push('-- Two factual FAQs per company, built from verified data.');
out.push('update public.companies set faq = jsonb_build_array(');
out.push("  jsonb_build_object('question', 'Where is ' || name || ' located?',");
out.push("    'answer', name || ' is based in ' || coalesce((address->>'street') || ', ', '') || (address->>'city') || ', ' || (address->>'province') || ', Canada.'),");
out.push("  jsonb_build_object('question', 'What services does ' || name || ' offer for commercial kitchens?',");
out.push("    'answer', name || ' offers ' || array_to_string(services, ', ') || '.')");
out.push(`) where slug in (${newSlugs});`);
out.push('');

// Self-hosted logos (files committed under public/logos/).
out.push('-- Self-hosted brand logos (files live under public/logos/).');
for (const c of COMPANIES) {
  const file = LOGO_FILES[c.slug];
  if (file) out.push(`update public.companies set logo_url = '/logos/${file}' where slug = ${sqlStr(c.slug)};`);
}
out.push('');
out.push('alter table public.companies enable trigger trg_company_changed;');
out.push('');
out.push('commit;');
out.push('');

const sql = out.join('\n');
const dest = path.join(__dirname, '..', 'supabase', 'seed', 'ten_companies_per_service.sql');
fs.writeFileSync(dest, sql, 'utf8');
console.error(`Wrote ${dest} (${COMPANIES.length} new companies, ${SERVICE_FIXES.length} corrections)`);
