import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const termiiApiKey = Deno.env.get("TERMII_API_KEY");
    const termiiSenderId = Deno.env.get("TERMII_SENDER_ID") || "ZedBute";

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: releases, error } = await supabase
      .from("music_releases")
      .select("id, user_id, title, artist_name, distributed_at, notification_sent")
      .eq("notification_sent", false)
      .not("distributed_at", "is", null)
      .lte("distributed_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .limit(50);

    if (error) throw error;

    const results = [];
    for (const release of releases ?? []) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, phone_number, full_name, artist_name")
        .eq("id", release.user_id)
        .single();

      const email = profile?.email;
      const phone = profile?.phone_number;
      const name = profile?.artist_name || profile?.full_name || "Artist";

      let emailOk = false;
      let smsOk = false;

      if (email) {
        try {
          const emailRes = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              service_id: "service_m5ipkn6",
              template_id: "template_h6m0hkf",
              user_id: "y6dBkyYNeiQ5-ONrT",
              template_params: {
                to_email: email,
                to_name: name,
                title: `Your song "${release.title}" is now live!`,
                message: `Hi ${name},\n\nGreat news! Your song "${release.title}" is now live on all major streaming platforms including Spotify, Apple Music, TikTok, and more.\n\nIt's been 2 weeks since distribution, and your music is out for the world to hear. Keep sharing your link and watch the streams roll in!\n\nThank you for trusting ZedBute.`,
              },
            }),
          });
          emailOk = emailRes.ok;
        } catch (e) {
          console.error("Email error:", e);
        }
      }

      if (phone && termiiApiKey) {
        try {
          const smsRes = await fetch("https://api.termii.com/api/sms/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: termiiApiKey,
              to: phone,
              from: termiiSenderId,
              sms: `Hi ${name}, your song "${release.title}" is now live on Spotify, Apple Music, TikTok and more! Thanks for using ZedBute.`,
              type: "plain",
              channel: "generic",
            }),
          });
          const smsData = await smsRes.json();
          smsOk = smsData?.code === "ok";
        } catch (e) {
          console.error("SMS error:", e);
        }
      }

      if (emailOk || smsOk) {
        await supabase
          .from("music_releases")
          .update({ notification_sent: true, notification_sent_at: new Date().toISOString() })
          .eq("id", release.id);
      }

      results.push({ releaseId: release.id, emailOk, smsOk, email, phone });
    }

    return new Response(
      JSON.stringify({ success: true, processed: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
