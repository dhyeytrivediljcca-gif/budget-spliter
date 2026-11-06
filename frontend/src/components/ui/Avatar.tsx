import React from 'react';
import { clsx } from 'clsx';

interface AvatarProps {
  name: string;
  url?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const PALETTE = [
  '#FFE66D', '#B8F2D0', '#FFB8A2', '#C9D5FF', '#E5D5FF', '#FFD6E7',
];

function getColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % PALETTE.length;
  return PALETTE[Math.abs(hash)];
}

const sizes = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
};

export default function Avatar({ name, url, size = 'md', className }: AvatarProps) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const bg = getColor(name);

  return (
    <div
      className={clsx('avatar', sizes[size], className)}
      style={{ background: url ? undefined : bg }}
      aria-label={name}
    >
      {url ? (
        <img src={url} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span style={{ color: '#292524' }}>{initials}</span>
      )}
    </div>
  );
}
