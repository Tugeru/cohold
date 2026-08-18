'use client';

import Image from 'next/image';

interface BrandMarkProps extends React.ComponentProps<'div'> {
  /** logo size in px; the gradient wrapper adds 12px of padding */
  size?: number;
}

export function BrandMark({ size = 40, className = '', ...props }: BrandMarkProps) {
  return (
    <div
      className={`flex-shrink-0 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-1.5 shadow-md shadow-emerald-500/30 group-hover:scale-105 transition-transform ${className}`}
      {...props}
    >
      <Image
        src="/logo.png"
        alt="Cohold"
        width={size}
        height={size}
        className="block rounded-[7px] bg-white"
      />
    </div>
  );
}
