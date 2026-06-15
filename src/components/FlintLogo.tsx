// Single source of truth for the Flint logo.
// ──────────────────────────────────────────
// HOW TO CHANGE THE LOGO:
//   1. Replace  public/flint-logo.png  with your own image (same filename)
//   2. Rebuild:  npm run build   or   bash install.sh
//   3. The new logo appears everywhere automatically.
//
// No other file needs to change. Every component imports FlintLogo.
// ──────────────────────────────────────────

// Cache buster: evaluated once per page load so the browser/Electron
// always fetches the latest PNG from disk instead of a stale cached copy.
const _t = Date.now();

export function FlintLogo({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <img
      src={`./flint-logo.png?t=${_t}`}
      alt="Flint"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }}
      draggable={false}
    />
  );
}

export function FlintLogoLarge({ size = 64, className }: { size?: number; className?: string }) {
  return (
    <img
      src={`./flint-logo.png?t=${_t}`}
      alt="Flint"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }}
      draggable={false}
    />
  );
}

export default FlintLogo;
