"use client";

import { useTransition } from "react";
import { deletePurchase, updatePurchaseStatus } from "./actions";
import { Trash2, Loader2, CheckCircle2, Clock, Bookmark, ExternalLink } from "lucide-react";
import Image from "next/image";

export function PurchaseCard({ purchase }: { purchase: any }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to remove this gift record?")) {
      startTransition(() => {
        deletePurchase(purchase.id);
      });
    }
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    const formData = new FormData();
    formData.append("status", newStatus);
    
    startTransition(() => {
      updatePurchaseStatus(purchase.id, formData);
    });
  };

  const giftName = purchase.gifts?.name || purchase.gift_name || "Unknown Gift";
  const imageUrl = purchase.gift_image_url || purchase.gifts?.image_url || "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=800&auto=format&fit=crop&q=80";
  const occasionTitle = purchase.occasions?.title;

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm flex flex-col sm:flex-row group transition-all duration-300 hover:shadow-md">
      <div className="relative w-full sm:w-48 h-48 sm:h-auto flex-shrink-0 bg-gray-100">
        <Image 
          src={imageUrl} 
          alt={giftName} 
          fill 
          className="object-cover group-hover:scale-105 transition-transform duration-700"
        />
        {/* Status Badge Over Image */}
        <div className="absolute top-3 left-3 flex gap-2">
          {purchase.status === 'delivered' && (
            <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1.5 text-xs font-bold shadow-sm backdrop-blur-md">
              <CheckCircle2 className="w-3.5 h-3.5" /> Delivered
            </div>
          )}
          {purchase.status === 'ordered' && (
            <div className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full flex items-center gap-1.5 text-xs font-bold shadow-sm backdrop-blur-md">
              <Clock className="w-3.5 h-3.5" /> Ordered
            </div>
          )}
          {purchase.status === 'saved' && (
            <div className="bg-gray-50 text-gray-700 border border-gray-200 px-2.5 py-1 rounded-full flex items-center gap-1.5 text-xs font-bold shadow-sm backdrop-blur-md">
              <Bookmark className="w-3.5 h-3.5" /> Saved
            </div>
          )}
        </div>
      </div>
      
      <div className="p-5 flex flex-col flex-grow">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-serif text-xl font-bold text-gray-900 leading-tight mb-1">{giftName}</h3>
            <p className="text-gray-500 text-sm">
              Given to <span className="font-semibold text-primary capitalize">{purchase.recipient_name}</span>
              {occasionTitle && <span> for {occasionTitle}</span>}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {purchase.gifts?.affiliate_url && (
              <a 
                href={purchase.gifts.affiliate_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-accent transition-colors p-2 bg-gray-50 hover:bg-accent/10 rounded-lg"
                title="View Product"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button 
              onClick={handleDelete}
              disabled={isPending}
              className="text-gray-400 hover:text-red-500 transition-colors p-2 bg-gray-50 hover:bg-red-50 rounded-lg"
              title="Delete Record"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-auto pt-4 border-t border-gray-50">
          <div>
            <p className="text-xs text-gray-400 font-medium">Date</p>
            <p className="text-sm font-semibold text-gray-700">{purchase.purchased_at ? new Date(purchase.purchased_at).toLocaleDateString() : 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Price Paid</p>
            <p className="text-sm font-semibold text-gray-700">{purchase.price_paid ? `$${purchase.price_paid}` : 'Unknown'}</p>
          </div>
          <div className="col-span-2 sm:col-span-2 lg:col-span-2 flex flex-col">
            <p className="text-xs text-gray-400 font-medium whitespace-nowrap">Status</p>
            <div className="relative">
              <select
                value={purchase.status}
                onChange={handleStatusChange}
                disabled={isPending}
                className="block w-full rounded-lg border-gray-200 text-sm focus:border-accent focus:ring-accent py-1.5 pl-3 pr-8 shadow-sm cursor-pointer disabled:opacity-50 appearance-none bg-gray-50 hover:bg-gray-100 transition-colors"
                style={{ height: "32px" }}
              >
                <option value="saved">Wishlist / Saved</option>
                <option value="ordered">Ordered / Shipping</option>
                <option value="delivered">Delivered / Given</option>
              </select>
            </div>
          </div>
        </div>

        {purchase.notes && (
          <div className="mt-3 pt-3 border-t border-gray-50">
            <p className="text-xs text-gray-400 font-medium mb-1">Notes</p>
            <p className="text-sm text-gray-600 truncate">{purchase.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
