export default function ProgressSteps({
  current,
  total = 3,
}: {
  current: number;
  total?: number;
}) {
  return (
    <div
      className="flex gap-2"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-label={`Step ${current} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full ${
            i < current ? "bg-brand-cyan" : "bg-white/10"
          }`}
        />
      ))}
    </div>
  );
}
