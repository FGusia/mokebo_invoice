export function MokeboMark({ size = 40 }: { size?: number }) {
  return (
    <div
      className="rounded-2xl bg-mokebo-mint flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <span
        className="font-brand font-extrabold text-mokebo-dark leading-none"
        style={{ fontSize: size * 0.52 }}
      >
        m
      </span>
    </div>
  );
}

export function MokeboWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-brand font-extrabold tracking-tight ${className}`}>
      mokebo
    </span>
  );
}
