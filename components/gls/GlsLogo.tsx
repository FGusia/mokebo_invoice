import Image from "next/image";

export function GlsMark({ height = 40, className = "" }: { height?: number; className?: string }) {
  // source logo is a wide lockup (960x321) rather than a square icon
  const width = Math.round((960 / 321) * height);
  return (
    <div
      className={`rounded-2xl bg-white flex items-center justify-center shrink-0 overflow-hidden px-2 ${className}`}
      style={{ height, width: width + 16 }}
    >
      <Image
        src="/gls-logo.png"
        alt="GLS"
        width={width}
        height={height}
        className="object-contain w-full h-full"
        priority
      />
    </div>
  );
}
