export const colors = {
  bg: "#0c1210",
  elevated: "#141c18",
  fg: "#f2f5f0",
  muted: "#8a968c",
  /** Matches web --line: rgba(242, 245, 240, 0.12) */
  line: "rgba(242, 245, 240, 0.12)",
  accent: "#d6ff4b",
  accentInk: "#0c1210",
  danger: "#ff6b5a",
  limeGlow: "rgba(214, 255, 75, 0.08)",
  greenGlow: "rgba(90, 140, 110, 0.18)",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  section: 40,
};

export function eventKindLabel(kind: string): string {
  switch (kind) {
    case "game":
      return "Game";
    case "tournament":
      return "Tournament";
    case "bet":
      return "Bet";
    default:
      return kind;
  }
}
