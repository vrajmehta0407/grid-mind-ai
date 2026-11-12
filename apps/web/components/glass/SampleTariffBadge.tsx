import { Info } from "lucide-react";

export function SampleTariffBadge({
  label = "Sample tariff — verify with your electricity provider",
}: {
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100/80 px-3 py-1 text-xs font-medium text-ink border border-violet/20">
      <Info className="h-3.5 w-3.5 text-violet" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
