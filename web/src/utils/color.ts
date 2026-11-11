/**
 * Pick dark or light text for a background colour so text posts stay readable
 * whatever background the author chose.
 */
export function readableTextColor(background?: string | null): string {
  const hex = (background || "").trim().replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex.split("").map((c) => c + c).join("")
      : hex.length === 6
        ? hex
        : null;
  if (!full || !/^[0-9a-fA-F]{6}$/.test(full)) return "#111827";

  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contrast against near-black (#111827, L≈0.012) vs white (L=1).
  const contrastDark = (luminance + 0.05) / (0.012 + 0.05);
  const contrastLight = 1.05 / (luminance + 0.05);
  return contrastDark >= contrastLight ? "#111827" : "#ffffff";
}
