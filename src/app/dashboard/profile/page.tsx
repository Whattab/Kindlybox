import { createClient } from "@/utils/supabase/server";
import { ProfileForm } from "./components";

export default async function ProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch Profile settings
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-primary">Profile Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account, preferences, and details.</p>
      </div>

      <ProfileForm profile={profile} userEmail={user.email || ""} />
    </div>
  );
}
