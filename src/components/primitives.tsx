import type { CSSProperties } from "react";
import type { IconName } from "../app/model";
import type { Song } from "../lib/heapbeat";

export function Icon({ name }: { name: IconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
  };

  switch (name) {
    case "activity":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M4 17V7M9 20V4M14 17V7M19 14v-4" />
        </svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M4 19V5M4 19h16M8 15l3-4 3 2 4-7" />
        </svg>
      );
    case "chevron":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="m8 10 4 4 4-4" />
        </svg>
      );
    case "copy":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M8 8h10v10H8zM6 16H4V4h12v2" />
        </svg>
      );
    case "down":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="m12 19-7-8h4V5h6v6h4l-7 8Z" />
        </svg>
      );
    case "download":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M12 4v10m0 0 4-4m-4 4-4-4M5 20h14" />
        </svg>
      );
    case "external":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M14 5h5v5M10 14 19 5M19 14v5H5V5h5" />
        </svg>
      );
    case "filter":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M4 7h16M7 12h10M10 17h4" />
        </svg>
      );
    case "globe":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle {...common} cx="12" cy="12" r="9" />
          <path
            {...common}
            d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"
          />
        </svg>
      );
    case "info":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            {...common}
            d="M12 17v-5M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
      );
    case "lock":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6z" />
        </svg>
      );
    case "music":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            {...common}
            d="M9 18V5l10-2v13M9 18a3 3 0 1 1-2-2.83M19 16a3 3 0 1 1-2-2.83"
          />
        </svg>
      );
    case "next":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="m6 6 8 6-8 6V6ZM18 6v12" />
        </svg>
      );
    case "pause":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M8 5v14M16 5v14" />
        </svg>
      );
    case "play":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5v14l11-7-11-7Z" fill="currentColor" />
        </svg>
      );
    case "plus":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M12 5v14M5 12h14" />
        </svg>
      );
    case "prev":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="m18 6-8 6 8 6V6ZM6 6v12" />
        </svg>
      );
    case "radio":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            {...common}
            d="M4 11h16v8H4zM8 15h.01M12 15h4M8 11l8-6M7 5l5 4"
          />
        </svg>
      );
    case "repeat":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            {...common}
            d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"
          />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            {...common}
            d="m21 21-4.3-4.3M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"
          />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            {...common}
            d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5ZM19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .3 0 .7.1 1l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 3.1h5l.3-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z"
          />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z" />
          <path {...common} d="m9 12 2 2 4-5" />
        </svg>
      );
    case "shuffle":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            {...common}
            d="M16 3h5v5M4 7h3l10 10h4M21 16v5h-5M4 17h3l3-3M14 7l3-3h4"
          />
        </svg>
      );
    case "trash":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            {...common}
            d="M4 7h16M9 7V5h6v2M9 11v6M15 11v6M6 7l1 13h10l1-13"
          />
        </svg>
      );
    case "up":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="m12 5 7 8h-4v6H9v-6H5l7-8Z" />
        </svg>
      );
    case "user":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            {...common}
            d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0"
          />
        </svg>
      );
    case "users":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            {...common}
            d="M16 20a6 6 0 0 0-12 0M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 20a5 5 0 0 0-5-5M17 11a3 3 0 0 0 0-6"
          />
        </svg>
      );
    case "volume":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M4 10v4h4l5 4V6l-5 4H4ZM17 9a4 4 0 0 1 0 6" />
        </svg>
      );
    case "close":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M18 6 6 18M6 6l12 12" />
        </svg>
      );
    case "logout":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            {...common}
            d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
          />
        </svg>
      );
  }
}

export function IconButton({
  icon,
  label,
  onClick,
  variant = "ghost",
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  variant?: "ghost" | "primary" | "danger" | "selected";
  disabled?: boolean;
}) {
  return (
    <button
      aria-label={label}
      className={`icon-button ${variant} icon-${icon}`}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon name={icon} />
    </button>
  );
}

export function CoverArt({
  song,
  compact = false,
  isPlaying = false,
}: {
  song: Song | null;
  compact?: boolean;
  isPlaying?: boolean;
}) {
  const hasImage = song && song.coverUrl;

  return (
    <div
      aria-hidden="true"
      className={`cover-art ${compact ? "compact" : ""} cover-${
        song?.coverTone ?? "lake"
      } ${isPlaying && !compact ? "spinning" : ""}`}
      style={{ "--song-color": song?.color ?? "#0f766e" } as CSSProperties}
    >
      {hasImage ? (
        <img
          src={song.coverUrl}
          alt=""
          className="cover-art-image"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "inherit",
          }}
        />
      ) : (
        <>
          <span className="cover-sun" />
          <span className="cover-ridge ridge-back" />
          <span className="cover-ridge ridge-front" />
          <span className="cover-water" />
        </>
      )}
      {!compact && <span className="vinyl-center-pin" />}
    </div>
  );
}
