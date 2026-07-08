import Image from "next/image";

export function BrilliantMark({ height = 40, className = "" }: { height?: number; className?: string }) {
  // source logo is a wide lockup (410x196) rather than a square icon
  const width = Math.round((410 / 196) * height);
  return (
    <div
      className={`rounded-2xl bg-white flex items-center justify-center shrink-0 overflow-hidden px-2 ${className}`}
      style={{ height, width: width + 16 }}
    >
      <Image
        src="/brilliant-logo.png"
        alt="Brilliant"
        width={width}
        height={height}
        className="object-contain w-full h-full"
        priority
      />
    </div>
  );
}
