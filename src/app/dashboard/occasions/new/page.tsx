import { createOccasion } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

export default function NewOccasionPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link href="/dashboard/occasions" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-accent mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Occasions
        </Link>
        <h1 className="text-3xl font-serif font-bold text-primary">Add New Occasion</h1>
        <p className="text-gray-500 mt-1">Set up an event and we&apos;ll remind you when it&apos;s time to buy a gift.</p>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-xl shadow-primary/5 border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
        <form action={createOccasion} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Occasion Title *</label>
              <input
                type="text"
                name="title"
                defaultValue="Sarah's 30th Birthday"
                required
                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-accent focus:ring-accent py-2.5 px-4"
                placeholder="e.g. Mum's Birthday"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Occasion Type *</label>
              <select
                name="occasion_type"
                required
                defaultValue="birthday"
                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-accent focus:ring-accent py-2.5 px-4 bg-white"
              >
                <option value="birthday">Birthday</option>
                <option value="anniversary">Anniversary</option>
                <option value="christmas">Christmas</option>
                <option value="wedding">Wedding</option>
                <option value="new baby">New Baby</option>
                <option value="graduation">Graduation</option>
                <option value="housewarming">Housewarming</option>
                <option value="just because">Just Because</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date *</label>
              <input
                type="date"
                name="date"
                required
                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-accent focus:ring-accent py-2.5 px-4"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Recipient Name *</label>
              <input
                type="text"
                name="recipient_name"
                defaultValue="Sarah"
                required
                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-accent focus:ring-accent py-2.5 px-4"
                placeholder="Name"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Relationship *</label>
              <select
                name="recipient_relation"
                required
                defaultValue="partner"
                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-accent focus:ring-accent py-2.5 px-4 bg-white"
              >
                <option value="partner">Partner / Spouse</option>
                <option value="parent">Parent</option>
                <option value="child">Child</option>
                <option value="friend">Close Friend</option>
                <option value="sibling">Sibling</option>
                <option value="colleague">Colleague</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Budget Target ($) <span className="text-gray-400 font-normal">(Optional)</span></label>
              <input
                type="number"
                name="budget"
                min="0"
                step="1"
                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-accent focus:ring-accent py-2.5 px-4"
                placeholder="e.g. 50"
              />
            </div>

            <div className="flex items-center mt-8">
              <input
                type="checkbox"
                name="recurring"
                id="recurring"
                defaultChecked
                className="h-5 w-5 rounded border-gray-300 text-accent focus:ring-accent mt-0.5"
              />
              <label htmlFor="recurring" className="ml-3 text-sm font-medium text-gray-700">
                This is a repeating event
                <p className="font-normal text-gray-500 text-xs">It will automatically renew next year (e.g. Birthdays)</p>
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes <span className="text-gray-400 font-normal">(Optional)</span></label>
              <textarea
                name="notes"
                rows={3}
                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-accent focus:ring-accent py-2.5 px-4"
                placeholder="Any special gift ideas or things to avoid..."
              />
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 flex items-center justify-end gap-4">
            <Link 
              href="/dashboard/occasions" 
              className="text-sm font-semibold text-gray-600 hover:text-gray-900 px-4 py-2"
            >
              Cancel
            </Link>
            <SubmitButton pendingText="Saving..." className="bg-primary px-8">
              <Save className="w-4 h-4 mr-2" /> Save Occasion
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
