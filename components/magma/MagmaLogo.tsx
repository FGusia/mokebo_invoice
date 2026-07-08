import Image from "next/image";

export function MagmaMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-white flex items-center justify-center shrink-0 overflow-hidden p-1.5 ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/magma-logo.png"
        alt="Magma"
        width={size}
        height={size}
        className="object-contain w-full h-full"
        priority
      />
    </div>
  );
}
