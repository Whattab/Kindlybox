import { requireAdmin } from "@/utils/admin";
import { vocabLabel } from "@/lib/gift-vocab";
import { createServiceClient } from "@/utils/supabase/admin";
import { ShoppingCart } from "lucide-react";
import { loadGaps, loadImporterVocab, loadNeedsAttention } from "@/lib/amazon-assist";
import { ALL_DEPTH_IDS, MIN_DEPTH_PRODUCTS } from "@/lib/quiz-v2/graph";
import { AmazonImporter, type ImporterPreset } from "./AmazonImporter";
import { BackfillButton } from "./BackfillButton";

export const dynamic = "force-dynamic";
// "Fill missing tags with AI" runs ~54 tagging calls as a server action here.
export const maxDuration = 300;

// ?interest=fishing&occasion=sympathy… pre-selects chips (used by the
// "Where the quiz needs gifts" panel) so a run of additions starts ready.
const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export default async function AmazonGiftsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  await requireAdmin();
  const admin = createServiceClient();
  const [{ count }, vocab, attention] = await Promise.all([
    admin.from("gifts").select("id", { count: "exact", head: true }).eq("active", true).eq("affiliate_network", "amazon"),
    loadImporterVocab(admin),
    loadNeedsAttention(admin),
  ]);
  const gaps = await loadGaps(admin, vocab, ALL_DEPTH_IDS, MIN_DEPTH_PRODUCTS);
  const link = (params: Record<string, string>) => `/dashboard/amazon-gifts?${new URLSearchParams(params).toString()}#importer`;
  const pill = "inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 hover:border-accent hover:text-accent";
  const preset: ImporterPreset = {
    interests: list(searchParams?.interest), occasions: list(searchParams?.occasion),
    recipients: list(searchParams?.recipient), giftType: list(searchParams?.type),
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <ShoppingCart className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-primary">Add Amazon Gifts</h1>
            <p className="text-gray-500 mt-0.5">Add Amazon products to the gift catalogue, one at a time.</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">{count ?? 0}</div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">amazon gifts</div>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-accent/15 bg-accent/5 px-4 py-3 text-sm text-gray-700 leading-relaxed">
        <b>Fastest way:</b> on the Amazon page, SiteStripe → <b>Image</b> → copy the HTML and paste it below (fills the ASIN and the
        official image). Type the name, press <b>Suggest with AI</b>, check the chips, add. Amazon has no price API yet, so the
        price is used only for budget matching and is never shown (the card displays &quot;See price on Amazon&quot;).
      </div>

      {/* Where the quiz needs gifts — tap one to pre-select its chips below. */}
      <div className="mb-6 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h2 className="font-serif text-xl font-bold text-primary">Where the quiz needs gifts</h2>
          <p className="text-sm text-gray-500">Live counts across all products. Tap one to start adding gifts for it.</p>
        </div>
        {gaps.subHobbies.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">
              Hidden &ldquo;Tell us a little more&rdquo; options <span className="normal-case font-normal text-gray-400">— need {MIN_DEPTH_PRODUCTS}+ gifts to appear in the quiz</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {gaps.subHobbies.map((h) => (
                <a key={h.label} href={link({ interest: h.label })} className={pill}>{h.label} <span className="text-gray-400">{h.count}</span></a>
              ))}
            </div>
          </div>
        )}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">Thinnest occasions</p>
          <div className="flex flex-wrap gap-2">
            {gaps.occasions.slice(0, 6).map((o) => (
              <a key={o.label} href={link({ occasion: o.label })} className={pill}>{vocabLabel(o.label)} <span className="text-gray-400">{o.count}</span></a>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={link({ type: "experience" })} className={pill}>Last-minute / experiences <span className="text-gray-400">{gaps.noShip}</span></a>
          <a href={link({ recipient: "child" })} className={pill}>For a child <span className="text-gray-400">{gaps.child}</span></a>
        </div>
      </div>

      {attention.length > 0 && (
        <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50/60 p-6 space-y-3">
          <div>
            <h2 className="font-serif text-xl font-bold text-primary">Needs attention ({attention.length})</h2>
            <p className="text-sm text-gray-600">
              Missing quiz tags → press the button (fills gaps only, never removes your choices).
              Placeholder image → re-add the gift below with the same ASIN and a SiteStripe snippet; it updates in place.
            </p>
          </div>
          <BackfillButton />
          <ul className="max-h-64 overflow-y-auto divide-y divide-amber-100 text-sm">
            {attention.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span className="text-gray-700">{a.name}{a.asin && <span className="ml-2 font-mono text-xs text-gray-400">{a.asin}</span>}</span>
                <span className="text-xs text-amber-700">{a.problems.join(" · ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div id="importer" className="scroll-mt-6">
        <AmazonImporter vocab={vocab} preset={preset} />
      </div>
    </div>
  );
}
