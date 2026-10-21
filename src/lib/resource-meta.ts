import type { Tone } from "@/components/cards";
import type { ContentType } from "./constants";

// Drive අන්තර්ගත වර්ග සඳහා සංකේත සහ වර්ණ (සිසුන්ගේ dashboard සහ පාඩම් පිටුව)
export const RESOURCE_ICON: Record<ContentType, string> = {
  TEXTBOOK: "📘",
  WORKBOOK: "📒",
  TUTE: "📄",
  ESSAY: "✍️",
  NOTE: "📎",
  RECORDING: "🎬",
  PAST_PAPER: "📝",
  MODEL_PAPER: "🧪",
};

export const RESOURCE_TONE: Record<ContentType, { tile: string; chip: string }> = {
  TUTE: { tile: "bg-primary text-white", chip: "bg-primary-soft text-primary" },
  NOTE: { tile: "bg-sun text-navy", chip: "bg-sun-soft text-navy" },
  PAST_PAPER: { tile: "bg-navy text-white", chip: "bg-navy/10 text-navy" },
  MODEL_PAPER: { tile: "bg-accent text-white", chip: "bg-accent-soft text-accent" },
  TEXTBOOK: { tile: "bg-primary-soft text-primary", chip: "bg-primary-soft text-primary" },
  WORKBOOK: { tile: "bg-primary-soft text-primary", chip: "bg-primary-soft text-primary" },
  ESSAY: { tile: "bg-sun-soft text-navy", chip: "bg-sun-soft text-navy" },
  RECORDING: { tile: "bg-accent-soft text-accent", chip: "bg-accent-soft text-accent" },
};

// card වල වර්ණ (විචිත්‍ර gradient card පද්ධතිය)
export const RESOURCE_COLOR: Record<ContentType, Tone> = {
  TUTE: "blue",
  TEXTBOOK: "sun",
  WORKBOOK: "cyan",
  ESSAY: "violet",
  NOTE: "green",
  RECORDING: "red",
  PAST_PAPER: "blue",
  MODEL_PAPER: "violet",
};
