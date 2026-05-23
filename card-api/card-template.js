export function buildCardHtml({ name, location, photo_url }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tea Party Invitation</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    width: 480px;
    height: 720px;
    overflow: hidden;
    font-family: 'Georgia', 'Times New Roman', serif;
    background: #c8b4d8;
  }

  .card {
    width: 480px;
    height: 720px;
    position: relative;
    background: linear-gradient(160deg, #d4b8e8 0%, #c5a8de 30%, #b89fd4 60%, #c8b0e0 100%);
    overflow: hidden;
  }

  /* Grid lines */
  .grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px);
    background-size: 32px 32px;
  }

  /* Subtle vignette */
  .vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at center, transparent 55%, rgba(80,40,110,0.28) 100%);
  }

  /* ── Top section ── */
  .top-bar {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 108px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding-top: 14px;
    gap: 2px;
    z-index: 10;
  }

  .logo-text {
    font-size: 11px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #3a1a5a;
    font-weight: bold;
    opacity: 0.85;
  }

  .logo-year {
    font-size: 28px;
    font-weight: 900;
    color: #2d0a4a;
    letter-spacing: 2px;
    line-height: 1;
  }

  .logo-sub {
    font-size: 9px;
    letter-spacing: 5px;
    text-transform: uppercase;
    color: #5a2a7a;
    opacity: 0.75;
  }

  /* Floral decorations top */
  .floral-top-left {
    position: absolute;
    top: 6px; left: 8px;
    font-size: 44px;
    opacity: 0.55;
    transform: rotate(-15deg);
    z-index: 5;
  }

  .floral-top-right {
    position: absolute;
    top: 6px; right: 8px;
    font-size: 44px;
    opacity: 0.55;
    transform: rotate(15deg) scaleX(-1);
    z-index: 5;
  }

  /* ── Eiffel Tower ── */
  .eiffel {
    position: absolute;
    bottom: 170px;
    right: 18px;
    z-index: 5;
    opacity: 0.22;
  }

  .eiffel svg {
    width: 56px;
    height: 110px;
    fill: #2d0a4a;
  }

  /* ── Photo circle ── */
  .photo-wrapper {
    position: absolute;
    top: 118px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 20;
  }

  .photo-ring-outer {
    width: 228px;
    height: 228px;
    border-radius: 50%;
    background: linear-gradient(135deg, #f5e6d3 0%, #d4956a 40%, #c17a45 70%, #a0522d 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 6px 32px rgba(80,30,120,0.35), 0 2px 8px rgba(0,0,0,0.2);
  }

  .photo-ring-inner {
    width: 208px;
    height: 208px;
    border-radius: 50%;
    background: #f0d9c0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .photo-ring-inner img {
    width: 208px;
    height: 208px;
    border-radius: 50%;
    object-fit: cover;
    object-position: center top;
  }

  /* Fallback avatar when no photo */
  .photo-fallback {
    width: 208px;
    height: 208px;
    border-radius: 50%;
    background: linear-gradient(135deg, #e8d0f0, #c9a8e0);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 80px;
  }

  /* ── Floral side decorations ── */
  .floral-left {
    position: absolute;
    top: 148px;
    left: 10px;
    font-size: 36px;
    opacity: 0.6;
    z-index: 8;
    line-height: 1.3;
  }

  .floral-right {
    position: absolute;
    top: 148px;
    right: 10px;
    font-size: 36px;
    opacity: 0.6;
    z-index: 8;
    line-height: 1.3;
    text-align: right;
  }

  /* ── Name banner ── */
  .name-banner {
    position: absolute;
    top: 352px;
    left: 0; right: 0;
    background: #111111;
    padding: 10px 32px;
    text-align: center;
    z-index: 25;
  }

  .name-text {
    color: #ffffff;
    font-size: 22px;
    font-weight: bold;
    letter-spacing: 2px;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Location bar ── */
  .location-bar {
    position: absolute;
    top: 400px;
    left: 0; right: 0;
    background: #e87722;
    padding: 7px 32px;
    text-align: center;
    z-index: 25;
  }

  .location-text {
    color: #ffffff;
    font-size: 13px;
    font-weight: bold;
    letter-spacing: 3px;
    text-transform: uppercase;
  }

  /* ── Middle decorative strip ── */
  .divider {
    position: absolute;
    top: 432px;
    left: 20px; right: 20px;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(80,30,120,0.4), transparent);
    z-index: 10;
  }

  /* ── Teacup & teapot illustrations ── */
  .teaware {
    position: absolute;
    top: 444px;
    left: 0; right: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 18px;
    z-index: 15;
    font-size: 38px;
  }

  .tea-small {
    font-size: 26px;
    opacity: 0.75;
  }

  /* ── Floral bottom strip ── */
  .floral-bottom {
    position: absolute;
    top: 496px;
    left: 0; right: 0;
    text-align: center;
    font-size: 24px;
    letter-spacing: 8px;
    opacity: 0.55;
    z-index: 10;
  }

  /* ── Bottom title section ── */
  .bottom-section {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 178px;
    background: linear-gradient(180deg, rgba(160,100,210,0.0) 0%, rgba(100,50,160,0.15) 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    z-index: 20;
  }

  .le-the {
    font-size: 52px;
    font-weight: 900;
    color: #1a0030;
    letter-spacing: 6px;
    font-style: italic;
    line-height: 1;
    text-shadow: 0 2px 8px rgba(255,255,255,0.3);
  }

  .le-the-accent {
    font-size: 13px;
    color: #5a2a7a;
    letter-spacing: 8px;
    text-transform: uppercase;
    opacity: 0.8;
  }

  .invite-text {
    font-size: 14px;
    color: #3a1060;
    letter-spacing: 3px;
    font-style: italic;
    opacity: 0.9;
    margin-top: 4px;
  }

  .bottom-florals {
    position: absolute;
    bottom: 8px;
    left: 0; right: 0;
    text-align: center;
    font-size: 18px;
    letter-spacing: 12px;
    opacity: 0.4;
  }
</style>
</head>
<body>
<div class="card">
  <div class="grid"></div>
  <div class="vignette"></div>

  <!-- Floral corners top -->
  <div class="floral-top-left">🌸</div>
  <div class="floral-top-right">🌸</div>

  <!-- Logo -->
  <div class="top-bar">
    <div class="logo-text">Clay Cup</div>
    <div class="logo-year">2026</div>
    <div class="logo-sub">Édition Spéciale</div>
  </div>

  <!-- Side florals -->
  <div class="floral-left">🌷<br>🌿<br>🪷</div>
  <div class="floral-right">🌷<br>🌿<br>🪷</div>

  <!-- Eiffel Tower SVG -->
  <div class="eiffel">
    <svg viewBox="0 0 100 200" xmlns="http://www.w3.org/2000/svg">
      <!-- Base legs -->
      <polygon points="10,200 35,120 50,130 65,120 90,200" />
      <!-- Lower arch left -->
      <path d="M14,180 Q32,155 50,160 Q68,155 86,180" fill="none" stroke-width="6" stroke="currentColor" stroke-linecap="round"/>
      <!-- First platform -->
      <rect x="28" y="115" width="44" height="8" rx="2"/>
      <!-- Middle section -->
      <polygon points="28,115 35,68 50,72 65,68 72,115"/>
      <!-- Upper arch -->
      <path d="M32,105 Q50,92 68,105" fill="none" stroke-width="5" stroke="currentColor" stroke-linecap="round"/>
      <!-- Second platform -->
      <rect x="34" y="62" width="32" height="7" rx="2"/>
      <!-- Upper section -->
      <polygon points="34,62 42,30 50,34 58,30 66,62"/>
      <!-- Top platform -->
      <rect x="40" y="26" width="20" height="6" rx="2"/>
      <!-- Spire -->
      <polygon points="40,26 50,0 60,26"/>
      <!-- Antenna -->
      <line x1="50" y1="0" x2="50" y2="-8" stroke="currentColor" stroke-width="3"/>
    </svg>
  </div>

  <!-- Photo -->
  <div class="photo-wrapper">
    <div class="photo-ring-outer">
      <div class="photo-ring-inner">
        ${photo_url
          ? `<img src="${photo_url}" alt="${name}" onerror="this.parentNode.innerHTML='<div class=\\"photo-fallback\\">👤</div>'">`
          : `<div class="photo-fallback">👤</div>`}
      </div>
    </div>
  </div>

  <!-- Name banner -->
  <div class="name-banner">
    <div class="name-text">${name}</div>
  </div>

  <!-- Location bar -->
  <div class="location-bar">
    <div class="location-text">📍 ${location}</div>
  </div>

  <div class="divider"></div>

  <!-- Teaware -->
  <div class="teaware">
    <span class="tea-small">🌹</span>
    <span>🫖</span>
    <span>☕</span>
    <span>🌹</span>
  </div>

  <!-- Floral strip -->
  <div class="floral-bottom">✿ ❀ ✿ ❀ ✿</div>

  <!-- Bottom title -->
  <div class="bottom-section">
    <div class="le-the">Le Thé</div>
    <div class="le-the-accent">· · · Invitation · · ·</div>
    <div class="invite-text">Vous êtes invitée</div>
    <div class="bottom-florals">🌸 🌷 🌸 🌷 🌸</div>
  </div>
</div>
</body>
</html>`;
}
