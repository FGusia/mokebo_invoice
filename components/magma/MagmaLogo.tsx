export function MagmaMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-white flex items-center justify-center shrink-0 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 200 205" width={size * 0.72} height={size * 0.72} fill="#111111">
        <path d="M102.90,168.00 L109.10,168.00 L109.10,50.00 L102.90,50.00 Z" transform="rotate(-4.0 106.00 168.00)"/>
        <path d="M90.90,168.00 L97.10,168.00 L97.10,50.00 L90.90,50.00 Z" transform="rotate(4.0 94.00 168.00)"/>
        <path d="M112.50,168.00 L118.70,168.00 L118.70,64.30 L112.50,64.30 Z" transform="rotate(-7.4 115.60 168.00)"/>
        <path d="M81.30,168.00 L87.50,168.00 L87.50,64.30 L81.30,64.30 Z" transform="rotate(7.4 84.40 168.00)"/>
        <path d="M122.10,168.00 L128.30,168.00 L128.30,78.24 L122.10,78.24 Z" transform="rotate(-10.9 125.20 168.00)"/>
        <path d="M71.70,168.00 L77.90,168.00 L77.90,78.24 L71.70,78.24 Z" transform="rotate(10.9 74.80 168.00)"/>
        <path d="M131.70,168.00 L137.90,168.00 L137.90,91.76 L131.70,91.76 Z" transform="rotate(-14.3 134.80 168.00)"/>
        <path d="M62.10,168.00 L68.30,168.00 L68.30,91.76 L62.10,91.76 Z" transform="rotate(14.3 65.20 168.00)"/>
        <path d="M141.30,168.00 L147.50,168.00 L147.50,104.79 L141.30,104.79 Z" transform="rotate(-17.7 144.40 168.00)"/>
        <path d="M52.50,168.00 L58.70,168.00 L58.70,104.79 L52.50,104.79 Z" transform="rotate(17.7 55.60 168.00)"/>
        <path d="M150.90,168.00 L157.10,168.00 L157.10,117.16 L150.90,117.16 Z" transform="rotate(-21.1 154.00 168.00)"/>
        <path d="M42.90,168.00 L49.10,168.00 L49.10,117.16 L42.90,117.16 Z" transform="rotate(21.1 46.00 168.00)"/>
        <path d="M160.50,168.00 L166.70,168.00 L166.70,128.61 L160.50,128.61 Z" transform="rotate(-24.6 163.60 168.00)"/>
        <path d="M33.30,168.00 L39.50,168.00 L39.50,128.61 L33.30,128.61 Z" transform="rotate(24.6 36.40 168.00)"/>
        <path d="M170.10,168.00 L176.30,168.00 L176.30,138.00 L170.10,138.00 Z" transform="rotate(-28.0 173.20 168.00)"/>
        <path d="M23.70,168.00 L29.90,168.00 L29.90,138.00 L23.70,138.00 Z" transform="rotate(28.0 26.80 168.00)"/>
        <text x="100" y="196" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="22" letterSpacing="4">MAGMA</text>
      </svg>
    </div>
  );
}
