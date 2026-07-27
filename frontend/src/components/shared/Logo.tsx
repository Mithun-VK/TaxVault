import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  variant?: 'default' | 'light';
  size?: number;
}

export function Logo({
  className,
  showWordmark = true,
  variant = 'default',
  size = 32,
}: LogoProps) {
  const isLight = variant === 'light';
  const shieldFill = isLight ? '#FFFFFF' : '#1A3C6E';
  const monogram = isLight ? '#1A3C6E' : '#FFFFFF';

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M20 2.5 35 8.5v10c0 9.6-6.3 16.7-15 19-8.7-2.3-15-9.4-15-19v-10L20 2.5Z"
          fill={shieldFill}
        />
        <text
          x="20"
          y="25"
          textAnchor="middle"
          fontFamily="Inter, sans-serif"
          fontSize="13"
          fontWeight="700"
          fill={monogram}
          letterSpacing="-0.5"
        >
          TV
        </text>
      </svg>
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span
            className={cn(
              'text-lg font-bold tracking-tight',
              isLight ? 'text-white' : 'text-brand-navy',
            )}
          >
            TaxVault
          </span>
          <span
            className={cn(
              'text-2xs font-medium uppercase tracking-widest',
              isLight ? 'text-white/60' : 'text-text-muted',
            )}
          >
            Asset Management
          </span>
        </div>
      )}
    </div>
  );
}
