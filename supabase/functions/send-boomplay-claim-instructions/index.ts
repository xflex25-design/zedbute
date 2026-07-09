import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BOOMPLAY_CLAIM_URL = "https://www.boomplay.com/artists/claim";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Only the logged-in artist (who just paid + submitted the form) may call this.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { to_email, to_name, boomplay_link } = await req.json();
    if (!to_email) {
      return new Response(JSON.stringify({ error: "Missing recipient email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "Resend not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const from = Deno.env.get("RESEND_FROM") || "ZedBute <noreply@zedbute.com>";
    const name = (to_name || "Artist").toString().trim();
    const link = (boomplay_link || "").toString().trim();

    const text = buildText(name, link);
    const html = buildHtml(name, link);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from,
        to: [to_email],
        subject: "Your Boomplay Artist Profile — How to Claim It",
        html,
        text,
      }),
    });

    const resData = await res.json();
    if (!res.ok) {
      console.error("Resend error:", resData);
      return new Response(
        JSON.stringify({ error: resData?.message || "Failed to send email" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, id: resData?.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildText(name: string, link: string): string {
  const header = link
    ? `Your Boomplay artist link on file: ${link}`
    : "We don't have your Boomplay artist link on file yet — that's fine, you can find it during the steps below.";

  return `Hi ${name},

Thanks for your Boomplay artist profile claim request! Here's how to finish claiming your profile entirely on Boomplay's own site.

${header}

HOW TO CLAIM YOUR PROFILE (do this yourself on Boomplay):
1. Go to ${BOOMPLAY_CLAIM_URL}
2. Click "Log in" and sign in with YOUR OWN Boomplay account (the one tied to your artist profile). We never log in for you and never ask for your Boomplay password.
3. If prompted, search for your artist name and select your profile, or paste your Boomplay artist link.
4. Follow Boomplay's on-screen verification steps. Boomplay verifies you — this usually happens through the distributor/email linked to your account (e.g., DistroKid, TuneCore, CD Baby, or Boomplay's distribution service).
   This verification happens entirely on Boomplay's side, NOT with ZedBute.
5. Once Boomplay confirms you, your profile is claimed and you'll get access to Boomplay for Artists.

IMPORTANT:
- ZedBute does NOT log into Boomplay on your behalf and will NEVER ask for your Boomplay login or password.
- The verification step is handled by Boomplay. If Boomplay asks for it, complete it directly with them.
- If you get stuck, reply to this email and our team will guide you.

You're all set — go claim your profile!
— The ZedBute Team`;
}

function buildHtml(name: string, link: string): string {
  const header = link
    ? `<p>Your Boomplay artist link on file: <a href="${escapeHtml(
        link
      )}">${escapeHtml(link)}</a></p>`
    : `<p>We don't have your Boomplay artist link on file yet — that's fine, you'll find it during the steps below.</p>`;

  return `<div style="font-family:Inter,Arial,sans-serif;color:#111;max-width:560px;margin:0 auto">
  <h2 style="color:#F7931E">Claim your Boomplay Artist Profile</h2>
  <p>Hi ${escapeHtml(name)},</p>
  <p>Thanks for your Boomplay artist profile claim request! Here's how to finish claiming your profile entirely on Boomplay's own site.</p>
  ${header}
  <h3 style="margin-top:18px">How to claim (do this yourself on Boomplay)</h3>
  <ol style="line-height:1.7">
    <li>Go to <a href="${BOOMPLAY_CLAIM_URL}" style="color:#F7931E">${BOOMPLAY_CLAIM_URL}</a></li>
    <li>Click <strong>Log in</strong> and sign in with <strong>YOUR OWN Boomplay account</strong> (the one tied to your artist profile). We never log in for you and never ask for your Boomplay password.</li>
    <li>If prompted, search for your artist name and select your profile, or paste your Boomplay artist link.</li>
    <li>Follow Boomplay's on-screen verification steps. Boomplay verifies you through the distributor/email linked to your account (DistroKid, TuneCore, CD Baby, or Boomplay's distribution service). This happens entirely on Boomplay's side, NOT with ZedBute.</li>
    <li>Once Boomplay confirms you, your profile is claimed and you'll get access to Boomplay for Artists.</li>
  </ol>
  <div style="background:#fff4e5;border:1px solid #f0c36d;border-radius:8px;padding:12px;margin-top:16px">
    <strong>Important:</strong> ZedBute does <strong>NOT</strong> log into Boomplay on your behalf and will <strong>NEVER</strong> ask for your Boomplay login or password. The verification step is handled by Boomplay — complete it directly with them.
  </div>
  <p style="margin-top:16px">If you get stuck, just reply to this email and our team will guide you.</p>
  <p>— The ZedBute Team</p>
</div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
