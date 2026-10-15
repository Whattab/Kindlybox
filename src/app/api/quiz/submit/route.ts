import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { type QuizAnswers } from "@/lib/recommend";
import { parseV2State, toQuizAnswers } from "@/lib/quiz-v2/map";
import { interpretFreeText } from "@/lib/ai-tags";
import { isAmazonItem } from "@/lib/amazon-display";
import { sendResultsEmail } from "@/lib/quiz-email";
import { runRecommendation } from "@/lib/quiz-run";

// Construct admin client that ignores RLS to securely save sessions regardless of user state
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const body = await request.json();
    const { firstName, email } = body;

    // Branching quiz (Step 6): the browser sends its raw v2 state; the SERVER
    // validates and maps it to the recommender's answers (never trust a
    // client-side mapping). v1 posts its answers directly, as before.
    const isV2 = body.quizVersion === "v2";
    const v2State = isV2 ? parseV2State(body.v2) : null;
    const v2Answers: QuizAnswers | null = v2State ? toQuizAnswers(v2State) : null;
    const { recipient, occasion, interests, budget, ageGroup, gender, freeText, recipientName } = v2Answers ?? body;

    // 1. Authenticate (optional for quiz)
    const { data: { user } } = await supabase.auth.getUser();

    // 2. Interpret the free-text note into APPROVED tags (fail-soft) and blend
    // the interpreted interests into the quiz interests, so free-text actually
    // influences candidate selection + scoring.
    const interpreted = await interpretFreeText(freeText, supabaseAdmin);
    const effectiveInterests = Array.from(new Set([...(interests || []), ...interpreted.interests]));
    // v2 adds the shopper's avoid chips, gift feel, level and relationship rules.
    const avoidFlags = Array.from(new Set([...(v2Answers?.avoidFlags || []), ...interpreted.avoid_flags]));

    // 3. Recommend + save the session and picks (shared with Step 7 refinements).
    const personalizationName = recipientName?.trim() || (user ? user.user_metadata?.first_name : firstName);
    const run = await runRecommendation({
      db: supabaseAdmin,
      answers: {
        recipient, occasion, interests: effectiveInterests, budget, ageGroup, gender, freeText, avoidFlags,
        giftFeel: v2Answers?.giftFeel,
        experienceLevel: v2Answers?.experienceLevel,
        excludeIntimate: v2Answers?.excludeIntimate,
        excludeLuxe: v2Answers?.excludeLuxe,
      },
      // Mapped answers stay top-level (the results page reads them); v2 also
      // keeps its raw state + version so old and new quizzes can be compared.
      storedAnswers: {
        recipient, occasion, interests, budget, ageGroup, gender, freeText, recipientName, interpreted,
        ...(v2State ? { quizVersion: "v2", v2: v2State, avoidFlags, giftFeel: v2Answers?.giftFeel } : {}),
      },
      userId: user?.id || null,
      emailCaptured: user ? user.email ?? null : email ?? null,
      firstNameCaptured: user ? user.user_metadata?.first_name ?? null : firstName ?? null,
      personalize: {
        answers: { recipient, occasion, interests, budget, ageGroup, gender, freeText, recipientName: personalizationName },
        recipientName,
      },
    });

    if (!run.ok) {
      if (run.reason === "no-matches") return NextResponse.json({ error: "No matching gifts found for your criteria" }, { status: 404 });
      if (run.reason === "catalog") return NextResponse.json({ error: "Failed to load gift catalog" }, { status: 500 });
      return NextResponse.json({ error: "Failed to save quiz session" }, { status: 500 });
    }
    const { sessionId, recommendations } = run;

    // 4. Send the email via Resend
    const recipientEmail = user ? user.email : email;

    // (v2 posts no email — the shopper opts in on the results page, Step 6c.)
    if (recipientEmail) {
      // Fail-soft: we don't fail the whole request just because email failed.
      // Greeting (owner rule): the shopper's own first name if we have it,
      // otherwise the gift recipient's name, otherwise no name.
      const greetName = (user ? user.user_metadata?.first_name : firstName)?.trim() || recipientName?.trim() || undefined;
      await sendResultsEmail({ to: recipientEmail, firstName: greetName, recommendations, sessionId });
    } else {
      console.log("[email] Skipped — no recipient email available");
    }

    // Never ship a hand-entered Amazon price over the wire (Associates rule).
    // The client only uses sessionId; the results page re-reads from the DB.
    const safeRecommendations = recommendations.map((rec) =>
      isAmazonItem({ affiliate_network: rec.gift.affiliate_network, url: rec.gift.affiliate_url })
        ? { ...rec, gift: { ...rec.gift, price_min: null, price_max: null } as any }
        : rec,
    );

    return NextResponse.json({
      sessionId,
      success: true,
      recommendations: safeRecommendations,
    });
  } catch (error: any) {
    console.error("Quiz submission error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
