/**
 * Landing page only (`src/app/page.tsx`) — the global <GradientBackground>
 * in ShellModern skips `/` so this doesn't stack underneath it. A light
 * white wash keeps the video ambient rather than a full autoplay clip
 * fighting the white-first UI on top of it.
 */
export function LandingVideoBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-dvh w-screen overflow-hidden bg-background"
    >
      <video
        className="absolute inset-0 h-full w-full object-cover opacity-80"
        src="/video/Landing.mp4"
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="absolute inset-0 bg-white/72" />
    </div>
  );
}
