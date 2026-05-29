import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const gifts = [
  // Wellness
  {
    name: "Botanical Spa Set",
    description: "A luxurious collection of organic bath salts, essential oils, and a soy wax candle for the ultimate relaxation.",
    image_url: "https://images.unsplash.com/photo-1603006905593-9c87eb5b253b?w=800&auto=format&fit=crop&q=60",
    price_min: 45, price_max: 75,
    tags: ["wellness"],
    occasions: ["birthday", "anniversary", "just because"],
    recipients: ["partner", "parent", "friend"],
    affiliate_url: "https://kindlybox.com/go/botanical-spa-set", affiliate_network: "amazon"
  },
  {
    name: "Acupressure Mat and Pillow Set",
    description: "Relieve stress, tension, and muscle aches with this eco-friendly acupressure mat and neck pillow.",
    image_url: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&auto=format&fit=crop&q=60",
    price_min: 30, price_max: 50,
    tags: ["wellness", "sport"],
    occasions: ["birthday", "christmas", "just because"],
    recipients: ["partner", "friend", "parent", "sibling"],
    affiliate_url: "https://kindlybox.com/go/acupressure-mat-set", affiliate_network: "amazon"
  },
  {
    name: "Essential Oil Diffuser",
    description: "Elegant ceramic ultrasonic aromatherapy diffuser with ambient lighting settings.",
    image_url: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&auto=format&fit=crop&q=60",
    price_min: 40, price_max: 70,
    tags: ["wellness", "home"],
    occasions: ["housewarming", "birthday", "christmas"],
    recipients: ["friend", "colleague", "parent", "sibling"],
    affiliate_url: "https://kindlybox.com/go/ceramic-oil-diffuser", affiliate_network: "amazon"
  },
  // Books & Learning
  {
    name: "Personalised Leather Journal",
    description: "A beautifully crafted, refillable full-grain leather notebook with custom engraving.",
    image_url: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&auto=format&fit=crop&q=60",
    price_min: 30, price_max: 50,
    tags: ["books", "fashion"],
    occasions: ["birthday", "graduation", "anniversary", "christmas"],
    recipients: ["friend", "colleague", "partner", "sibling"],
    affiliate_url: "https://kindlybox.com/go/leather-journal", affiliate_network: "etsy"
  },
  {
    name: "MasterClass Annual Subscription",
    description: "Give the gift of learning with unlimited access to classes taught by the world's best.",
    image_url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=60",
    price_min: 120, price_max: 180,
    tags: ["books", "wellness"],
    occasions: ["graduation", "birthday", "christmas"],
    recipients: ["parent", "friend", "partner", "colleague"],
    affiliate_url: "https://kindlybox.com/go/masterclass-sub", affiliate_network: "other"
  },
  {
    name: "Kindle Paperwhite E-Reader",
    description: "The ultimate reading device with a glare-free display, adjustable warm light, and waterproof design.",
    image_url: "https://images.unsplash.com/photo-1592661005391-f9f30b912e52?w=800&auto=format&fit=crop&q=60",
    price_min: 130, price_max: 160,
    tags: ["books", "tech", "travel"],
    occasions: ["birthday", "graduation", "christmas", "anniversary"],
    recipients: ["partner", "parent", "child", "friend", "sibling"],
    affiliate_url: "https://kindlybox.com/go/kindle-paperwhite", affiliate_network: "amazon"
  },
  // Food & Cooking
  {
    name: "Artisan Coffee Subscription",
    description: "A monthly delivery of freshly roasted, ethically sourced coffee beans from around the world.",
    image_url: "https://images.unsplash.com/photo-1559525839-b184a4d698c7?w=800&auto=format&fit=crop&q=60",
    price_min: 25, price_max: 60,
    tags: ["food"],
    occasions: ["birthday", "christmas", "just because"],
    recipients: ["partner", "parent", "colleague", "friend"],
    affiliate_url: "https://kindlybox.com/go/artisan-coffee-sub", affiliate_network: "awin"
  },
  {
    name: "Gourmet Pasta Making Kit",
    description: "Everything needed to make authentic Italian pasta at home, including imported flour and specialized tools.",
    image_url: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=800&auto=format&fit=crop&q=60",
    price_min: 50, price_max: 85,
    tags: ["food", "home"],
    occasions: ["wedding", "housewarming", "anniversary", "birthday"],
    recipients: ["partner", "parent", "friend", "sibling"],
    affiliate_url: "https://kindlybox.com/go/pasta-making-kit", affiliate_network: "other"
  },
  {
    name: "Japanese Santoku Chef Knife",
    description: "Premium high-carbon steel chef knife for precision slicing and dicing.",
    image_url: "https://images.unsplash.com/photo-1593618998160-e34014e67546?w=800&auto=format&fit=crop&q=60",
    price_min: 80, price_max: 150,
    tags: ["food", "home"],
    occasions: ["wedding", "housewarming", "birthday"],
    recipients: ["partner", "parent", "friend", "sibling"],
    affiliate_url: "https://kindlybox.com/go/santoku-knife", affiliate_network: "amazon"
  },
  {
    name: "Luxury Chocolate Tasting Box",
    description: "Decadent selection of single-origin truffles and dark chocolate bars.",
    image_url: "https://images.unsplash.com/photo-1548483863-122e2ce2d744?w=800&auto=format&fit=crop&q=60",
    price_min: 30, price_max: 55,
    tags: ["food"],
    occasions: ["birthday", "anniversary", "christmas", "just because"],
    recipients: ["partner", "parent", "friend", "colleague"],
    affiliate_url: "https://kindlybox.com/go/chocolate-tasting-box", affiliate_network: "other"
  },
  // Travel & Adventure
  {
    name: "Scratch-Off World Map Poster",
    description: "A gorgeous gold foil scratch map to beautifully track and display global travel adventures.",
    image_url: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800&auto=format&fit=crop&q=60",
    price_min: 20, price_max: 35,
    tags: ["travel", "home"],
    occasions: ["birthday", "graduation", "housewarming"],
    recipients: ["friend", "partner", "sibling", "child"],
    affiliate_url: "https://kindlybox.com/go/scratch-world-map", affiliate_network: "amazon"
  },
  {
    name: "Carry-On Hardside Spinner Suitcase",
    description: "Durable, lightweight polycarbonate luggage with 360-degree wheels and a built-in battery for charging devices.",
    image_url: "https://images.unsplash.com/photo-1553531384-cc64ac80f931?w=800&auto=format&fit=crop&q=60",
    price_min: 150, price_max: 250,
    tags: ["travel", "tech"],
    occasions: ["graduation", "wedding", "birthday", "christmas"],
    recipients: ["partner", "child", "sibling", "parent"],
    affiliate_url: "https://kindlybox.com/go/spinner-suitcase", affiliate_network: "amazon"
  },
  {
    name: "Compact Travel DSLR Camera",
    description: "Capture memories in stunning 4K resolution with this pocket-sized point-and-shoot powerhouse.",
    image_url: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&auto=format&fit=crop&q=60",
    price_min: 400, price_max: 700,
    tags: ["travel", "tech"],
    occasions: ["graduation", "anniversary", "christmas"],
    recipients: ["partner", "child", "parent", "sibling"],
    affiliate_url: "https://kindlybox.com/go/travel-camera", affiliate_network: "amazon"
  },
  // Tech & Gadgets
  {
    name: "Wireless Noise-Cancelling Headphones",
    description: "Industry-leading noise cancellation combined with crystal-clear audio and plush over-ear comfort.",
    image_url: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=800&auto=format&fit=crop&q=60",
    price_min: 150, price_max: 350,
    tags: ["tech", "wellness"],
    occasions: ["birthday", "christmas", "graduation"],
    recipients: ["partner", "child", "sibling", "parent"],
    affiliate_url: "https://kindlybox.com/go/noise-cancelling-headphones", affiliate_network: "amazon"
  },
  {
    name: "Smart Sleep Assistant and Wake-Up Light",
    description: "A bedside device that simulates natural sunlight to wake you up gently and provides soothing sounds for sleep.",
    image_url: "https://images.unsplash.com/photo-1565514020179-0c6d05ac11be?w=800&auto=format&fit=crop&q=60",
    price_min: 100, price_max: 180,
    tags: ["tech", "wellness", "home"],
    occasions: ["birthday", "christmas", "housewarming"],
    recipients: ["partner", "parent", "friend", "sibling"],
    affiliate_url: "https://kindlybox.com/go/smart-sleep-light", affiliate_network: "amazon"
  },
  {
    name: "Portable Bluetooth Speaker",
    description: "Waterproof, rugged, and sounds incredible—perfect for the beach, park, or patio.",
    image_url: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&auto=format&fit=crop&q=60",
    price_min: 80, price_max: 130,
    tags: ["tech", "travel", "sport"],
    occasions: ["birthday", "graduation", "christmas", "just because"],
    recipients: ["friend", "child", "sibling", "colleague"],
    affiliate_url: "https://kindlybox.com/go/portable-speaker", affiliate_network: "amazon"
  },
  // Fashion & Style
  {
    name: "Cashmere Scarf",
    description: "Extremely soft, ethically sourced 100% cashmere scarf for cozy winter elegance.",
    image_url: "https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=800&auto=format&fit=crop&q=60",
    price_min: 60, price_max: 120,
    tags: ["fashion"],
    occasions: ["birthday", "christmas", "anniversary", "just because"],
    recipients: ["partner", "parent", "friend", "sibling"],
    affiliate_url: "https://kindlybox.com/go/cashmere-scarf", affiliate_network: "amazon"
  },
  {
    name: "Minimalist Leather Cardholder",
    description: "A slim, elegant wallet designed to hold essential cards without the bulk. Made from full-grain leather.",
    image_url: "https://images.unsplash.com/photo-1627889117628-98f5ac868dcd?w=800&auto=format&fit=crop&q=60",
    price_min: 35, price_max: 65,
    tags: ["fashion", "travel"],
    occasions: ["birthday", "graduation", "christmas", "anniversary"],
    recipients: ["partner", "friend", "colleague", "sibling", "parent"],
    affiliate_url: "https://kindlybox.com/go/leather-cardholder", affiliate_network: "etsy"
  },
  {
    name: "Sleek Stainless Steel Watch",
    description: "A timeless, understated watch perfect for everyday wear or dressing up.",
    image_url: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&auto=format&fit=crop&q=60",
    price_min: 150, price_max: 300,
    tags: ["fashion"],
    occasions: ["graduation", "anniversary", "birthday", "wedding"],
    recipients: ["partner", "parent", "sibling", "child"],
    affiliate_url: "https://kindlybox.com/go/stainless-watch", affiliate_network: "awin"
  },
  {
    name: "Gold Initial Pendant Necklace",
    description: "A delicate 14k gold-filled necklace featuring a beautifully crafted initial.",
    image_url: "https://images.unsplash.com/photo-1599643478524-fb5244098775?w=800&auto=format&fit=crop&q=60",
    price_min: 40, price_max: 90,
    tags: ["fashion"],
    occasions: ["birthday", "anniversary", "new baby", "graduation"],
    recipients: ["partner", "friend", "child", "sibling"],
    affiliate_url: "https://kindlybox.com/go/initial-necklace", affiliate_network: "etsy"
  },
  // Home & Decor
  {
    name: "Luxury Scented Candle Trio",
    description: "A set of three hand-poured soy candles in premium fragrances like Sandalwood and Fig.",
    image_url: "https://images.unsplash.com/photo-1603006905593-9c87eb5b253b?w=800&auto=format&fit=crop&q=60",
    price_min: 35, price_max: 65,
    tags: ["home", "wellness"],
    occasions: ["birthday", "housewarming", "christmas", "just because"],
    recipients: ["partner", "parent", "friend", "colleague", "sibling"],
    affiliate_url: "https://kindlybox.com/go/luxury-candle-trio", affiliate_network: "amazon"
  },
  {
    name: "Indoor Smart Herb Garden",
    description: "Grow fresh herbs year-round with an automated water and LED light system. Fits on any kitchen counter.",
    image_url: "https://images.unsplash.com/photo-1585324508499-dc08b9821bb4?w=800&auto=format&fit=crop&q=60",
    price_min: 90, price_max: 140,
    tags: ["home", "food", "tech"],
    occasions: ["housewarming", "birthday", "christmas", "wedding"],
    recipients: ["parent", "partner", "friend", "sibling"],
    affiliate_url: "https://kindlybox.com/go/smart-herb-garden", affiliate_network: "amazon"
  },
  {
    name: "Chunky Knit Weighted Blanket",
    description: "A beautiful, breathable woven blanket designed to reduce stress and improve sleep.",
    image_url: "https://images.unsplash.com/photo-1584984180419-79f829fba3be?w=800&auto=format&fit=crop&q=60",
    price_min: 150, price_max: 250,
    tags: ["home", "wellness"],
    occasions: ["birthday", "anniversary", "christmas", "wedding"],
    recipients: ["partner", "parent", "friend", "child"],
    affiliate_url: "https://kindlybox.com/go/weighted-blanket", affiliate_network: "amazon"
  },
  {
    name: "Custom Star Map Print",
    description: "A personalized poster showing the exact night sky alignment on a specific date and location.",
    image_url: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=800&auto=format&fit=crop&q=60",
    price_min: 40, price_max: 75,
    tags: ["home"],
    occasions: ["anniversary", "wedding", "new baby", "birthday"],
    recipients: ["partner", "friend", "parent"],
    affiliate_url: "https://kindlybox.com/go/star-map-print", affiliate_network: "etsy"
  },
  // Sport & Fitness
  {
    name: "Smart Fitness Watch",
    description: "Track steps, heart rate, sleep, and workouts with this sleek, waterproof fitness tracker.",
    image_url: "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800&auto=format&fit=crop&q=60",
    price_min: 150, price_max: 250,
    tags: ["sport", "tech", "wellness"],
    occasions: ["birthday", "graduation", "christmas", "anniversary"],
    recipients: ["partner", "child", "friend", "sibling", "parent"],
    affiliate_url: "https://kindlybox.com/go/fitness-watch", affiliate_network: "amazon"
  },
  {
    name: "Premium Yoga Mat",
    description: "Extra-thick, eco-friendly, non-slip yoga mat with alignment markers.",
    image_url: "https://images.unsplash.com/photo-1599447421415-4ba2b6e15d86?w=800&auto=format&fit=crop&q=60",
    price_min: 60, price_max: 120,
    tags: ["sport", "wellness"],
    occasions: ["birthday", "new baby", "christmas", "just because"],
    recipients: ["partner", "friend", "sibling", "colleague"],
    affiliate_url: "https://kindlybox.com/go/premium-yoga-mat", affiliate_network: "amazon"
  },
  {
    name: "Adjustable Dumbbell Set",
    description: "Space-saving weights that adjust from 5 to 50 lbs with the turn of a dial.",
    image_url: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&auto=format&fit=crop&q=60",
    price_min: 200, price_max: 400,
    tags: ["sport"],
    occasions: ["birthday", "christmas", "graduation"],
    recipients: ["partner", "friend", "sibling", "child"],
    affiliate_url: "https://kindlybox.com/go/adjustable-dumbbells", affiliate_network: "amazon"
  },
  {
    name: "Deep Tissue Massage Gun",
    description: "A powerful percussive therapy device to accelerate recovery and soothe muscle tension.",
    image_url: "https://images.unsplash.com/photo-1620061325129-ec4ce80bfafc?w=800&auto=format&fit=crop&q=60",
    price_min: 100, price_max: 200,
    tags: ["sport", "wellness", "tech"],
    occasions: ["birthday", "anniversary", "christmas"],
    recipients: ["partner", "parent", "friend", "sibling", "colleague"],
    affiliate_url: "https://kindlybox.com/go/massage-gun", affiliate_network: "other"
  },
  // Miscellaneous / Babies / Novelty
  {
    name: "Personalised Baby Keepsake Box",
    description: "A beautiful wooden box finely engraved with the baby's name, perfect for storing first memories.",
    image_url: "https://images.unsplash.com/photo-1519689680058-324335c77eba?w=800&auto=format&fit=crop&q=60",
    price_min: 40, price_max: 75,
    tags: ["home"],
    occasions: ["new baby", "birthday", "just because"],
    recipients: ["friend", "sibling", "child", "colleague"],
    affiliate_url: "https://kindlybox.com/go/baby-keepsake-box", affiliate_network: "etsy"
  },
  {
    name: "Monogrammed Silk Pillowcase",
    description: "Pure mulberry silk pillowcase for better skin and hair, complete with custom monogram embroidery.",
    image_url: "https://images.unsplash.com/photo-1584100936595-c0654b355040?w=800&auto=format&fit=crop&q=60",
    price_min: 50, price_max: 90,
    tags: ["home", "wellness", "fashion"],
    occasions: ["birthday", "anniversary", "wedding", "just because"],
    recipients: ["partner", "parent", "friend", "sibling"],
    affiliate_url: "https://kindlybox.com/go/silk-pillowcase", affiliate_network: "amazon"
  }
];

async function seed() {
  console.log("Starting database seeding...");
  
  const { data, error } = await supabase.from('gifts').insert(gifts).select();
  
  if (error) {
    console.error("Error inserting gifts:", error);
    process.exit(1);
  }
  
  console.log(`Successfully seeded ${data.length} gifts into the database!`);
  process.exit(0);
}

seed();
