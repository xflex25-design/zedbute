import React from "react";

const platforms = [
  "Spotify",
  "Apple Music",
  "Boomplay",
  "Deezer",
  "TikTok",
  "YouTube Music",
  "Instagram",
  "Facebook",
  "WhatsApp",
  "Tidal",
  "Amazon Music",
];

export const PlatformLogos = () => {
  return (
    <section className="py-12 sm:py-16 px-4 bg-white text-black border-y border-black/10">
      <div className="container mx-auto max-w-5xl text-center">
        <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-black/70 mb-8">
          Distribute to 150+ platforms including
        </p>

        {/* Platforms graphic card with white background */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-black/10 shadow-lg mb-10 flex flex-col items-center justify-center">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl flex items-center justify-center bg-white p-2">
            <img
              src="/assets/aistudio/BmPGx86Vg6CxYSPgQ5p5HGrAlQ_00f93a26.png"
              alt="Global Music Distribution Platforms"
              loading="lazy"
              className="w-full h-auto object-contain max-h-[450px]"
            />
          </div>
        </div>

        {/* Platform name chips */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 max-w-4xl mx-auto">
          {platforms.map((name) => (
            <span
              key={name}
              className="px-4 py-2 rounded-full text-xs sm:text-sm font-semibold bg-black/5 text-black border border-black/10 shadow-sm hover:bg-black hover:text-white transition-all duration-300"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};
