export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO
  author: string;
  // Body as array of paragraphs / headings
  body: { type: "p" | "h2" | "ul"; text?: string; items?: string[] }[];
}

export const blogPosts: BlogPost[] = [
  {
    slug: "why-zambian-artists-should-distribute-music-online-in-2026",
    title: "Why Zambian Artists Should Distribute Music Online in 2026",
    description:
      "The Zambian music scene is exploding. Here's why every independent artist in Zambia should be distributing their music online in 2026 — and how to start.",
    date: "2026-05-16",
    author: "ZedBute",
    body: [
      {
        type: "p",
        text: "The Zambian music scene is louder than it has ever been. From Lusaka to the Copperbelt, a new generation of artists is producing world-class music — but talent alone is no longer enough. In 2026, the artists who win are the ones whose music is everywhere their fans are: Spotify, Apple Music, TikTok, YouTube Music, Boomplay and beyond.",
      },
      { type: "h2", text: "1. Your audience is already streaming" },
      {
        type: "p",
        text: "Smartphone and data penetration in Zambia has grown rapidly, and platforms like Spotify and Boomplay are now part of everyday listening. If your music isn't on the platforms your fans use daily, you're invisible — no matter how good the song is.",
      },
      { type: "h2", text: "2. Keep 100% of your royalties" },
      {
        type: "p",
        text: "Old-school record deals took huge cuts from artists. Modern distribution platforms like ZedBute let you upload your music for a flat fee and keep 100% of your streaming royalties. You stay in control of your masters, your art, and your income.",
      },
      { type: "h2", text: "3. Global reach from Lusaka" },
      {
        type: "p",
        text: "Online distribution means a Zambian artist can be discovered by a listener in Lagos, London or Los Angeles on the same day. Playlists, TikTok trends and algorithmic recommendations don't care where you're based — they care about the music.",
      },
      { type: "h2", text: "4. Verified artist profiles build trust" },
      {
        type: "p",
        text: "Being a verified artist on Spotify and Apple Music makes your profile look professional, unlocks artist tools, and signals to fans (and labels) that you're serious. Through ZedBute you can get verified and manage your artist profile properly.",
      },
      { type: "h2", text: "5. Pay in ZMW, no foreign cards needed" },
      {
        type: "p",
        text: "One of the biggest blockers for Zambian artists has been paying international distributors in USD. ZedBute lets you pay in ZMW using Airtel Money, MTN MoMo or card — built for how Zambia actually pays.",
      },
      { type: "h2", text: "What you need to release in 2026" },
      {
        type: "ul",
        items: [
          "A finished, mastered audio file (WAV recommended)",
          "Square cover art, at least 1000x1000px",
          "Your release metadata (artist name, title, genre, release date)",
          "A distribution plan — single, EP or album",
          "A distributor that understands Zambia",
        ],
      },
      { type: "h2", text: "Start releasing today" },
      {
        type: "p",
        text: "If you're a Zambian artist sitting on unreleased music, 2026 is the year to stop waiting. Upload your release on ZedBute, get on every major platform, keep your royalties, and let the world hear what Zambia sounds like.",
      },
    ],
  },
];

export const getPostBySlug = (slug: string) =>
  blogPosts.find((p) => p.slug === slug);
