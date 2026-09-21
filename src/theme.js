import { createTheme } from "@mantine/core";

// "Ink & Paper" v2 — premium notebook-paper surfaces, fountain-pen ink-violet
// accent, Figtree body, Fraunces serif headings, Caveat for the handwriting
// wordmark/notes. Amber is a highlighter, applied per-component (not the primary).
const inkViolet = [
  "#eeeefc",
  "#dcdcf6",
  "#b6b5ee",
  "#8d8be7",
  "#6c69e0",
  "#5754dc",
  "#4a47d1", // 6 — primary (light)
  "#3d3ab8",
  "#35328f", // 8 — strong
  "#2a2870",
];

export const theme = createTheme({
  colors: { ink: inkViolet },
  primaryColor: "ink",
  primaryShade: { light: 6, dark: 3 },
  defaultRadius: "md",
  fontFamily: "Figtree, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  headings: {
    fontFamily: "Fraunces, Georgia, 'Times New Roman', serif",
    fontWeight: "600",
  },
  cursorType: "pointer",
  shadows: {
    xs: "0 1px 2px rgba(24,24,32,0.05)",
    sm: "0 1px 2px rgba(24,24,32,0.04), 0 8px 24px -12px rgba(24,24,32,0.18)",
    md: "0 2px 6px rgba(24,24,32,0.06), 0 20px 44px -20px rgba(24,24,32,0.28)",
  },
});
