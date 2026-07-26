import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/admin";
import { GiftForm, DeleteGiftButton } from "../AddGiftForm";
import { ArrowLeft, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function GiftDetailPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const supabase = createClient();

  const { data: gift } = await supabase
    .from("gifts")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!gift) return notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/dashboard/catalog" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-accent mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Catalogue
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-primary">{gift.name}</h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {gift.destination_url && (
              <a
                href={gift.destination_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent border border-gray-200 rounded-lg px-3 py-2"
                title="Open destination"
              >
                <ExternalLink className="w-4 h-4" /> Visit
              </a>
            )}
            <DeleteGiftButton id={gift.id} name={gift.name} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-xl shadow-primary/5 border border-gray-100">
        <GiftForm
          mode="edit"
          initial={{
            id: gift.id,
            name: gift.name,
            description: gift.description,
            image_url: gift.image_url,
            price_min: gift.price_min,
            price_max: gift.price_max,
            destination_url: gift.destination_url,
            affiliate_network: gift.affiliate_network,
            gender: gift.gender,
            active: gift.active,
            tags: gift.tags,
            occasions: gift.occasions,
            recipients: gift.recipients,
            slug: gift.slug,
            affiliate_url: gift.affiliate_url,
          }}
        />
      </div>
    </div>
  );
}
