"use client";

import { useTransition } from "react";
import { deleteOccasion } from "./actions";
import { Trash2, Loader2, Calendar } from "lucide-react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function OccasionCard({ occasion }: { occasion: any }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this occasion? All scheduled reminders will also be deleted.")) {
      startTransition(() => {
        deleteOccasion(occasion.id);
      });
    }
  };

  const eventDate = new Date(occasion.date);
  const diffTime = Math.abs(eventDate.getTime() - new Date().getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  let urgencyColor = "border-gray-200 bg-gray-50 text-gray-700";
  if (diffDays <= 7) urgencyColor = "border-red-200 bg-red-50 text-red-700";
  else if (diffDays <= 30) urgencyColor = "border-amber-200 bg-amber-50 text-amber-700";
  else urgencyColor = "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-6 relative">
      <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl border flex-shrink-0 ${urgencyColor}`}>
        <span className="text-xs font-bold uppercase">{eventDate.toLocaleString('default', { month: 'short' })}</span>
        <span className="text-xl font-bold leading-none">{eventDate.getDate()}</span>
      </div>
      
      <div className="flex-grow">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-lg text-gray-900 leading-tight mb-1">{occasion.title}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
              <span className="capitalize text-primary font-medium">{occasion.recipient_name}</span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span className="capitalize">{occasion.occasion_type}</span>
              {occasion.recurring && (
                <>
                  <span className="w-1 h-1 rounded-full bg-gray-300" />
                  <span className="flex items-center gap-1 text-accent">
                    <Calendar className="w-3 h-3" /> Yearly
                  </span>
                </>
              )}
            </div>
          </div>
          <button 
            onClick={handleDelete}
            disabled={isPending}
            className="text-gray-400 hover:text-red-500 transition-colors bg-gray-50 hover:bg-red-50 p-2 rounded-lg"
            title="Delete Event"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-gray-50">
          <div>
            <p className="text-xs text-gray-400 font-medium">Recipient</p>
            <p className="text-sm font-semibold text-gray-700 capitalize">{occasion.recipient_relation || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Budget</p>
            <p className="text-sm font-semibold text-gray-700">{occasion.budget ? `$${occasion.budget}` : 'Any'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-gray-400 font-medium">Notes</p>
            <p className="text-sm text-gray-700 truncate" title={occasion.notes}>{occasion.notes || '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
