// "Your organiser link" email for Gift together. Plain inline HTML — one short
// message, no template needed. Fail-soft: returns false instead of throwing.

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function sendOrganiserLinkEmail(opts: {
  to: string; organiserName: string; recipientName: string; organiserLink: string; inviteLink: string;
}): Promise<boolean> {
  const forWho = opts.recipientName ? ` for ${esc(opts.recipientName)}` : "";
  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1f2d2a">
  <h1 style="font-family:Georgia,serif;font-size:26px;margin:0 0 12px">Your group gift${forWho}</h1>
  <p style="font-size:15px;line-height:1.5">Hi ${esc(opts.organiserName)}, here's your private organiser link. Open it any time, on any device, to see who's in, choose the gift and set the total.</p>
  <p style="margin:24px 0"><a href="${esc(opts.organiserLink)}" style="background:#1f3a34;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold;display:inline-block">Manage my group</a></p>
  <p style="font-size:13px;color:#b45309"><strong>Keep this link to yourself</strong> — anyone with it can manage the group.</p>
  <p style="font-size:15px;line-height:1.5;margin-top:24px">To invite friends, send them this link instead:<br><a href="${esc(opts.inviteLink)}" style="color:#b7791f">${esc(opts.inviteLink)}</a></p>
  <p style="font-size:12px;color:#888;margin-top:32px">Tip: create a free KindlyBox account and open the group while signed in — it'll be saved under Dashboard → Group Gifts.</p>
</div>`;
  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "hello@kindlybox.com",
      to: opts.to,
      subject: `Your group gift organiser link${opts.recipientName ? ` for ${opts.recipientName}` : ""} 🎁`,
      html,
    });
    // Resend returns errors inside the response, not as exceptions.
    if (result?.error) {
      console.error("[group-gift email] send failed", result.error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[group-gift email] send threw", e);
    return false;
  }
}
