type Tone = "blue" | "emerald" | "amber" | "rose" | "slate";

const toneMap: Record<Tone, string> = {
  blue: "text-blue-600",
  emerald: "text-emerald-600",
  amber: "text-amber-600",
  rose: "text-rose-600",
  slate: "text-slate-600",
};

export default function StatCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  tone?: Tone;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-sm text-slate-600">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${toneMap[tone]}`}>{value}</div>
    </div>
  );
}


