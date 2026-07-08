import Image from "next/image";

export function ProcontourMark({ height = 40, className = "" }: { height?: number; className?: string }) {
  // source logo is a wide lockup (262x53) rather than a square icon
  const width = Math.round((262 / 53) * height);
  return (
    <div
      className={`rounded-2xl bg-white flex items-center justify-center shrink-0 overflow-hidden px-3 ${className}`}
      style={{ height, width: width + 24 }}
    >
      <Image
        src="/procontour-logo.png"
        alt="Procontour"
        width={width}
        height={height}
        className="object-contain w-full h-full"
        priority
      />
    </div>
  );
}
