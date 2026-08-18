'use client';

import Image from 'next/image';

const LOGO_SIZE = 40;

export function BrandMark({ className = '', ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={`flex-shrink-0 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-1.5 shadow-md shadow-emerald-500/30 group-hover:scale-105 transition-transform ${className}`}
      {...props}
    >
      <Image
        src="/logo.png"
        alt="Cohold"
        width={LOGO_SIZE}
        height={LOGO_SIZE}
        className="block rounded-[7px] bg-white"
      />
    </div>
  );
}