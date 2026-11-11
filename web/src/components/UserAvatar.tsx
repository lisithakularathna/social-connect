import { useState } from "react";

interface Props {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  onClick?: () => void;
}

/** Round avatar with an initial-letter fallback when there's no/broken image. */
function UserAvatar({ src, name, size = 44, className = "", onClick }: Props) {
  const [broken, setBroken] = useState(false);
  const initial = (name || "U").trim().charAt(0).toUpperCase() || "U";

  return (
    <div
      className={`sc-avatar ${onClick ? "sc-avatar-clickable" : ""} ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      onClick={onClick}
      aria-hidden={!onClick}
    >
      {src && !broken ? (
        <img src={src} alt="" onError={() => setBroken(true)} />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

export default UserAvatar;
