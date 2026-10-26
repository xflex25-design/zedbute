import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STATUS_LABEL: Record<string, string> = {
  approved: "Approved",
  rejected: "Rejected",
  changes_requested: "Changes Requested",
};

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
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isAdmin = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { submissionId, status, notes } = await req.json();
    if (!submissionId || !status) {
      return new Response(JSON.stringify({ error: "Missing submissionId or status" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sub, error: subErr } = await adminClient
      .from("playlist_submissions")
      .select("id, song_title, artist_id, playlist_id, release_link, artist_name")
      .eq("id", submissionId)
      .single();
    if (subErr) throw subErr;
    if (!sub) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: profile }, { data: playlist }] = await Promise.all([
      adminClient
        .from("profiles")
        .select("email, full_name, artist_name")
        .eq("id", sub.artist_id)
        .single(),
      adminClient
        .from("playlists")
        .select("name")
        .eq("id", sub.playlist_id)
        .single(),
    ]);

    const label = STATUS_LABEL[status] || status;
    const toEmail = profile?.email;
    const name = (profile?.artist_name || profile?.full_name || "Artist")
      .toString()
      .trim();
    const playlistName = playlist?.name || "our playlist";

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("RESEND_FROM") || "ZedBute <noreply@zedbute.com>";

    if (toEmail && resendKey) {
      const noteLine = notes
        ? `\n\nNote from our team:\n${notes}`
        : "";
      const text = `Hi ${name},\n\nYour submission for "${sub.song_title}" to ${playlistName} has been updated to: ${label}.${noteLine}\n\nYou can view your submission status anytime on your ZedBute dashboard.\n\n— The ZedBute Team`;
      const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:560px"><h2 style="color:#F7931E">Submission ${label}</h2><p>Hi ${escapeHtml(
        name
      )},</p><p>Your submission for <strong>"${escapeHtml(
        sub.song_title
      )}"</strong> to <strong>${escapeHtml(
        playlistName
      )}</strong> has been updated to: <strong>${label}</strong>.</p>${
        notes
          ? `<div style="background:#f6f6f6;border-radius:8px;padding:12px;margin:12px 0"><strong>Note from our team:</strong><br/>${escapeHtml(
              notes
            )}</div>`
          : ""
      }<p>You can view your submission status anytime on your ZedBute dashboard.</p><p>— The ZedBute Team</p></div>`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from,
          to: [toEmail],
          subject: `Your ZedBute playlist submission was ${label}`,
          text,
          html,
        }),
      }).catch((e) => console.error("Resend error:", e));
    }

    // In-app notification for the artist
    await adminClient.from("notifications").insert({
      user_id: sub.artist_id,
      title: `Playlist submission ${label}`,
      message: `Your submission for "${sub.song_title}" to ${playlistName} was ${label}.${
        notes ? ` Note: ${notes}` : ""
      }`,
      type: "playlist_status",
    });

    return new Response(JSON.stringify({ success: true }), {
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

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
