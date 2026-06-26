// =============================================================================
// seed-gifts.js  — THE ONLY GIFT CATALOGUE SEED FILE
// =============================================================================
//
// ⚠️  ALL new gift entries MUST be added here, in the `gifts` array below.
//     There is no other seed file. (scripts/seed-gifts.js was an old prototype
//     and has been deleted to avoid confusion.)
//
// HOW TO ADD A GIFT
// -----------------
//  1. Add a new object to the `gifts` array below.
//  2. Use ONLY the exact tag/occasion/recipient strings listed in the vocabulary
//     reference below — any mismatch silently breaks recommendation scoring.
//  3. Run:  node seed-gifts.js
//     This clears the gifts table and reloads it from this file.
//
// QUIZ VOCABULARY REFERENCE  (must match src/components/quiz/QuizFlow.tsx)
// -------------------------------------------------------------------------
//   occasions:   birthday, anniversary, graduation, baby shower, wedding,
//                valentine's day, promotion/retirement, house warming,
//                mother's day, father's day
//
//   recipients:  him, her, parent, child, sibling, co-worker, teacher/mentor,
//                friend
//
//   tags (interests):
//                tech & gadgets, fashion & accessories, books & reading,
//                home & kitchen, fitness & wellness, outdoor/ adventure,
//                art & crafts, music & instruments, gaming, gardening,
//                movies & tv, travel, pets, home decor
//
// =============================================================================

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
  // ── Wellness & home (1-3) ─────────────────────────────────────────────────
  {
    name: "Botanical Spa Set",
    description: "A luxurious collection of organic bath salts, essential oils, and a soy wax candle for the ultimate relaxation.",
    image_url: "https://images.unsplash.com/photo-1603006905593-9c87eb5b253b?w=800&auto=format&fit=crop&q=60",
    price_min: 45, price_max: 75,
    tags: ["fitness & wellness", "home decor"],
    occasions: ["birthday", "anniversary", "mother's day", "valentine's day"],
    recipients: ["her", "parent", "friend", "sibling", "teacher/mentor"],
    affiliate_url: "/go/botanical-spa-set", slug: "botanical-spa-set", destination_url: null, affiliate_network: "amazon"
  },
  {
    name: "Acupressure Mat and Pillow Set",
    description: "Relieve stress, tension, and muscle aches with this eco-friendly acupressure mat and neck pillow.",
    image_url: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&auto=format&fit=crop&q=60",
    price_min: 30, price_max: 50,
    tags: ["fitness & wellness"],
    occasions: ["birthday", "father's day", "mother's day"],
    recipients: ["him", "her", "parent", "friend", "sibling"],
    affiliate_url: "/go/acupressure-mat-set", slug: "acupressure-mat-set", destination_url: null, affiliate_network: "amazon"
  },
  {
    name: "Essential Oil Diffuser",
    description: "Elegant ceramic ultrasonic aromatherapy diffuser with ambient lighting settings.",
    image_url: "https://images.unsplash.com/photo-1592661005391-f9f30b912e52?w=800&auto=format&fit=crop&q=60",
    price_min: 35, price_max: 55,
    tags: ["fitness & wellness", "home decor"],
    occasions: ["birthday", "house warming", "mother's day"],
    recipients: ["her", "parent", "friend", "sibling", "co-worker", "teacher/mentor"],
    affiliate_url: "/go/essential-oil-diffuser", slug: "essential-oil-diffuser", destination_url: null, affiliate_network: "amazon"
  },

  // ── Books & learning (4-6) ────────────────────────────────────────────────
  {
    name: "Personalised Leather Journal",
    description: "Hand-bound, full-grain leather journal with custom monogram. Perfect for daily reflection or sketching.",
    image_url: "https://images.unsplash.com/photo-1531468948596-67fbbbe2c4d3?w=800&auto=format&fit=crop&q=60",
    price_min: 30, price_max: 50,
    tags: ["books & reading", "art & crafts"],
    occasions: ["birthday", "graduation", "promotion/retirement"],
    recipients: ["him", "her", "friend", "co-worker", "teacher/mentor", "sibling"],
    affiliate_url: "/go/leather-journal", slug: "leather-journal", destination_url: null, affiliate_network: "amazon"
  },
  {
    name: "MasterClass Annual Subscription",
    description: "Unlimited access to 200+ online classes taught by world-renowned experts. The gift of a lifetime of learning.",
    image_url: "https://images.unsplash.com/photo-1483213097419-365e22f0f258?w=800&auto=format&fit=crop&q=60",
    price_min: 180, price_max: 200,
    tags: ["books & reading", "movies & tv"],
    occasions: ["birthday", "graduation", "promotion/retirement", "father's day", "mother's day"],
    recipients: ["him", "her", "parent", "friend", "co-worker"],
    affiliate_url: "/go/masterclass-subscription", slug: "masterclass-subscription", destination_url: null, affiliate_network: "awin"
  },
  {
    name: "Kindle Paperwhite E-Reader",
    description: "Waterproof, glare-free 6.8\" display, with weeks of battery life. The ultimate reading companion.",
    image_url: "https://images.unsplash.com/photo-1592434134753-a70baf7979d5?w=800&auto=format&fit=crop&q=60",
    price_min: 120, price_max: 160,
    tags: ["books & reading", "tech & gadgets"],
    occasions: ["birthday", "graduation", "mother's day", "father's day"],
    recipients: ["him", "her", "parent", "friend", "sibling"],
    affiliate_url: "/go/kindle-paperwhite", slug: "kindle-paperwhite", destination_url: "https://www.amazon.com/dp/B0CFPJYX9X", affiliate_network: "amazon"
  },

  // ── Food & cooking (7-10) ─────────────────────────────────────────────────
  {
    name: "Artisan Coffee Subscription",
    description: "Three months of freshly roasted, single-origin coffee beans from independent roasters around the world.",
    image_url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&auto=format&fit=crop&q=60",
    price_min: 25, price_max: 60,
    tags: ["home & kitchen"],
    occasions: ["birthday", "father's day", "mother's day", "house warming", "promotion/retirement"],
    recipients: ["him", "her", "parent", "friend", "co-worker", "teacher/mentor"],
    affiliate_url: "/go/coffee-subscription", slug: "coffee-subscription", destination_url: null, affiliate_network: "awin"
  },
  {
    name: "Gourmet Pasta Making Kit",
    description: "Complete kit with semolina flour, antique-style wooden roller, and recipe book to make fresh pasta from scratch.",
    image_url: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop&q=60",
    price_min: 45, price_max: 70,
    tags: ["home & kitchen"],
    occasions: ["wedding", "house warming", "anniversary", "valentine's day"],
    recipients: ["her", "him", "parent", "friend"],
    affiliate_url: "/go/pasta-making-kit", slug: "pasta-making-kit", destination_url: null, affiliate_network: "amazon"
  },
  {
    name: "Japanese Santoku Chef Knife",
    description: "Handcrafted high-carbon stainless steel knife with a comfortable Pakkawood handle. A kitchen heirloom.",
    image_url: "https://images.unsplash.com/photo-1593618998160-e34014e67546?w=800&auto=format&fit=crop&q=60",
    price_min: 80, price_max: 120,
    tags: ["home & kitchen"],
    occasions: ["wedding", "house warming", "father's day", "mother's day"],
    recipients: ["him", "her", "parent", "friend"],
    affiliate_url: "/go/santoku-knife", slug: "santoku-knife", destination_url: null, affiliate_network: "amazon"
  },
  {
    name: "Luxury Chocolate Tasting Box",
    description: "Hand-selected collection of single-origin chocolates from award-winning chocolatiers worldwide.",
    image_url: "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=800&auto=format&fit=crop&q=60",
    price_min: 30, price_max: 60,
    tags: ["home & kitchen"],
    occasions: ["birthday", "valentine's day", "mother's day", "father's day", "anniversary"],
    recipients: ["her", "him", "parent", "friend", "co-worker", "teacher/mentor"],
    affiliate_url: "/go/chocolate-box", slug: "chocolate-box", destination_url: null, affiliate_network: "amazon"
  },

  // ── Travel & adventure (11-13) ────────────────────────────────────────────
  {
    name: "Scratch-Off World Map Poster",
    description: "Premium scratch-off map with detailed country and city information. Track your adventures in style.",
    image_url: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&auto=format&fit=crop&q=60",
    price_min: 25, price_max: 45,
    tags: ["travel", "home decor"],
    occasions: ["birthday", "graduation", "wedding", "house warming"],
    recipients: ["him", "her", "friend", "sibling", "co-worker"],
    affiliate_url: "/go/scratch-off-map", slug: "scratch-off-map", destination_url: null, affiliate_network: "amazon"
  },
  {
    name: "Carry-On Hardside Spinner Suitcase",
    description: "Ultra-lightweight polycarbonate carry-on with 360° spinner wheels and TSA-approved lock.",
    image_url: "https://images.unsplash.com/photo-1473625247510-8ceb1760943f?w=800&auto=format&fit=crop&q=60",
    price_min: 120, price_max: 180,
    tags: ["travel"],
    occasions: ["birthday", "graduation", "promotion/retirement", "wedding"],
    recipients: ["him", "her", "parent", "sibling", "co-worker"],
    affiliate_url: "/go/spinner-suitcase", slug: "spinner-suitcase", destination_url: null, affiliate_network: "amazon"
  },
  {
    name: "Compact Travel DSLR Camera",
    description: "Mirrorless 24MP camera with built-in WiFi and 3-inch tilting screen. Lightweight enough for any trip.",
    image_url: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800&auto=format&fit=crop&q=60",
    price_min: 200, price_max: 200,
    tags: ["travel", "tech & gadgets"],
    occasions: ["birthday", "graduation", "promotion/retirement", "father's day"],
    recipients: ["him", "her", "parent", "sibling"],
    affiliate_url: "/go/dslr-camera", slug: "dslr-camera", destination_url: null, affiliate_network: "amazon"
  },

  // ── Tech & gadgets (14-16) ────────────────────────────────────────────────
  {
    name: "Wireless Noise-Cancelling Headphones",
    description: "Industry-leading noise cancellation with 30-hour battery life and crystal-clear audio quality.",
    image_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=60",
    price_min: 80, price_max: 150,
    tags: ["tech & gadgets", "music & instruments"],
    occasions: ["birthday", "graduation", "father's day"],
    recipients: ["him", "her", "child", "parent", "sibling"],
    affiliate_url: "/go/noise-cancelling-headphones", slug: "noise-cancelling-headphones", destination_url: "https://www.amazon.com/dp/B09XS7JWHH", affiliate_network: "amazon"
  },
  {
    name: "Smart Sleep Assistant and Wake-Up Light",
    description: "Sunrise simulation alarm clock with guided breathing exercises and personalised sleep insights.",
    image_url: "https://images.unsplash.com/photo-1530268729831-4b0b9e170218?w=800&auto=format&fit=crop&q=60",
    price_min: 100, price_max: 130,
    tags: ["tech & gadgets", "fitness & wellness"],
    occasions: ["birthday", "house warming", "father's day", "mother's day"],
    recipients: ["him", "her", "parent", "co-worker"],
    affiliate_url: "/go/sleep-assistant", slug: "sleep-assistant", destination_url: null, affiliate_network: "amazon"
  },
  {
    name: "Portable Bluetooth Speaker",
    description: "Waterproof, dustproof, and shockproof portable speaker with 20-hour battery life and 360° sound.",
    image_url: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&auto=format&fit=crop&q=60",
    price_min: 50, price_max: 100,
    tags: ["tech & gadgets", "music & instruments", "outdoor/ adventure"],
    occasions: ["birthday", "graduation", "father's day"],
    recipients: ["him", "her", "child", "sibling", "friend"],
    affiliate_url: "/go/bluetooth-speaker", slug: "bluetooth-speaker", destination_url: null, affiliate_network: "amazon"
  },

  // ── Fashion & accessories (17-20) ────────────────────────────────────────
  {
    name: "Cashmere Scarf",
    description: "Beautifully soft 100% cashmere scarf in classic neutral tones. Timeless elegance.",
    image_url: "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=800&auto=format&fit=crop&q=60",
    price_min: 80, price_max: 120,
    tags: ["fashion & accessories"],
    occasions: ["birthday", "anniversary", "mother's day", "valentine's day"],
    recipients: ["her", "parent", "friend", "teacher/mentor"],
    affiliate_url: "/go/cashmere-scarf", slug: "cashmere-scarf", destination_url: null, affiliate_network: "awin"
  },
  {
    name: "Minimalist Leather Cardholder",
    description: "Slim, RFID-blocking premium leather cardholder. Holds up to 8 cards while staying pocket-friendly.",
    image_url: "https://images.unsplash.com/photo-1601592996763-f05c9d8d6e7f?w=800&auto=format&fit=crop&q=60",
    price_min: 35, price_max: 60,
    tags: ["fashion & accessories"],
    occasions: ["birthday", "father's day", "graduation", "promotion/retirement"],
    recipients: ["him", "friend", "co-worker", "sibling"],
    affiliate_url: "/go/leather-cardholder", slug: "leather-cardholder", destination_url: null, affiliate_network: "amazon"
  },
  {
    name: "Sleek Stainless Steel Watch",
    description: "Sophisticated automatic movement watch with sapphire crystal and water resistance up to 50m.",
    image_url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=60",
    price_min: 130, price_max: 200,
    tags: ["fashion & accessories"],
    occasions: ["birthday", "graduation", "father's day", "promotion/retirement", "anniversary"],
    recipients: ["him", "parent", "co-worker", "sibling"],
    affiliate_url: "/go/steel-watch", slug: "steel-watch", destination_url: null, affiliate_network: "amazon"
  },
  {
    name: "Gold Initial Pendant Necklace",
    description: "Delicate 18k gold-plated necklace with personalised initial. Elegant for everyday or special occasions.",
    image_url: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&auto=format&fit=crop&q=60",
    price_min: 55, price_max: 95,
    tags: ["fashion & accessories"],
    occasions: ["birthday", "anniversary", "mother's day", "valentine's day", "wedding"],
    recipients: ["her", "parent", "friend", "sibling"],
    affiliate_url: "/go/initial-necklace", slug: "initial-necklace", destination_url: null, affiliate_network: "amazon"
  },

  // ── Home & decor (21-24) ──────────────────────────────────────────────────
  {
    name: "Luxury Scented Candle Trio",
    description: "Three hand-poured soy candles in calming, energising, and grounding fragrances. 45-hour burn time each.",
    image_url: "https://images.unsplash.com/photo-1602874801007-bd458bb1b8b6?w=800&auto=format&fit=crop&q=60",
    price_min: 35, price_max: 65,
    tags: ["home decor", "fitness & wellness"],
    occasions: ["birthday", "house warming", "mother's day", "anniversary"],
    recipients: ["her", "parent", "friend", "teacher/mentor", "co-worker"],
    affiliate_url: "/go/candle-trio", slug: "candle-trio", destination_url: null, affiliate_network: "amazon"
  },
  {
    name: "Indoor Smart Herb Garden",
    description: "Self-watering, LED-lit hydroponic garden that grows fresh herbs year-round. Perfect for kitchens.",
    image_url: "https://images.unsplash.com/photo-1525648199074-bee30ba3d02b?w=800&auto=format&fit=crop&q=60",
    price_min: 95, price_max: 130,
    tags: ["gardening", "home & kitchen", "home decor"],
    occasions: ["birthday", "house warming", "mother's day", "father's day"],
    recipients: ["her", "him", "parent", "friend"],
    affiliate_url: "/go/smart-herb-garden", slug: "smart-herb-garden", destination_url: null, affiliate_network: "amazon"
  },
  {
    name: "Chunky Knit Weighted Blanket",
    description: "Hand-knitted, breathable cotton chenille weighted blanket. Promotes deep, restful sleep.",
    image_url: "https://images.unsplash.com/photo-1592431913823-7af6b323da6e?w=800&auto=format&fit=crop&q=60",
    price_min: 80, price_max: 130,
    tags: ["home decor", "fitness & wellness"],
    occasions: ["birthday", "house warming", "mother's day", "father's day"],
    recipients: ["her", "him", "parent", "friend", "sibling"],
    affiliate_url: "/go/weighted-blanket", slug: "weighted-blanket", destination_url: null, affiliate_network: "amazon"
  },
  {
    name: "Custom Star Map Print",
    description: "Personalised star map showing the exact night sky from any place and date. A keepsake of life's biggest moments.",
    image_url: "https://images.unsplash.com/photo-1462332420958-a05d1e002413?w=800&auto=format&fit=crop&q=60",
    price_min: 30, price_max: 80,
    tags: ["home decor", "art & crafts"],
    occasions: ["anniversary", "wedding", "valentine's day", "baby shower"],
    recipients: ["her", "him", "parent", "friend", "co-worker"],
    affiliate_url: "/go/star-map-print", slug: "star-map-print", destination_url: null, affiliate_network: "etsy"
  },

  // ── Fitness (25-28) ───────────────────────────────────────────────────────
  {
    name: "Smart Fitness Watch",
    description: "Advanced fitness tracking with heart rate, sleep, GPS, and 100+ workout modes. 14-day battery life.",
    image_url: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&auto=format&fit=crop&q=60",
    price_min: 120, price_max: 180,
    tags: ["tech & gadgets", "fitness & wellness"],
    occasions: ["birthday", "graduation", "father's day", "promotion/retirement"],
    recipients: ["him", "her", "child", "sibling", "parent"],
    affiliate_url: "/go/fitness-watch", slug: "fitness-watch", destination_url: null, affiliate_network: "amazon"
  },
  {
    name: "Premium Yoga Mat",
    description: "Eco-friendly natural rubber mat with superior grip and alignment markers. 5mm thick for joint support.",
    image_url: "https://images.unsplash.com/photo-1592432678016-e910b452f9a2?w=800&auto=format&fit=crop&q=60",
    price_min: 60, price_max: 95,
    tags: ["fitness & wellness"],
    occasions: ["birthday", "mother's day", "graduation"],
    recipients: ["her", "friend", "co-worker", "sibling", "parent"],
    affiliate_url: "/go/yoga-mat", slug: "yoga-mat", destination_url: "https://www.amazon.com/s?k=manduka+pro+yoga+mat", affiliate_network: "amazon"
  },
  {
    name: "Adjustable Dumbbell Set",
    description: "Space-saving pair of dumbbells, adjustable from 5 to 50 lbs each. Quick weight changes for any workout.",
    image_url: "https://images.unsplash.com/photo-1623874514711-0f321325f318?w=800&auto=format&fit=crop&q=60",
    price_min: 150, price_max: 200,
    tags: ["fitness & wellness"],
    occasions: ["birthday", "father's day", "graduation", "promotion/retirement"],
    recipients: ["him", "parent", "sibling", "co-worker"],
    affiliate_url: "/go/adjustable-dumbbells", slug: "adjustable-dumbbells", destination_url: null, affiliate_network: "amazon"
  },
  {
    name: "Deep Tissue Massage Gun",
    description: "Professional-grade percussion massager with 6 speed levels and 4 interchangeable heads. Quiet operation.",
    image_url: "https://images.unsplash.com/photo-1620188467120-5042ed1eb5da?w=800&auto=format&fit=crop&q=60",
    price_min: 90, price_max: 140,
    tags: ["fitness & wellness", "tech & gadgets"],
    occasions: ["birthday", "father's day", "mother's day", "graduation"],
    recipients: ["him", "her", "parent", "sibling", "friend"],
    affiliate_url: "/go/massage-gun", slug: "massage-gun", destination_url: null, affiliate_network: "amazon"
  },

  // ── Baby & personalised (29-30) ──────────────────────────────────────────
  {
    name: "Personalised Baby Keepsake Box",
    description: "Handcrafted wooden memory box with engraved name and date of birth. A lifetime keepsake of those tiny first moments.",
    image_url: "https://images.unsplash.com/photo-1607673129070-49b7a09e1c52?w=800&auto=format&fit=crop&q=60",
    price_min: 30, price_max: 60,
    tags: ["home decor", "art & crafts"],
    occasions: ["baby shower"],
    recipients: ["her", "him", "friend", "sibling", "co-worker"],
    affiliate_url: "/go/baby-keepsake-box", slug: "baby-keepsake-box", destination_url: null, affiliate_network: "etsy"
  },
  {
    name: "Monogrammed Silk Pillowcase",
    description: "100% mulberry silk pillowcase with custom monogram embroidery. Promotes hair health and reduces facial lines.",
    image_url: "https://images.unsplash.com/photo-1592789705501-f9ae4287c4cf?w=800&auto=format&fit=crop&q=60",
    price_min: 50, price_max: 90,
    tags: ["home decor", "fashion & accessories", "fitness & wellness"],
    occasions: ["wedding", "anniversary", "house warming", "mother's day", "valentine's day"],
    recipients: ["her", "parent", "friend", "co-worker"],
    affiliate_url: "/go/silk-pillowcase", slug: "silk-pillowcase", destination_url: null, affiliate_network: "amazon"
  },

  // ── Bath & home comfort (31) ──────────────────────────────────────────────
  {
    name: "Tens Towels 4-Piece Luxury Bath Towel Set",
    description: "A soft and absorbent 100% cotton towel set designed for everyday comfort. Lightweight, quick-drying, and generously sized — perfect for upgrading a bathroom or adding a spa-like touch at home.",
    image_url: "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=800&auto=format&fit=crop&q=60",
    price_min: 30, price_max: 45,
    tags: ["home decor", "home & kitchen", "fitness & wellness"],
    occasions: ["birthday", "house warming", "wedding", "anniversary", "mother's day"],
    recipients: ["her", "him", "parent", "friend", "sibling", "co-worker"],
    affiliate_url: "https://www.amazon.com/dp/B08LBN2JPS", slug: "tens-towels", destination_url: "https://www.amazon.com/dp/B08LBN2JPS", affiliate_network: "amazon"
  },  
  {
    name: "Derila Ergo Cervical Neck Pillow for Sleeping Pillow",   
    description: "True Ergonomic Support: The advanced, high-density memory foam contours perfectly to your unique shape for custom head and shoulder comfort..",
    image_url: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&auto=format&fit=crop&q=60",
    price_min: 25, price_max:50,
    tags: ["fitness & wellness", "home & kitchen"]
    occasions: ["birthday", "graduation", "mother's day"],
    recipients: ["her", "him", "friend", "sibling", "co-worker"],
    affiliate_url: "https://www.amazon.com/dp/B0CRMZHDG8", slug: "stanley-quencher", destination_url: "https://www.amazon.com/dp/B0CRMZHDG8", affiliate_network: "amazon"
  },
  {
  name: "Derila Ergo Cervical Neck Pillow for Sleeping Pillow Contour Memory Foam ",
  description: "",
  image_url: "https://images.unsplash.com/photo-XXXX?w=800&auto=format&fit=crop&q=60",
  price_min: 40, price_max: 70,
  tags: ["home & kitchen"],                 // interests — see vocabulary below
  occasions: ["birthday", "wedding",],       // see vocabulary below
  recipients: ["her", "him", "friend"],     // see vocabulary below
  affiliate_url: "/go/your-gift-slug", slug: "your-gift-slug", destination_url: "https://www.amazon.com/dp/XXXXXXXXXX", affiliate_network: "amazon"
}

  
];

];

