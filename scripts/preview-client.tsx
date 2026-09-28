import React from "react";
import { createRoot } from "react-dom/client";
import { BoardSurface as Surface } from "../client/board-view";
const light = new URLSearchParams(location.search).get("theme") === "light";
const colors = light
  ? { surface0: "#ffffff", surface1: "#f4f4f5", surface2: "#e4e4e7", foreground: "#18181b", foregroundMuted: "#52525b", border: "#d4d4d8", accent: "#2563eb", accentForeground: "#ffffff", statusDanger: "#dc2626" }
  : { surface0: "#18181b", surface1: "#27272a", surface2: "#3f3f46", foreground: "#fafafa", foregroundMuted: "#a1a1aa", border: "#3f3f46", accent: "#60a5fa", accentForeground: "#18181b", statusDanger: "#f87171" };
const props = { theme: { colors, mode: light ? "light" : "dark" }, layout: { compact: innerWidth < 700, platform: "web", width: innerWidth, height: innerHeight }, navigation: undefined };
createRoot(document.getElementById("surface")!).render(<Surface {...props} />);
