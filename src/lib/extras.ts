// Paid extra services + pricing. THIS is the one place to change prices.
//
// Prices are in cents (3500 = $35.00). Edit PRICES_CENTS below and the whole
// app (storefront, checkout, orders) updates.

export type ServiceType = "song" | "card" | "bundle";

// Supabase Storage bucket holding delivered order files (songs/cards).
export const ASSET_BUCKET = "order-assets";

// Paid extras are hidden unless EXTRAS_ENABLED=true. Keeps the storefront out
// of production (where payment isn't wired yet) while staying on locally.
// When Stripe is added, set EXTRAS_ENABLED=true in the Vercel env to launch.
export function extrasEnabled(): boolean {
  return process.env.EXTRAS_ENABLED === "true";
}

// ⬇️ EDIT YOUR PRICES HERE (cents).
export const PRICES_CENTS: Record<ServiceType, number> = {
  song: 1500,   // $15
  card: 1000,   // $10
  bundle: 2500, // $25
};

export interface ServiceDef {
  type: ServiceType;
  name: string;
  tagline: string;
  description: string;
  includes: string[];
  // Which brief fields this service collects.
  needsCardMessage: boolean;
  needsSongDetails: boolean;
}

export const SERVICES: Record<ServiceType, ServiceDef> = {
  song: {
    type: "song",
    name: "Custom Song",
    tagline: "A one-of-a-kind song, written for them",
    description:
      "Tell us the occasion, the names, the story — and we'll craft an original, fully-produced song made just for them.",
    includes: ["Original song (1–2 min)", "Your style & mood", "Their names & story woven in", "Delivered as audio you can share"],
    needsCardMessage: false,
    needsSongDetails: true,
  },
  card: {
    type: "card",
    name: "Greeting Card",
    tagline: "A beautiful card in your own words",
    description:
      "A designed digital greeting card featuring your exact message, themed to the occasion and ready to send or print.",
    includes: ["Designed digital card", "Your exact message", "Occasion-matched art", "Print-ready & shareable"],
    needsCardMessage: true,
    needsSongDetails: false,
  },
  bundle: {
    type: "bundle",
    name: "Song + Card Bundle",
    tagline: "The full surprise — song and card together",
    description:
      "Both a custom song and a matching greeting card in your own words. The complete, unforgettable gift.",
    includes: ["Everything in Custom Song", "Everything in Greeting Card", "Designed to match", "Best value"],
    needsCardMessage: true,
    needsSongDetails: true,
  },
};

// Shared building blocks for the digital-gift creation flows (song/card/bundle).
// Displayed as chips; stored verbatim on the order.
export const OCCASIONS = [
  "Birthday", "Anniversary", "Wedding", "Engagement", "New Baby", "Graduation",
  "Mother's Day", "Father's Day", "Valentine's Day", "Retirement", "Get Well Soon",
  "Congratulations", "Sympathy", "Just Because", "Housewarming", "Wedding Toast",
  "Corporate Event", "Holiday Season",
];

// Song flow — Step 2. Genre chips (buyers can also add their own), plus moods.
export const GENRES = [
  "Pop", "Acoustic", "R&B", "Country", "Hip-Hop", "Lullaby", "Rock", "Folk",
  "Jazz", "Classical", "Reggae", "EDM / Dance", "Gospel", "Latin", "Indie", "Musical Theater",
];

export const MOODS = ["Heartfelt", "Upbeat", "Funny", "Emotional", "Romantic", "Nostalgic"];

// Song flow — Step 5. `id` is stored on the order; label/description are shown.
export type DeliveryMethod = "audio" | "link" | "video";
export const DELIVERY_OPTIONS: { id: DeliveryMethod; label: string; description: string }[] = [
  { id: "audio", label: "Audio file", description: "Sent as a download, ready to share anywhere." },
  { id: "link", label: "Shareable link", description: "A private page they can open and replay." },
  { id: "video", label: "Video with lyrics", description: "Lyrics and photos synced to the song." },
];

// Greeting-card flow — Step 2. Visual theme swatches (Tailwind gradient classes).
export const CARD_DESIGNS: { id: string; gradient: string; light?: boolean }[] = [
  { id: "Playful", gradient: "from-[#f0a848] to-[#c94f6d]" },
  { id: "Elegant", gradient: "from-[#4a3d33] to-[#241a15]" },
  { id: "Minimal", gradient: "from-[#f5efe0] to-[#d8cdb8]", light: true },
  { id: "Funny", gradient: "from-[#e0a63a] to-[#b0452e]" },
];

// Greeting-card flow — Step 6.
export const CARD_DELIVERY_OPTIONS: { id: string; label: string; description: string }[] = [
  { id: "link", label: "Send a link", description: "Text or email it straight to them." },
  { id: "download", label: "Download", description: "Save it and send it yourself." },
  { id: "pdf", label: "Print-ready PDF", description: "For a card you can hand over in person." },
];

// Bundle flow — Step 9. Delivery covers both the (instant) card and the
// (produced-to-order) song, so the descriptions differ from the single flows.
export const BUNDLE_DELIVERY_OPTIONS: { id: string; label: string; description: string }[] = [
  { id: "link", label: "Send a link", description: "Card + song open together on one private page." },
  { id: "download", label: "Download", description: "Both files, sent when they're ready." },
  { id: "pdf", label: "Print-ready PDF", description: "Print-ready card + song by email link." },
];
export const BUNDLE_DELIVERY_NOTE =
  "Both your card and song are designed individually — your bundle arrives within 2 days.";

export function formatPrice(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function isServiceType(value: string): value is ServiceType {
  return value === "song" || value === "card" || value === "bundle";
}
