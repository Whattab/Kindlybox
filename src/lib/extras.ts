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
  song: 3500,   // $35
  card: 1500,   // $15
  bundle: 4500, // $45
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

export const OCCASIONS = [
  "birthday", "anniversary", "wedding", "graduation", "valentine's day",
  "mother's day", "father's day", "new baby", "thank you", "just because",
];

export function formatPrice(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function isServiceType(value: string): value is ServiceType {
  return value === "song" || value === "card" || value === "bundle";
}
