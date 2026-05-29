"use client";

import { useTransition, useState } from "react";
import { updateProfile, updateEmail, deleteAccount } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { Save, AlertTriangle, User, Mail, Settings, Bell } from "lucide-react";

export function ProfileForm({ profile, userEmail }: { profile: any, userEmail: string }) {
  const [isPending, startTransition] = useTransition();
  const [emailMsg, setEmailMsg] = useState("");

  const handleProfileSave = (formData: FormData) => {
    startTransition(async () => {
      try {
        await updateProfile(formData);
        alert("Profile updated successfully!");
      } catch (err: any) {
        alert(err.message || "Failed to update profile.");
      }
    });
  };

  const handleEmailSave = (formData: FormData) => {
    startTransition(async () => {
      try {
        const res = await updateEmail(formData);
        if (res?.message) setEmailMsg(res.message);
      } catch (err: any) {
        alert(err.message || "Failed to update email.");
      }
    });
  };

  const handleDelete = () => {
    if (window.confirm("Are you absolutely sure you want to delete your account? This action cannot be undone and will erase all your gifted history and upcoming occasions.")) {
      startTransition(async () => {
        const res = await deleteAccount();
        if (res?.redirect) window.location.href = res.redirect;
      });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      {/* Personal Information */}
      <section className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-accent" />
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Personal Information</h2>
            <p className="text-sm text-gray-500">Update your basic profile details.</p>
          </div>
        </div>

        <form action={handleProfileSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
              <input
                type="text"
                name="full_name"
                defaultValue={profile?.full_name || ""}
                required
                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-accent focus:ring-accent py-2.5 px-4"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Default Currency</label>
              <select
                name="default_currency"
                defaultValue={profile?.default_currency || "USD"}
                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-accent focus:ring-accent py-2.5 px-4 bg-white"
              >
                <option value="USD">$ US Dollar</option>
                <option value="GBP">£ British Pound</option>
                <option value="EUR">€ Euro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Default Budget Target</label>
              <input
                type="number"
                name="default_budget"
                defaultValue={profile?.default_budget || ""}
                min="0"
                step="1"
                placeholder="e.g. 50"
                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-accent focus:ring-accent py-2.5 px-4"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-gray-50">
            <h3 className="text-md font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Bell className="w-4 h-4 text-gray-400" /> Notifications & Reminders
            </h3>
            
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-3">When would you like to be reminded of an upcoming occasion?</p>
              <div className="flex flex-wrap gap-4">
                {[
                  { value: 14, label: "14 days before" },
                  { value: 7, label: "7 days before" },
                  { value: 3, label: "3 days before" },
                  { value: 1, label: "1 day before" },
                ].map((option) => (
                  <label key={option.value} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      name="reminder_days"
                      value={option.value}
                      defaultChecked={profile?.reminder_days?.includes(option.value)}
                      className="rounded border-gray-300 text-accent focus:ring-accent w-4 h-4 mt-0.5"
                    />
                    <span className="text-sm text-gray-600 group-hover:text-gray-900">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer group mb-1">
              <input
                type="checkbox"
                name="email_notifications"
                defaultChecked={profile?.email_notifications ?? true}
                className="rounded border-gray-300 text-accent focus:ring-accent w-4 h-4 mt-0.5"
              />
              <div>
                <span className="text-sm font-medium text-gray-700 block group-hover:text-gray-900">Email Notifications</span>
                <span className="text-xs text-gray-500">Receive reminders and recommendations directly to your inbox.</span>
              </div>
            </label>
          </div>

          <div className="pt-6 border-t border-gray-50 flex justify-end">
            <SubmitButton pendingText="Saving..." className="bg-primary px-8">
              <Save className="w-4 h-4 mr-2" /> Save Settings
            </SubmitButton>
          </div>
        </form>
      </section>

      {/* Account Settings */}
      <section className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-gray-300" />
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Account Credentials</h2>
            <p className="text-sm text-gray-500">Manage your login details.</p>
          </div>
        </div>

        <form action={handleEmailSave} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
            <div className="flex gap-4 items-start sm:items-center flex-col sm:flex-row">
              <input
                type="email"
                name="email"
                defaultValue={userEmail}
                required
                className="flex-grow w-full rounded-xl border-gray-300 shadow-sm focus:border-accent focus:ring-accent py-2.5 px-4"
              />
              <SubmitButton pendingText="Updating..." className="bg-gray-100 text-gray-700 hover:bg-gray-200 w-full sm:w-auto">
                Update Email
              </SubmitButton>
            </div>
            {emailMsg && <p className="text-sm text-emerald-600 mt-2 font-medium">{emailMsg}</p>}
          </div>
        </form>
      </section>

      {/* Danger Zone */}
      <section className="bg-red-50 rounded-3xl p-8 shadow-sm border border-red-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-red-500" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              <h2 className="text-xl font-bold">Danger Zone</h2>
            </div>
            <p className="text-sm text-red-600 max-w-xl">
              Permanently delete your account and all associated data, including gifted history, occasions, and profile preferences.
            </p>
          </div>
          <button 
            onClick={handleDelete}
            disabled={isPending}
            className="flex-shrink-0 bg-red-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
          >
            Delete Account
          </button>
        </div>
      </section>
    </div>
  );
}