async function seed() {
  console.log("Starting database seeding…");

  // 1. Clear dependent rows first (gift_suggestions references gifts).
  //    Then clear gifts. Without this order the FK constraint blocks the delete.
  console.log("Clearing gift_suggestions…");
  const { error: deleteSugErr } = await supabase
    .from('gift_suggestions')
    .delete()
    .gte('rank', 0); // matches every row
  if (deleteSugErr) {
    console.error("Error clearing gift_suggestions:", deleteSugErr);
    process.exit(1);
  }

  console.log("Clearing existing gifts…");
  const { error: deleteError } = await supabase
    .from('gifts')
    .delete()
    .gte('price_min', 0);
  if (deleteError) {
    console.error("Error clearing existing gifts:", deleteError);
    process.exit(1);
  }

  // 2. Insert the fresh catalogue
  console.log("Inserting new catalogue…");
  const { data, error } = await supabase.from('gifts').insert(gifts).select();
  if (error) {
    console.error("Error inserting gifts:", error);
    process.exit(1);
  }

  console.log(`✅ Successfully seeded ${data.length} gifts.`);
  console.log("");
  console.log("Quiz vocabulary used:");
  console.log("  occasions:  ", [...new Set(gifts.flatMap(g => g.occasions))].sort().join(", "));
  console.log("  recipients: ", [...new Set(gifts.flatMap(g => g.recipients))].sort().join(", "));
  console.log("  tags:       ", [...new Set(gifts.flatMap(g => g.tags))].sort().join(", "));
  process.exit(0);
}

seed();
