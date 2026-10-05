import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Text color that stays readable on a user-chosen background (status and
 * priority pills): dark text on light colors, white on dark ones (WCAG
 * relative luminance).
 */
export function readableTextOn(hex) {
  const match = typeof hex === "string" && hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return "#ffffff";
  const value = match[1].length === 3 ? match[1].replace(/./g, "$&$&") : match[1];
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(value.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contrast with white vs with slate-900 (#0f172a, luminance ≈ 0.0089).
  return (1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.0589) ? "#ffffff" : "#0f172a";
}
