import { Fragment } from "react";
import { useNavigate } from "react-router-dom";

const TOKEN_RE = /(@[a-zA-Z0-9_.]{3,30}|#[\p{L}\p{N}_]{2,40}|https?:\/\/[^\s]+)/gu;

interface Props {
  text: string;
  className?: string;
}

/**
 * Renders post / comment text with clickable @mentions, #hashtags and links.
 */
function RichText({ text, className }: Props) {
  const navigate = useNavigate();
  if (!text) return null;

  const parts = text.split(TOKEN_RE);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith("@") && /^@[a-zA-Z0-9_.]{3,30}$/.test(part)) {
          const username = part.slice(1).replace(/\.+$/, "");
          return (
            <a
              key={i}
              className="sc-mention"
              href={`/u/${username}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate(`/u/${username}`);
              }}
            >
              {part}
            </a>
          );
        }
        if (part.startsWith("#") && part.length > 2) {
          return (
            <a
              key={i}
              className="sc-hashtag"
              href={`/search?tab=posts&q=${encodeURIComponent(part)}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate(`/search?tab=posts&q=${encodeURIComponent(part)}`);
              }}
            >
              {part}
            </a>
          );
        }
        if (/^https?:\/\//.test(part)) {
          return (
            <a
              key={i}
              className="sc-link"
              href={part}
              target="_blank"
              rel="noopener noreferrer nofollow"
              onClick={(e) => e.stopPropagation()}
            >
              {part.replace(/^https?:\/\//, "").slice(0, 48)}
              {part.replace(/^https?:\/\//, "").length > 48 ? "…" : ""}
            </a>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </span>
  );
}

export default RichText;
