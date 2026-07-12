import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ADMIN_EMAIL =
  Deno.env.get("ADMIN_EMAIL") || "admin@zedbute.com";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
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

    const { batchId } = await req.json();
    if (!batchId) {
      return new Response(JSON.stringify({ error: "Missing batchId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs, error: subsErr } = await (supabase as any)
      .from("playlist_submissions")
      .select("id, song_title, artist_name, release_link, playlist_id")
      .eq("payment_batch_id", batchId);

    if (subsErr) throw subsErr;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const playlistIds = [...new Set(subs.map((s: any) => s.playlist_id))];
    const { data: playlists } = await (supabase as any)
      .from("playlists")
      .select("id, name")
      .in("id", playlistIds);
    const nameMap = new Map((playlists || []).map((p: any) => [p.id, p.name]));

    const rows = subs
      .map(
        (s: any) =>
          `- "${s.song_title}" by ${s.artist_name} → ${
            nameMap.get(s.playlist_id) || "Unknown playlist"
          } (${s.release_link})`
      )
      .join("\n");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "Resend not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const from =
      Deno.env.get("RESEND_FROM") || "ZedBute <noreply@zedbute.com>";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from,
        to: [ADMIN_EMAIL],
        subject: `New playlist submission ready for review (${subs.length})`,
        text: `A new playlist submission was paid and is ready for review.\n\n${rows}\n\nLog in to the admin panel to review.`,
        html: `<div style="font-family:Inter,Arial,sans-serif;max-width:560px"><h2 style="color:#F7931E">New playlist submission</h2><p>A new playlist submission was paid and is ready for review.</p><pre style="background:#f6f6f6;padding:12px;border-radius:8px">${rows.replace(
          /</g,
          "&lt;"
        )}</pre><p>Log in to the admin panel to review.</p></div>`,
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

    return new Response(JSON.stringify({ success: true, sent: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
