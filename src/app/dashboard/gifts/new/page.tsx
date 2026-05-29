import { createPurchase } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

export default function NewGiftPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link href="/dashboard/gifts" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-accent mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to History
        </Link>
        <h1 className="text-3xl font-serif font-bold text-primary">Log a Gift</h1>
        <p className="text-gray-500 mt-1">Record a gift you bought for someone, either through KindlyBox or externally.</p>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-xl shadow-primary/5 border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
        <form action={createPurchase} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Gift Name *</label>
              <input
                type="text"
                name="gift_name"
                required
                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-accent focus:ring-accent py-2.5 px-4"
                placeholder="e.g. Silk Scarf"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Who was it for? *</label>
              <input
                type="text"
                name="recipient_name"
                required
                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-accent focus:ring-accent py-2.5 px-4"
                placeholder="Name"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tracking Status</label>
              <select
                name="status"
                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-accent focus:ring-accent py-2.5 px-4 bg-white"
                defaultValue="ordered"
              >
                <option value="saved">Wishlist / Saved</option>
                <option value="ordered">Ordered / Shipping</option>
                <option value="delivered">Delivered / Given</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date Given / Purchased</label>
              <input
                type="date"
                name="purchased_at"
                defaultValue={new Date().toISOString().split('T')[0]}
                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-accent focus:ring-accent py-2.5 px-4"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Price Paid ($)</label>
              <input
                type="number"
                name="price_paid"
                min="0"
                step="0.01"
                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-accent focus:ring-accent py-2.5 px-4"
                placeholder="0.00"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Personal Notes</label>
              <textarea
                name="notes"
                rows={3}
                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-accent focus:ring-accent py-2.5 px-4"
                placeholder="Size? Color? Did they like it?"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 flex items-center justify-end gap-4">
            <Link 
              href="/dashboard/gifts" 
              className="text-sm font-semibold text-gray-600 hover:text-gray-900 px-4 py-2"
            >
              Cancel
            </Link>
            <SubmitButton pendingText="Saving..." className="bg-primary px-8">
              <Save className="w-4 h-4 mr-2" /> Save Record
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
