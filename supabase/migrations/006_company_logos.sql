-- Set logo_url for each seeded company. Logos sourced from each company's
-- public website (favicon/webclip or header logo) and served locally from
-- /logos/<slug>.<ext> to avoid third-party CDN dependencies.

update companies set logo_url = '/logos/shop-at-stop.svg'           where slug = 'shop-at-stop';
update companies set logo_url = '/logos/russell-hendrix.png'        where slug = 'russell-hendrix';
update companies set logo_url = '/logos/nella-cutlery.jpg'          where slug = 'nella-cutlery';
update companies set logo_url = '/logos/chefco.png'                 where slug = 'chefco';
update companies set logo_url = '/logos/canada-food-equipment.png'  where slug = 'canada-food-equipment';
update companies set logo_url = '/logos/wd-colledge.png'            where slug = 'wd-colledge';
update companies set logo_url = '/logos/igloo-food-equipment.png'   where slug = 'igloo-food-equipment';
