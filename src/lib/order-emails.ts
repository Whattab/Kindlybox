// Transactional emails for paid extras, sent via Resend.
// Plain HTML to keep things simple and dependency-light. All sends are
// best-effort: callers wrap these in try/catch so an email hiccup never
// breaks an order.

import { Resend } from "resend";
import { SERVICES, isServiceType } from "@/lib/extras";

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM = process.env.RESEND_FROM_EMAIL || "hello@kindlybox.com";

// Resend returns delivery errors INSIDE the response object, not as thrown
// exceptions — so we must inspect result.error or failures pass silently.
async function send(opts: { to: string | string[]; subject: string; html: string }) {
  const result = await resend.emails.send({ from: FROM, ...opts });
  if (result.error) {
    console.error("[order-emails] Resend error:", JSON.stringify(result.error));
    throw new Error(result.error.message || "Email failed to send");
  }
  console.log("[order-emails] sent:", opts.subject, "→", opts.to, "id:", result.data?.id);
}

function adminRecipients(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

function serviceName(type: string): string {
  return isServiceType(type) ? SERVICES[type].name : type;
}

function shell(title: string, body: string): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
    <h1 style="font-size:22px;color:#4f46e5;margin:0 0 16px">${title}</h1>
    ${body}
    <p style="font-size:12px;color:#9ca3af;margin-top:32px">KindlyBox</p>
  </div>`;
}

export async function sendOrderConfirmation(o: {
  id: string;
  buyer_email: string;
  buyer_name?: string | null;
  service_type: string;
  occasion?: string | null;
}) {
  const name = o.buyer_name ? ` ${o.buyer_name}` : "";
  const body = `
    <p>Hi${name}, thanks for your order!</p>
    <p>We&rsquo;ve received your <strong>${serviceName(o.service_type)}</strong>${o.occasion ? ` for a ${o.occasion}` : ""} and our team is on it.</p>
    <p>You&rsquo;ll get another email with your finished piece, usually within 1&ndash;2 days.</p>
    <p style="font-size:12px;color:#9ca3af">Order ref: ${o.id}</p>`;
  await send({
    to: o.buyer_email,
    subject: `Your KindlyBox ${serviceName(o.service_type)} order is confirmed`,
    html: shell("Order confirmed 🎉", body),
  });
}

export async function sendAdminOrderAlert(o: {
  id: string;
  service_type: string;
  occasion?: string | null;
  buyer_email: string;
}) {
  const to = adminRecipients();
  if (to.length === 0) return;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kindlybox.com";
  const body = `
    <p>New paid order to fulfill:</p>
    <ul>
      <li><strong>${serviceName(o.service_type)}</strong>${o.occasion ? ` · ${o.occasion}` : ""}</li>
      <li>Buyer: ${o.buyer_email}</li>
    </ul>
    <p><a href="${appUrl}/dashboard/orders/${o.id}">Open in dashboard →</a></p>`;
  await send({
    to,
    subject: `New order: ${serviceName(o.service_type)}`,
    html: shell("New order 🛎️", body),
  });
}

export async function sendOrderDelivery(o: {
  id: string;
  buyer_email: string;
  buyer_name?: string | null;
  service_type: string;
  song_url?: string | null;
  card_url?: string | null;
}) {
  const name = o.buyer_name ? ` ${o.buyer_name}` : "";
  const links: string[] = [];
  // ?download forces the browser to save the file rather than open it.
  if (o.song_url) links.push(`<p>🎵 <a href="${o.song_url}?download">Download your custom song (audio)</a></p>`);
  if (o.card_url) links.push(`<p>💌 <a href="${o.card_url}?download">Download your greeting card</a></p>`);
  const body = `
    <p>Hi${name}, it&rsquo;s ready!</p>
    <p>Here is your <strong>${serviceName(o.service_type)}</strong>:</p>
    ${links.join("\n")}
    <p>We hope it makes their day. Thank you for choosing KindlyBox 💛</p>`;
  await send({
    to: o.buyer_email,
    subject: `Your KindlyBox ${serviceName(o.service_type)} is ready 🎁`,
    html: shell("Your order is ready 🎁", body),
  });
}
