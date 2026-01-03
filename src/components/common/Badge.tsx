import type { ReactNode } from "react";

type Tone = "emerald" | "amber" | "rose" | "slate" | "blue" | "purple";

const tones: Record<Tone, string> = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  rose: "bg-rose-50 text-rose-700 ring-rose-100",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  purple: "bg-purple-50 text-purple-700 ring-purple-100",
};

export default function Badge({ children, tone = "slate", backgroundColor }: { children: ReactNode; tone?: Tone; backgroundColor?: string }) {
  const style = backgroundColor ? { backgroundColor, color: 'white' } : {};
  const ringColor = backgroundColor ? `ring-1 ring-inset ring-white/20` : tones[tone];

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${ringColor}`}
      style={style}
    >
      {children}
    </span>
  );
}


