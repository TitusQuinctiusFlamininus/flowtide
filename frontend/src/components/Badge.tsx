import { ThemePalette } from "../theme/themes";

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        background: color + "22",
        color,
        border: `1px solid ${color}55`,
        borderRadius: 4,
        padding: "1px 7px",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.4,
      }}
    >
      {label}
    </span>
  );
}

export function FlowtideMark({ theme }: { theme: ThemePalette }) {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        background: `linear-gradient(135deg, ${theme === undefined ? "#0f172a" : "#0f172a"} 0%, #1e293b 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "flowtide-mark 3s ease-in-out infinite",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: 20,
          fontWeight: 800,
          background: "linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        ⚡
      </span>
    </div>
  );
}
