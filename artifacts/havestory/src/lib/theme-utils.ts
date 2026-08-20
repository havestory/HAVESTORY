type ThemeVars = {
  from: string;
  to: string;
  accent: string;
  primary: string;
  secondary: string;
};

export const THEME_VARS: Record<string, ThemeVars> = {
  "atelier-light": { from: "#2E2721", to: "#9A7654", accent: "#B58A61", primary: "28 18% 16%", secondary: "28 29% 48%" },
  "light-premium": { from: "#2E2721", to: "#9A7654", accent: "#B58A61", primary: "28 18% 16%", secondary: "28 29% 48%" },
  "light-editorial": { from: "#2E2721", to: "#9A7654", accent: "#B58A61", primary: "28 18% 16%", secondary: "28 29% 48%" },
  "havestory-gallery": { from: "#071A2B", to: "#B9D8CC", accent: "#D96F52", primary: "214 64% 10%", secondary: "43 68% 60%" },
  "pink-purple": { from: "#ec4899", to: "#9333ea", accent: "#d946ef", primary: "330 85% 55%", secondary: "270 70% 60%" },
  // Website Editor historically stores this preset as `amber-purple`.
  // Keep both ids mapped so saved settings and live CSS always agree.
  "amber-purple": { from: "#ec4899", to: "#9333ea", accent: "#d946ef", primary: "330 85% 55%", secondary: "270 70% 60%" },
  "blue-indigo": { from: "#3b82f6", to: "#6366f1", accent: "#4f46e5", primary: "217 91% 60%", secondary: "239 84% 67%" },
  "green-teal": { from: "#22c55e", to: "#14b8a6", accent: "#10b981", primary: "142 71% 45%", secondary: "174 72% 40%" },
  "orange-red": { from: "#f97316", to: "#ef4444", accent: "#f59e0b", primary: "25 95% 53%", secondary: "0 84% 60%" },
  "cyan-blue": { from: "#06b6d4", to: "#3b82f6", accent: "#0ea5e9", primary: "186 100% 42%", secondary: "217 91% 60%" },
  "rose-amber": { from: "#f43f5e", to: "#f59e0b", accent: "#fb7185", primary: "350 89% 60%", secondary: "43 96% 56%" },
};

export function applyThemeVars(preset: string) {
  const vars = THEME_VARS[preset] ?? THEME_VARS["atelier-light"];
  const root = document.documentElement;
  root.style.setProperty("--grad-from", vars.from);
  root.style.setProperty("--grad-to", vars.to);
  root.style.setProperty("--grad-accent", vars.accent);
  root.style.setProperty("--primary", vars.primary);
  root.style.setProperty("--secondary", vars.secondary);
}
