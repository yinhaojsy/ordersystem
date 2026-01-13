import type { ReactNode } from "react";

type Tone = "emerald" | "amber" | "rose" | "slate" | "blue" | "purple" | "orange";

const tones: Record<Tone, string> = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  rose: "bg-rose-50 text-rose-700 ring-rose-100",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  purple: "bg-purple-50 text-purple-700 ring-purple-100",
  orange: "bg-orange-50 text-orange-700 ring-orange-100",
};

// Convert hex color to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Convert RGB to hex
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Lighten a color (similar to Tailwind's -50 shades)
function lightenColor(hex: string, amount: number = 0.95): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const r = Math.round(rgb.r + (255 - rgb.r) * amount);
  const g = Math.round(rgb.g + (255 - rgb.g) * amount);
  const b = Math.round(rgb.b + (255 - rgb.b) * amount);

  return rgbToHex(r, g, b);
}

// Darken a color for text (similar to Tailwind's -700 shades)
function darkenColor(hex: string, amount: number = 0.3): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const r = Math.round(rgb.r * amount);
  const g = Math.round(rgb.g * amount);
  const b = Math.round(rgb.b * amount);

  return rgbToHex(r, g, b);
}

export default function Badge({
  children,
  tone = "slate",
  backgroundColor,
  lightStyle = false,
  onRemove,
}: {
  children: ReactNode;
  tone?: Tone;
  backgroundColor?: string;
  lightStyle?: boolean;
  onRemove?: () => void;
}) {
  let style: React.CSSProperties = {};
  let ringColor: string;

  if (backgroundColor) {
    if (lightStyle) {
      // Light style: light background with dark text (like flex order tags)
      const lightBg = lightenColor(backgroundColor, 0.95);
      const darkText = darkenColor(backgroundColor, 0.95);
      const ringColorValue = lightenColor(backgroundColor, 0.3);
      style = {
        backgroundColor: lightBg,
        color: darkText,
        
      };
      ringColor = `ring-1 ring-inset`;
      // Use box-shadow for ring effect with custom color
      const rgb = hexToRgb(ringColorValue);
      if (rgb) {
        style.boxShadow = `inset 0 0 0 1px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`;
      }
    } else {
      // Original style: solid background with white text
      style = { backgroundColor, color: "white" };
      ringColor = `ring-1 ring-inset ring-white/20`;
    }
  } else {
    ringColor = tones[tone];
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${ringColor} ${onRemove ? 'pr-1' : ''}`}
      style={style}
    >
      {children}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 rounded-full p-0.5 hover:bg-black/10 focus:outline-none focus:ring-1 focus:ring-white/50"
          aria-label="Remove"
        >
          <svg
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </span>
  );
}


