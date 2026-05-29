import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getRecommendations } from "@/lib/recommend";
import { Resend } from "resend";
import GiftSuggestionsEmail from "@/emails/GiftSuggestions";
import * as React from 'react';

const resend = new Resend(process.env.RESEND_API_KEY!);

// Construct admin client that ignores RLS to securely save sessions regardless of user state
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const body = await request.json();
    const { recipient, occasion, interests, budget, firstName, email, ageGroup, gender } = body;

    // 1. Authenticate (optional for quiz)
    const { data: { user } } = await supabase.auth.getUser();

    // 2. Fetch active gifts catalog utilizing secure user-context client
    const { data: gifts, error: giftsError } = await supabaseAdmin
      .from("gifts")
      .select("*")
      .eq("active", true);

    if (giftsError) {
      console.error("Gifts fetch error:", giftsError);
      return NextResponse.json({ error: "Failed to load gift catalog" }, { status: 500 });
    }

    // 3. Score and recommend top 3 gifts
    const recommendations = getRecommendations({ recipient, occasion, interests, budget, ageGroup, gender }, gifts || []);

    if (recommendations.length === 0) {
      return NextResponse.json({ error: "No matching gifts found for your criteria" }, { status: 404 });
    }

    // 4. Create the quiz session securely using the admin context
    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .from("quiz_sessions")
      .insert([
        {
          user_id: user?.id || null,
          answers: { recipient, occasion, interests, budget, ageGroup, gender },
          email_captured: user ? user.email : email,
          first_name_captured: user ? user.user_metadata?.first_name : firstName,
        }
      ])
      .select("id")
      .single();

    if (sessionError || !sessionData) {
      console.error("Session creation error:", sessionError);
      return NextResponse.json({ error: "Failed to save quiz session" }, { status: 500 });
    }

    const sessionId = sessionData.id;

    // 5. Save the suggestions
    const suggestionsToInsert = recommendations.map((rec, index) => ({
      session_id: sessionId,
      gift_id: rec.gift.id,
      match_score: rec.matchScorePercent,
      rank: index + 1,
    }));

    const { error: suggestionsError } = await supabaseAdmin
      .from("gift_suggestions")
      .insert(suggestionsToInsert);

    if (suggestionsError) {
      console.error("Suggestions save error:", suggestionsError);
    }

    // 6. Send the email via Resend
    const recipientEmail = user ? user.email : email;
    const recipientName = user ? user.user_metadata?.first_name : firstName;
    
    if (recipientEmail) {
      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'hello@kindlybox.com',
          to: recipientEmail,
          subject: `Your 3 perfect gifts are here${recipientName ? `, ${recipientName}` : ''} 🎁`,
          react: React.createElement(GiftSuggestionsEmail, {
            firstName: recipientName,
            recommendations,
            sessionId,
          }),
        });
      } catch (emailErr) {
        console.error("Error sending email:", emailErr);
        // We don't fail the whole request just because email failed
      }
    }

    return NextResponse.json({
      sessionId,
      success: true,
      recommendations,
    });
  } catch (error: any) {
    console.error("Quiz submission error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
