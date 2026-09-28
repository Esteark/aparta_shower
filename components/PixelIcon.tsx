export type PixelIconType = "plus" | "plant" | "sofa" | "window";

function renderShape(type: PixelIconType, color: string) {
  switch (type) {
    case "plus":
      return (
        <>
          <rect x="10" y="2" width="4" height="20" />
          <rect x="2" y="10" width="20" height="4" />
        </>
      );
    case "plant":
      return (
        <>
          <rect x="7" y="17" width="10" height="5" />
          <rect x="10" y="6" width="2" height="12" />
          <rect x="6" y="9" width="2" height="9" />
          <rect x="14" y="9" width="2" height="9" />
        </>
      );
    case "sofa":
      return (
        <>
          <rect x="1" y="10" width="4" height="10" />
          <rect x="19" y="10" width="4" height="10" />
          <rect x="3" y="7" width="18" height="6" />
          <rect x="3" y="13" width="18" height="7" />
        </>
      );
    case "window":
      return (
        <>
          <rect x="2" y="2" width="20" height="20" fill="none" stroke={color} strokeWidth="2" />
          <rect x="11" y="2" width="2" height="20" />
          <rect x="2" y="11" width="20" height="2" />
        </>
      );
  }
}

export default function PixelIcon({
  type,
  color,
  size = 32,
  className,
  style,
}: {
  type: PixelIconType;
  color: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
      focusable="false"
    >
      {renderShape(type, color)}
    </svg>
  );
}
