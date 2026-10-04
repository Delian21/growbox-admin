/**
 * Contrast audit for StatusBadge tones, dashboard variance chips, and Panel
 * stat deltas: blends each tint over the real surfaces they sit on, then
 * reports WCAG ratios for both themes. Exits 1 if any pair is below AA for
 * small text (4.5:1).
 *
 * Usage: node scripts/contrast-audit.mjs
 */

// --- token values from design/tokens.css (keep in sync) ---
const LIGHT = {
  background: "#faf9f5",
  card: "#ffffff",
  muted: "#f1f1ea",
  success: "#1f9d55",
  warning: "#e0a410",
  destructive: "#b71c1c",
  accent: "#d97706",
  accentSoft: "#fbeeda",
  mutedForeground: "#616958",
};
const DARK = {
  background: "#141614",
  card: "#1d211e",
  muted: "#262b27",
  success: "#4cc38a",
  warning: "#f0b429",
  destructive: "#ef6c60",
  accent: "#f0a83c",
  accentSoft: "#3d2c12",
  mutedForeground: "#aeb6aa",
};

const hex = (h) => {
  const s = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const toHex = (rgb) =>
  "#" + rgb.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0")).join("");
const blend = (fg, alpha, bg) => {
  const f = hex(fg);
  const b = hex(bg);
  return toHex(f.map((c, i) => c * alpha + b[i] * (1 - alpha)));
};
const lin = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (h) => {
  const [r, g, b] = hex(h).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

// --- candidate tone definitions: [tintSource, alpha, textColor] per theme ---
// Text values are the exact sRGB renders of the Tailwind v4 utilities used in
// StatusBadge (OKLCH from tailwindcss/theme.css), so this audits what ships.
// Surfaces a badge can sit on: card, page background, and muted (row hover/zebra).
const candidates = {
  light: {
    surfaces: { card: LIGHT.card, background: LIGHT.background, muted: LIGHT.muted },
    tones: {
      // green: text-green-900 — white (text-success-foreground) was 1.19:1
      green: [LIGHT.success, 0.15, "#0d542b"],
      // amber: text-warning-foreground (designed dark amber fg)
      amber: [LIGHT.warning, 0.15, "#211802"],
      // red: text-red-900
      red: [LIGHT.destructive, 0.15, "#82181a"],
      // blue: NEW — real blue via chart-4 tint, text-blue-900
      blue: ["#2c7fb8", 0.15, "#1c398e"],
      // gray: muted fg on muted bg (current behaviour, verify)
      gray: [LIGHT.muted, 1, LIGHT.mutedForeground],
    },
  },
  dark: {
    surfaces: { card: DARK.card, background: DARK.background, muted: DARK.muted },
    tones: {
      green: [DARK.success, 0.15, "#5ee9b5"], // dark:text-emerald-300
      amber: [DARK.warning, 0.15, "#fee685"], // dark:text-amber-200
      red: [DARK.destructive, 0.15, "#ffa2a2"], // dark:text-red-300
      blue: ["#6fb3d2", 0.15, "#8ec5ff"], // dark:text-blue-300
      gray: [DARK.muted, 1, DARK.mutedForeground],
    },
  },
};

// Legacy pairs (what ships today) for comparison in the report.
const legacy = {
  light: {
    green: [LIGHT.success, 0.15, "#ffffff"],
    amber: [LIGHT.warning, 0.15, "#211802"],
    red: [LIGHT.destructive, 0.15, LIGHT.destructive],
    blue: [LIGHT.accentSoft, 1, "#ffffff"],
    gray: [LIGHT.muted, 1, LIGHT.mutedForeground],
  },
  dark: {
    green: [DARK.success, 0.15, "#5ee9b5"], // dark:text-emerald-300 override
    amber: [DARK.warning, 0.15, "#fee685"], // dark:text-amber-200 override
    red: [DARK.destructive, 0.15, "#ffa2a2"], // dark:text-red-300 override
    blue: [DARK.accentSoft, 1, "#201403"],
    gray: [DARK.muted, 1, DARK.mutedForeground],
  },
};

// Exact sRGB renders of the Tailwind v4 OKLCH utilities used by the
// dashboard variance chips (StatCard) and Panel stat delta chips.
//   up:   bg-success/10    + text-emerald-800 | dark:text-emerald-300
//   down: bg-destructive/10 + text-destructive | dark:text-red-300
//   flat: bg-muted         + text-muted-foreground (Panel delta "flat")
const CHIP_TEXT = {
  light: { up: "#006045", down: LIGHT.destructive, flat: LIGHT.mutedForeground },
  dark: { up: "#5ee9b5", down: "#ffa2a2", flat: DARK.mutedForeground },
};
const CHIP_BG = {
  light: {
    up: [LIGHT.success, 0.1],
    down: [LIGHT.destructive, 0.1],
    flat: [LIGHT.muted, 1],
  },
  dark: {
    up: [DARK.success, 0.1],
    down: [DARK.destructive, 0.1],
    flat: [DARK.muted, 1],
  },
};

let failed = 0;
for (const theme of ["light", "dark"]) {
  const { surfaces, tones } = candidates[theme];
  console.log(`\n=== ${theme.toUpperCase()} (proposed) — AA small text needs 4.5:1 ===`);
  for (const [tone, [src, alpha, text]] of Object.entries(tones)) {
    const parts = [];
    let worst = Infinity;
    for (const [sName, sColor] of Object.entries(surfaces)) {
      const bg = alpha === 1 && src === sColor ? sColor : blend(src, alpha, sColor);
      const ratio = contrast(text, bg);
      worst = Math.min(worst, ratio);
      parts.push(`${sName}=${ratio.toFixed(2)}:${bg}`);
    }
    const ok = worst >= 4.5;
    if (!ok) failed++;
    console.log(
      `${ok ? "PASS" : "FAIL"} ${tone.padEnd(6)} text=${text}  ${parts.join("  ")}${ok ? "" : `  WORST=${worst.toFixed(2)}`}`,
    );
  }
  console.log(`--- legacy (ships today) ---`);
  for (const [tone, [src, alpha, text]] of Object.entries(legacy[theme])) {
    const worst = Math.min(
      ...Object.values(surfaces).map((s) => contrast(text, blend(src, alpha, s))),
    );
    console.log(`  ${worst >= 4.5 ? "pass" : "BROKEN"} ${tone.padEnd(6)} worst=${worst.toFixed(2)}:1`);
  }

  // Variance chips (StatCard) + Panel stat deltas. The alert card surface is
  // warning/5 over card — chips also render inside amber-framed StatCards.
  console.log(`--- variance chips / panel stat deltas — AA small text needs 4.5:1 ---`);
  const alertSurfaces = {
    ...surfaces,
    alertCard: blend(theme === "light" ? LIGHT.warning : DARK.warning, 0.05, surfaces.card),
  };
  for (const variant of ["up", "down", "flat"]) {
    const [src, alpha] = CHIP_BG[theme][variant];
    const text = CHIP_TEXT[theme][variant];
    let worst = Infinity;
    const parts = [];
    for (const [sName, sColor] of Object.entries(alertSurfaces)) {
      const bg = blend(src, alpha, sColor);
      const ratio = contrast(text, bg);
      worst = Math.min(worst, ratio);
      parts.push(`${sName}=${ratio.toFixed(2)}`);
    }
    const ok = worst >= 4.5;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} ${variant.padEnd(5)} text=${text}  ${parts.join("  ")}${ok ? "" : `  WORST=${worst.toFixed(2)}`}`);
  }
}

console.log(failed === 0 ? "\nALL PROPOSED PAIRS PASS" : `\n${failed} PAIR(S) BELOW AA`);
process.exit(failed === 0 ? 0 : 1);
