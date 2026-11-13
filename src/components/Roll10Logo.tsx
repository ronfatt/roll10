export function Roll10OrbitalIcon({
  className = "h-6 w-auto",
}: {
  className?: string;
}) {
  return (
    <img
      src="/brand/roll10-orbital-icon.png"
      alt="ROLL10 Icon"
      className={`select-none object-contain ${className}`}
    />
  );
}

/**
 * Horizontal brand lockup as required by the visual specification:
 * Left: Orbital steel ball icon
 * Right: Bright metallic silver-white "滚动星球", with "ROLL10" underneath.
 */
export function Roll10BrandCombo({
  className = "",
  showBadge = false,
}: {
  className?: string;
  showBadge?: boolean;
}) {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <img
        src="/brand/roll10-orbital-icon.png"
        alt="ROLL10"
        className="h-[38px] w-auto drop-shadow-[0_2px_12px_rgba(81,231,250,0.35)] shrink-0 object-contain"
      />
      <div className="flex flex-col justify-center leading-none">
        <span className="text-[17px] sm:text-[18px] font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#FFFFFF] via-[#E4EDF5] to-[#B9CADA] drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
          滚动星球
        </span>
        <span className="text-[10.5px] sm:text-[11px] font-black italic tracking-[0.18em] text-transparent bg-clip-text bg-gradient-to-r from-[#FFF0CA] via-[#F2CD7E] to-[#C8A858] mt-0.5 drop-shadow-[0_1px_6px_rgba(242,205,126,0.3)]">
          ROLL10
        </span>
      </div>
    </div>
  );
}

/**
 * Compact subpage header emblem (orbital icon + subpage title)
 */
export function SubpageHeaderTitle({
  title,
  subtitle,
  className = "",
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <img
        src="/brand/roll10-orbital-icon.png"
        alt="ROLL10"
        className="h-7 w-auto drop-shadow-[0_2px_8px_rgba(81,231,250,0.3)] shrink-0 object-contain"
      />
      <div className="min-w-0">
        <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#F4F8FC] leading-none">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[11px] text-[#AAB8C7] mt-1 leading-none">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Top right subpage corner branding: small titanium orbital icon + ROLL10
 */
export function SubpageCornerBranding({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 select-none ${className}`}>
      <img
        src="/brand/roll10-orbital-icon.png"
        alt="ROLL10"
        className="h-5 w-auto object-contain opacity-90 drop-shadow-[0_0_8px_rgba(81,231,250,0.3)]"
      />
      <span className="font-extrabold italic text-[11px] tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#DDE7F2] to-[#88A9C5]">
        ROLL10
      </span>
    </div>
  );
}

export function Roll10Logo({ className = "h-6 w-auto" }: { className?: string }) {
  return (
    <img
      src="/brand/roll10-titanium-full.png"
      alt="ROLL10 滚动星球"
      className={`select-none object-contain ${className}`}
    />
  );
}
