-- Replace placeholder Shop at Stop brand partners (Vitamix/Hobart/Robot Coupe with
-- broken Clearbit logos) with the 12 brands actually displayed on shopatstop.com's
-- "Explore the brands you love" section. Logos are now served locally from
-- /partners/<slug>.png to remove the third-party logo API dependency.

update companies
set partners = '[
  {
    "name": "Staub",
    "logo_url": "/partners/staub.png",
    "url": "https://www.zwilling.com/ca/staub/"
  },
  {
    "name": "Zwilling J.A. Henckels",
    "logo_url": "/partners/zwilling.png",
    "url": "https://www.zwilling.com/ca/zwilling/"
  },
  {
    "name": "Cuisinart",
    "logo_url": "/partners/cuisinart.png",
    "url": "https://www.cuisinart.ca/"
  },
  {
    "name": "Wüsthof",
    "logo_url": "/partners/wusthof.png",
    "url": "https://www.wusthof.com/"
  },
  {
    "name": "KitchenAid",
    "logo_url": "/partners/kitchenaid.png",
    "url": "https://www.kitchenaid.ca/"
  },
  {
    "name": "Mercer Culinary",
    "logo_url": "/partners/mercer.png",
    "url": "https://www.mercerculinary.com/"
  },
  {
    "name": "Danesco",
    "logo_url": "/partners/danesco.png",
    "url": "https://www.danesco.com/"
  },
  {
    "name": "Miyabi",
    "logo_url": "/partners/miyabi.png",
    "url": "https://www.zwilling.com/ca/miyabi/"
  },
  {
    "name": "True Residential",
    "logo_url": "/partners/true-residential.jpg",
    "url": "https://true-residential.com/"
  },
  {
    "name": "Meyer",
    "logo_url": "/partners/meyer.png",
    "url": "https://www.meyercanada.ca/"
  },
  {
    "name": "Churchill",
    "logo_url": "/partners/churchill.png",
    "url": "https://www.churchill1795.com/"
  },
  {
    "name": "Browne Foodservice",
    "logo_url": "/partners/browne.png",
    "url": "https://browneco.com/"
  }
]'::jsonb
where slug = 'shop-at-stop';
