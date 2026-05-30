-- Condensed homepage card blurbs (~3-4 lines each) for the "Browse by service"
-- grid on /. The full long-form `description` is unchanged and remains the body
-- copy on /services/[slug]. Run after migration 012_service_card_blurb.sql.
-- No fabricated stats; no em-dashes (matches the category-content style).

update service_categories set card_blurb = $kd$A dedicated rep who knows your equipment history, ordering patterns, and budgets, so quotes move faster and repeat orders stay coordinated across multiple locations.$kd$ where slug = $kd$account-management$kd$;

update service_categories set card_blurb = $kd$Sourcing, quoting, and supplying the core gear a kitchen runs on, from ranges and refrigeration to prep stations and smallwares. Offered by every supplier here.$kd$ where slug = $kd$commercial-equipment-procurement$kd$;

update service_categories set card_blurb = $kd$Turns your menu and space into a workable layout with equipment placement, workflow paths, and the dimensioned plans contractors and inspectors need.$kd$ where slug = $kd$design-and-technical-drawings$kd$;

update service_categories set card_blurb = $kd$Helps you decide what to buy and why, matching equipment to your menu, volume, staffing, and budget instead of guessing.$kd$ where slug = $kd$equipment-consulting$kd$;

update service_categories set card_blurb = $kd$Acquire commercial kitchen gear without paying the full cost upfront, spreading payments over time to preserve working capital for inventory, staffing, and opening costs.$kd$ where slug = $kd$equipment-financing$kd$;

update service_categories set card_blurb = $kd$Pay for the use of commercial gear over a set term, often with lower upfront cost and end-of-term options to consider.$kd$ where slug = $kd$equipment-leasing$kd$;

update service_categories set card_blurb = $kd$Professional setup of commercial kitchen equipment, including positioning, leveling, and the connections and clearances each unit needs to run safely.$kd$ where slug = $kd$installation-services$kd$;

update service_categories set card_blurb = $kd$Confirm you are getting competitive pricing by having a supplier meet a qualifying competitor quote, taking some guesswork out of shopping multiple vendors.$kd$ where slug = $kd$price-match$kd$;

update service_categories set card_blurb = $kd$A wider view than any single equipment decision, looking at how concept, kitchen workflow, and daily service fit together.$kd$ where slug = $kd$restaurant-consulting$kd$;
