import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import OccasionReminderEmail from '@/emails/OccasionReminder';

// Initialize with service role to bypass RLS for automated jobs
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(request: Request) {
  try {
    // 1. Authenticate cron job if you are using an API key in headers
    // Example: Check Authorization header against an env variable
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // For local testing, we'll gracefully allow this, but in prod you should protect it.
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // 2. Fetch pending reminders past their send date
    const now = new Date().toISOString();
    const { data: reminders, error: remindersError } = await supabase
      .from('reminders')
      .select(`
        id,
        send_at,
        occasions(id, title, date, occasion_type, recipient_name, recipient_relation, budget),
        profiles(id, email, first_name, email_notifications)
      `)
      .eq('status', 'pending')
      .lte('send_at', now)
      .limit(50); // Process in batches

    if (remindersError) throw remindersError;
    if (!reminders || reminders.length === 0) {
      return NextResponse.json({ message: 'No pending reminders found.' });
    }

    console.log(`Processing ${reminders.length} reminders...`);

    let successCount = 0;
    let failedCount = 0;

    // 3. Process each reminder
    for (const reminder of reminders) {
      const occasion = (Array.isArray(reminder.occasions) ? reminder.occasions[0] : reminder.occasions) as any;
      const profile = (Array.isArray(reminder.profiles) ? reminder.profiles[0] : reminder.profiles) as any;

      // Ensure data exists and user actually wants emails
      if (occasion && profile && profile.email && profile.email_notifications) {
        
        // Calculate days until event
        const eventDate = new Date(occasion.date);
        const todayDate = new Date();
        const diffTime = Math.abs(eventDate.getTime() - todayDate.getTime());
        const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Format budget
        const budgetStr = occasion.budget ? `$${occasion.budget}` : 'Any';

        // Pre-fill quiz link
        const params = new URLSearchParams();
        if (occasion.recipient_relation) params.append("recipient", occasion.recipient_relation.toLowerCase());
        if (occasion.occasion_type) params.append("occasion", occasion.occasion_type.toLowerCase());
        
        let budgetValue = "";
        if (occasion.budget) {
          if (occasion.budget < 25) budgetValue = "under-25";
          else if (occasion.budget <= 50) budgetValue = "25-50";
          else if (occasion.budget <= 100) budgetValue = "50-100";
          else if (occasion.budget <= 200) budgetValue = "100-200";
          else budgetValue = "no-limit";
          params.append("budget", budgetValue);
        }
        
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kindlybox.com';
        const quizLink = `${baseUrl}/quiz?${params.toString()}`;

        try {
          // Send Email
          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'hello@kindlybox.com',
            to: profile.email,
            subject: `${occasion.recipient_name}'s ${occasion.occasion_type} is almost here 🎁`,
            react: OccasionReminderEmail({
              firstName: profile.first_name || 'there',
              occasionTitle: occasion.title,
              recipientName: occasion.recipient_name,
              occasionType: occasion.occasion_type,
              daysUntil,
              budgetStr,
              quizLink,
            })
          });

          // Update reminder status
          await supabase
            .from('reminders')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', reminder.id);
            
          successCount++;
        } catch (emailErr) {
          console.error(`Failed to send email for reminder ${reminder.id}:`, emailErr);
          await supabase
            .from('reminders')
            .update({ status: 'failed' })
            .eq('id', reminder.id);
          failedCount++;
        }
      } else {
        // Automatically mark done if missing critical data or user opted out
        await supabase
          .from('reminders')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', reminder.id);
      }
    }

    return NextResponse.json({
      success: true,
      processed: reminders.length,
      successfulSends: successCount,
      failedSends: failedCount
    });

  } catch (err: any) {
    console.error("Cron Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
