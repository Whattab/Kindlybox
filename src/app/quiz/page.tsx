import { createClient } from "@/utils/supabase/server";
import { QuizFlow } from "@/components/quiz/QuizFlow";
import { QuizFlowV2 } from "@/components/quiz/v2/QuizFlowV2";
import { QuizVersionCookie } from "@/components/quiz/v2/QuizVersionCookie";
import { chooseQuizVersion, QUIZ_COOKIE } from "@/lib/quiz-v2/version";
import { getAvailableDepth } from "@/lib/quiz-v2/depth-available";
import { prefillFromParams } from "@/lib/quiz-v2/map";
import { cookies } from "next/headers";
import Link from "next/link";

export default async function QuizPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const userEmail = session?.user?.email || null;

  // Step 6 switch: old (v1) or branching (v2) quiz — see lib/quiz-v2/version.ts.
  const { version, remember } = chooseQuizVersion({
    override: searchParams?.quiz,
    cookie: cookies().get(QUIZ_COOKIE)?.value,
    percent: process.env.QUIZ_V2_PERCENT,
    killSwitch: process.env.QUIZ_V2_OFF,
  });
  const depthAvailable = version === "v2" ? await getAvailableDepth() : [];

  const initialValues = {
    recipient: typeof searchParams?.recipient === "string" ? searchParams.recipient : undefined,
    occasion: typeof searchParams?.occasion === "string" ? searchParams.occasion : undefined,
    budget: typeof searchParams?.budget === "string" ? searchParams.budget : undefined,
    ageGroup: typeof searchParams?.ageGroup === "string" ? searchParams.ageGroup : undefined,
    gender: typeof searchParams?.gender === "string" ? searchParams.gender : undefined,
    interests:
      typeof searchParams?.interests === "string"
        ? searchParams.interests.split(",").filter(Boolean)
        : undefined,
  };

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="px-6 py-4 border-b border-primary/5 bg-white shadow-sm flex items-center justify-between">
        <Link href="/">
          <h1 className="font-serif text-2xl font-bold tracking-tight text-primary hover:text-primary/80 transition-colors">
            KindlyBox
          </h1>
        </Link>
        {session ? (
          <Link href="/dashboard" className="text-sm font-medium text-gray-600 hover:text-accent">
            My Dashboard
          </Link>
        ) : (
          <Link href="/auth/login" className="text-sm font-medium text-gray-600 hover:text-accent">
            Sign In
          </Link>
        )}
      </header>
      
      {/* Extra bottom space so the quiz's Continue button can always scroll
          clear of the site-wide cookie notice (fixed to the bottom on phones). */}
      <div className="flex-grow flex flex-col items-center pt-10 pb-48 sm:pb-32 bg-gradient-to-b from-background to-white relative overflow-hidden">
        {/* Subtle decorative background elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] rounded-full bg-accent/5 blur-3xl" />
          <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="text-center mb-8 px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-3 text-balance">
            Find the Perfect Gift
          </h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Take our short quiz. We&apos;ll match your answers with our curated collection of premium gifts.
          </p>
        </div>
        
        {remember && <QuizVersionCookie version={version} />}
        {version === "v2" ? (
          <QuizFlowV2
            initialState={prefillFromParams(searchParams || {})}
            depthAvailable={depthAvailable}
          />
        ) : (
          <QuizFlow userEmail={userEmail} initialValues={initialValues} />
        )}
      </div>
    </main>
  );
}
