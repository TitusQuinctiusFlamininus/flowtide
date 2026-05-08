import { useEffect, useRef, useState } from "react";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TelemetryEvent {
  id?: number;
  timestamp: number;
  path: string;
  filename: string;
  language: string;
  category: "test" | "production" | "checkpoint";
  test_name: string;
  cycle: number;
  loc_added: number;
  loc_removed: number;
  loc_total: number;
  functions: number;
  conditionals: number;
  classes: number;
  complexity: number;
  tests_passed: number;
  tests_failed: number;
  tests_total: number;
  new_tests: string[];
  test_loc_added?: number;
  test_loc_removed?: number;
  test_loc_total?: number;
  test_functions?: number;
  test_conditionals?: number;
  test_classes?: number;
  test_complexity?: number;
  prod_loc_added?: number;
  prod_loc_removed?: number;
  prod_loc_total?: number;
  prod_functions?: number;
  prod_conditionals?: number;
  prod_classes?: number;
  prod_complexity?: number;
  test_file_count?: number;
  prod_file_count?: number;
  halstead_volume?: number;
  maintainability_index?: number;
  nesting_depth?: number;
  max_params?: number;
  test_halstead_volume?: number;
  test_maintainability_index?: number;
  test_nesting_depth?: number;
  test_max_params?: number;
  prod_halstead_volume?: number;
  prod_maintainability_index?: number;
  prod_nesting_depth?: number;
  prod_max_params?: number;
  tests_duration_ms?: number;
}

interface ChartPoint {
  cycle: number;
  complexity: number;
  loc_added: number;
  loc_removed: number;
  loc_total: number;
  functions: number;
  conditionals: number;
  classes: number;
  file_count: number;
  pass_rate: number;
  halstead_volume: number;
  maintainability_index: number;
  nesting_depth: number;
  max_params: number;
  tests_duration_ms: number;
  test_ratio: number;
}

interface ChartData {
  test: ChartPoint[];
  production: ChartPoint[];
}

interface SnapshotMessage {
  type: "snapshot";
  events: TelemetryEvent[];
}

type ThemeMode = "dark" | "light";

interface ThemePalette {
  appBg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderSoft: string;
  text: string;
  textMuted: string;
  textFaint: string;
  titleColor: string;
}

const THEMES: Record<ThemeMode, ThemePalette> = {
  dark: {
    appBg: "#0f172a",
    surface: "#1e293b",
    surfaceAlt: "#0b1220",
    border: "#334155",
    borderSoft: "#1e293b",
    text: "#f1f5f9",
    textMuted: "#94a3b8",
    textFaint: "#64748b",
    titleColor: "#fbbf24",
  },
  light: {
    appBg: "#f8fafc",
    surface: "#ffffff",
    surfaceAlt: "#f1f5f9",
    border: "#cbd5e1",
    borderSoft: "#e2e8f0",
    text: "#0f172a",
    textMuted: "#334155",
    textFaint: "#64748b",
    titleColor: "#1e293b",
  },
};

const COLORS = {
  complexity: "#f59e0b",
  loc_added: "#3b82f6",
  loc_total: "#14b8a6",
  functions: "#ef4444",
};

const METRICS_CONFIG = [
  { key: "complexity",   label: "Complexity",    color: "#f59e0b", defaultOn: true,  prodOnly: true },
  { key: "loc_added",    label: "LOC Added",     color: "#3b82f6", defaultOn: true  },
  { key: "loc_total",    label: "Total LOC",     color: "#14b8a6", defaultOn: true  },
  { key: "functions",    label: "Functions",     color: "#ef4444", defaultOn: true,  prodOnly: true },
  { key: "conditionals", label: "Conditionals",  color: "#a855f7", defaultOn: false, prodOnly: true },
  { key: "classes",      label: "Classes",       color: "#06b6d4", defaultOn: false, prodOnly: true },
  { key: "loc_removed",  label: "LOC Removed",   color: "#f97316", defaultOn: false },
  { key: "file_count",   label: "Files Changed", color: "#84cc16", defaultOn: false },
  { key: "pass_rate",              label: "Pass Rate %",          color: "#10b981", defaultOn: false, testOnly: true  },
  { key: "halstead_volume",        label: "Halstead Volume",      color: "#6366f1", defaultOn: false, prodOnly: true  },
  { key: "maintainability_index",  label: "Maintainability (MI)", color: "#22c55e", defaultOn: false, prodOnly: true  },
  { key: "nesting_depth",          label: "Nesting Depth",        color: "#f43f5e", defaultOn: false, prodOnly: true  },
  { key: "max_params",             label: "Max Params",           color: "#fb923c", defaultOn: false, prodOnly: true  },
  { key: "tests_duration_ms",      label: "Test Duration (ms)",   color: "#e879f9", defaultOn: false, testOnly: true  },
  { key: "test_ratio",             label: "Test/Prod Ratio ×100", color: "#fbbf24", defaultOn: false, testOnly: true  },
] as const;

type MetricKey = (typeof METRICS_CONFIG)[number]["key"];

const APP_VERSION = "1.0.0";
const CURRENT_YEAR = new Date().getFullYear();
const CHART_HEIGHT = 320;

const CATEGORY_COLORS: Record<string, string> = {
  test: "#6366f1",
  production: "#10b981",
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString();
}

function Badge({ label, color }: { label: string; color: string }) {
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

function FlowtideMark({ theme }: { theme: ThemePalette }) {
  const isDark = theme.appBg === "#0f172a";
  const frame = isDark ? "#1e293b" : "#e2e8f0";
  const orb = isDark ? "#fde047" : "#334155";

  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 14,
        display: "grid",
        placeItems: "center",
        background: `linear-gradient(145deg, ${theme.surfaceAlt}, ${theme.surface})`,
        border: `1px solid ${frame}`,
        boxShadow: isDark ? "0 14px 28px rgba(0, 0, 0, 0.28)" : "0 12px 24px rgba(15, 23, 42, 0.08)",
        flexShrink: 0,
        animation: "flowtide-mark 8s ease-in-out infinite",
        transformOrigin: "50% 50%",
        willChange: "transform, box-shadow, filter",
      }}
    >
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
        <polygon points="15,2.5 26,9 26,21 15,27.5 4,21 4,9" stroke={theme.titleColor} strokeWidth="1.8" />
        <polygon points="15,7 21.5,11 21.5,19 15,23 8.5,19 8.5,11" fill={theme.titleColor} opacity="0.18" />
        <circle cx="15" cy="15" r="4.2" fill={orb} />
      </svg>
    </div>
  );
}

function EventCard({ event, index, theme, isLatest }: { event: TelemetryEvent; index: number; theme: ThemePalette; isLatest?: boolean }) {
  const catColor = CATEGORY_COLORS[event.category] ?? "#94a3b8";
  const hasTestData = event.tests_total > 0;
  const hasFailures = event.tests_failed > 0;

  const cycleTint = hasTestData
    ? hasFailures
      ? themeModeAwareColor(theme, "warning", isLatest)
      : themeModeAwareColor(theme, "success", isLatest)
    : theme.surface;

  const cycleBorder = hasTestData
    ? hasFailures
      ? themeModeAwareColor(theme, "warningBorder", isLatest)
      : themeModeAwareColor(theme, "successBorder", isLatest)
    : theme.border;

  return (
    <div
      style={{
        background: cycleTint,
        border: `1px solid ${isLatest ? (event.tests_failed > 0 ? "#ef4444" : "#10b981") : cycleBorder}`,
        borderRadius: 8,
        padding: "10px 14px",
        marginBottom: 8,
        transition: "border-color 0.2s",
        boxShadow: isLatest ? `0 0 0 2px ${event.tests_failed > 0 ? "#ef444430" : "#10b98130"}` : undefined,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontWeight: 700, color: theme.text, fontSize: isLatest ? 16 : 13, display: "flex", alignItems: "center", gap: 6 }}>
          {isLatest && (
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: event.tests_failed > 0 ? "#f97316" : "#10b981",
                animation: "pulse-dot 1.4s ease-in-out infinite",
                flexShrink: 0,
              }}
            />
          )}
          Cycle #{event.cycle}
        </span>
        <span style={{ color: theme.textFaint, fontSize: 11 }}>{formatTime(event.timestamp)}</span>
      </div>

      {/* Test name */}
      <div style={{ marginBottom: 3 }}>
        <span style={{ color: theme.textFaint, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6 }}>Test / Module</span>
        <div style={{ color: theme.text, fontSize: 13, fontWeight: 600, marginTop: 1 }}>
          {event.test_name || "—"}
        </div>
      </div>

      {/* File name */}
      <div style={{ marginBottom: 7 }}>
        <span style={{ color: theme.textFaint, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6 }}>File</span>
        <div style={{ color: theme.textMuted, fontSize: 11, fontFamily: "monospace", marginTop: 1, wordBreak: "break-all" }}>
          {event.filename}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 7 }}>
        <Badge label={event.category} color={catColor} />
        <Badge label={event.language} color="#38bdf8" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
        {[
          { label: "+LOC", value: event.loc_added, color: COLORS.loc_added },
          { label: "Total", value: event.loc_total, color: COLORS.loc_total },
          { label: "Cmplx", value: event.complexity, color: COLORS.complexity },
          { label: "Fns", value: event.functions, color: COLORS.functions },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: "center", background: theme.surfaceAlt, borderRadius: 5, padding: "4px 2px" }}>
            <div style={{ color, fontSize: 14, fontWeight: 700 }}>{value}</div>
            <div style={{ color: theme.textFaint, fontSize: 10 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function themeModeAwareColor(theme: ThemePalette, kind: "success" | "warning" | "successBorder" | "warningBorder", isLatest = false) {
  const isDark = theme.appBg === "#0f172a";
  if (kind === "success") return isDark ? (isLatest ? "#14532d" : "#123524") : (isLatest ? "#dcfce7" : "#ecfdf5");
  if (kind === "warning") return isDark ? (isLatest ? "#5c0a16" : "#3d0910") : (isLatest ? "#fecaca" : "#fee2e2");
  if (kind === "successBorder") return isDark ? (isLatest ? "#4ade80" : "#22c55e") : (isLatest ? "#22c55e" : "#86efac");
  /* warningBorder */ return isDark ? (isLatest ? "#f87171" : "#ef4444") : (isLatest ? "#ef4444" : "#fca5a5");
}

function CustomTooltip({ active, payload, label, theme }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
      <div style={{ color: theme.textMuted, marginBottom: 4 }}>Cycle #{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

function MetricsChart({
  title,
  accentColor,
  data,
  emptyLabel,
  theme,
  chartKind,
}: {
  title: string;
  accentColor: string;
  data: ChartPoint[];
  emptyLabel: string;
  theme: ThemePalette;
  chartKind: "test" | "production";
}) {
  const availableMetrics = METRICS_CONFIG.filter(
    (m) => (chartKind === "test" ? !(m as any).prodOnly : !(m as any).testOnly)
  );
  const [visible, setVisible] = useState<Set<MetricKey>>(
    () => new Set(availableMetrics.filter((m) => m.defaultOn).map((m) => m.key))
  );

  function toggleMetric(key: MetricKey) {
    setVisible((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const isDark = theme.appBg === "#0f172a";

  return (
    <div
      style={{
        background: theme.surface,
        border: `1px solid ${accentColor}33`,
        borderRadius: 10,
        padding: "16px 12px 8px",
      }}
    >
      {/* Header row */}
      <div
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: theme.appBg === "#0f172a" ? "#fbbf24" : "#374151",
          marginBottom: 10,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {title}
        <span style={{ marginLeft: "auto", color: theme.textFaint, fontWeight: 400, fontSize: 11 }}>
          {data.length} point{data.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Metric toggle pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
        {availableMetrics.map((m) => {
          const on = visible.has(m.key);
          return (
            <button
              key={m.key}
              onClick={() => toggleMetric(m.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 8px",
                fontSize: 10,
                fontWeight: 600,
                borderRadius: 12,
                border: `1px solid ${on ? m.color : (isDark ? "#334155" : "#cbd5e1")}`,
                background: on ? `${m.color}22` : "transparent",
                color: on ? m.color : theme.textFaint,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: on ? m.color : (isDark ? "#475569" : "#94a3b8"),
                  flexShrink: 0,
                }}
              />
              {m.label}
            </button>
          );
        })}
      </div>

      {data.length === 0 ? (
        <div style={{ height: CHART_HEIGHT, display: "flex", alignItems: "center", justifyContent: "center", color: theme.textFaint, fontSize: 13 }}>
          {emptyLabel}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={data} margin={{ top: 4, right: 12, left: 12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.borderSoft} />
            <XAxis
              dataKey="cycle"
              label={{ value: "Cycle", position: "insideBottomRight", offset: -8, fill: theme.textFaint, fontSize: 10 }}
              tick={{ fill: theme.textFaint, fontSize: 10 }}
              stroke={theme.border}
            />
            <YAxis
              label={{ value: "Count", angle: -90, position: "left", offset: 4, fill: theme.textFaint, fontSize: 10 }}
              tick={{ fill: theme.textFaint, fontSize: 10 }}
              stroke={theme.border}
              width={52}
            />
            <Tooltip content={<CustomTooltip theme={theme} />} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: theme.textMuted }} />
            {availableMetrics.map((m) =>
              visible.has(m.key) ? (
                <Line
                  key={m.key}
                  type="monotone"
                  dataKey={m.key}
                  name={m.label}
                  stroke={m.color}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              ) : null
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function App() {
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [chartData, setChartData] = useState<ChartData>({ test: [], production: [] });
  const [showOlderEvents, setShowOlderEvents] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("telemetry-theme");
    if (saved === "light" || saved === "dark") {
      return saved;
    }

    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    return prefersDark ? "dark" : "light";
  });
  const sidebarRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const theme = THEMES[themeMode];
  const [historyMode, setHistoryMode] = useState<"all" | "latest">("all");
  const [showClearDbDialog, setShowClearDbDialog] = useState(false);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080");
    socketRef.current = socket;

    const normalizeEvent = (raw: any): TelemetryEvent => ({
      ...raw,
      new_tests: Array.isArray(raw.new_tests)
        ? raw.new_tests
        : (typeof raw.new_tests === "string" ? JSON.parse(raw.new_tests) : []),
    });

    const toPoint = (
      cycle: number,
      complexity: number,
      loc_added: number,
      loc_removed: number,
      loc_total: number,
      functions: number,
      conditionals: number,
      classes: number,
      file_count: number,
      tests_passed: number,
      tests_total: number,
      halstead_volume: number,
      maintainability_index: number,
      nesting_depth: number,
      max_params: number,
      tests_duration_ms: number,
      test_ratio: number,
    ): ChartPoint => ({
      cycle,
      complexity,
      loc_added,
      loc_removed,
      loc_total,
      functions,
      conditionals,
      classes,
      file_count,
      pass_rate: tests_total > 0 ? Math.round((tests_passed / tests_total) * 100) : 0,
      halstead_volume,
      maintainability_index,
      nesting_depth,
      max_params,
      tests_duration_ms,
      test_ratio,
    });

    const buildChartData = (list: TelemetryEvent[]): ChartData => {
      const sorted = [...list].sort((a, b) => (a.cycle ?? 0) - (b.cycle ?? 0));
      const next: ChartData = { test: [], production: [] };

      for (const event of sorted) {
        if (event.category === "checkpoint") {
          next.test.push(
            toPoint(
              event.cycle,
              event.test_complexity ?? 0,
              event.test_loc_added ?? 0,
              event.test_loc_removed ?? 0,
              event.test_loc_total ?? 0,
              event.test_functions ?? 0,
              event.test_conditionals ?? 0,
              event.test_classes ?? 0,
              event.test_file_count ?? 0,
              event.tests_passed,
              event.tests_total,
              event.test_halstead_volume ?? 0,
              event.test_maintainability_index ?? 100,
              event.test_nesting_depth ?? 0,
              event.test_max_params ?? 0,
              event.tests_duration_ms ?? 0,
              (event.prod_loc_total ?? 0) > 0
                ? Math.round(((event.test_loc_total ?? 0) / (event.prod_loc_total ?? 1)) * 100)
                : 0,
            )
          );
          next.production.push(
            toPoint(
              event.cycle,
              event.prod_complexity ?? 0,
              event.prod_loc_added ?? 0,
              event.prod_loc_removed ?? 0,
              event.prod_loc_total ?? 0,
              event.prod_functions ?? 0,
              event.prod_conditionals ?? 0,
              event.prod_classes ?? 0,
              event.prod_file_count ?? 0,
              event.tests_passed,
              event.tests_total,
              event.prod_halstead_volume ?? 0,
              event.prod_maintainability_index ?? 100,
              event.prod_nesting_depth ?? 0,
              event.prod_max_params ?? 0,
              event.tests_duration_ms ?? 0,
              (event.prod_loc_total ?? 0) > 0
                ? Math.round(((event.test_loc_total ?? 0) / (event.prod_loc_total ?? 1)) * 100)
                : 0,
            )
          );
        } else {
          const point = toPoint(
            event.cycle,
            event.complexity,
            event.loc_added,
            event.loc_removed ?? 0,
            event.loc_total,
            event.functions,
            event.conditionals,
            event.classes,
            0,
            event.tests_passed,
            event.tests_total,
            event.halstead_volume ?? 0,
            event.maintainability_index ?? 100,
            event.nesting_depth ?? 0,
            event.max_params ?? 0,
            event.tests_duration_ms ?? 0,
            0,
          );
          if (event.category === "test") {
            next.test.push(point);
          } else if (event.category === "production") {
            next.production.push(point);
          }
        }
      }

      return next;
    };

    socket.onmessage = (msg) => {
      const raw = JSON.parse(msg.data);

      if (raw?.type === "cleared") {
        setEvents([]);
        setChartData({ test: [], production: [] });
        setShowOlderEvents(false);
        return;
      }

      if (raw?.type === "snapshot" && Array.isArray(raw.events)) {
        const snapshot = (raw as SnapshotMessage).events.map(normalizeEvent);

        // Side panel expects latest first.
        const latestFirst = [...snapshot].sort((a, b) => (b.cycle ?? 0) - (a.cycle ?? 0));
        setEvents(latestFirst);
        setChartData(buildChartData(snapshot));
        return;
      }

      const event: TelemetryEvent = normalizeEvent(raw);

      setEvents((prev) => [event, ...prev]);

      // Primary mode: one checkpoint event per test run with split test/prod metrics.
      if (event.category === "checkpoint") {
        const testPoint: ChartPoint = {
          cycle: event.cycle,
          complexity: event.test_complexity ?? 0,
          loc_added: event.test_loc_added ?? 0,
          loc_removed: event.test_loc_removed ?? 0,
          loc_total: event.test_loc_total ?? 0,
          functions: event.test_functions ?? 0,
          conditionals: event.test_conditionals ?? 0,
          classes: event.test_classes ?? 0,
          file_count: event.test_file_count ?? 0,
          pass_rate: event.tests_total > 0 ? Math.round((event.tests_passed / event.tests_total) * 100) : 0,
          halstead_volume: event.test_halstead_volume ?? 0,
          maintainability_index: event.test_maintainability_index ?? 100,
          nesting_depth: event.test_nesting_depth ?? 0,
          max_params: event.test_max_params ?? 0,
          tests_duration_ms: event.tests_duration_ms ?? 0,
          test_ratio: (event.prod_loc_total ?? 0) > 0
            ? Math.round(((event.test_loc_total ?? 0) / (event.prod_loc_total ?? 1)) * 100)
            : 0,
        };

        const prodPoint: ChartPoint = {
          cycle: event.cycle,
          complexity: event.prod_complexity ?? 0,
          loc_added: event.prod_loc_added ?? 0,
          loc_removed: event.prod_loc_removed ?? 0,
          loc_total: event.prod_loc_total ?? 0,
          functions: event.prod_functions ?? 0,
          conditionals: event.prod_conditionals ?? 0,
          classes: event.prod_classes ?? 0,
          file_count: event.prod_file_count ?? 0,
          pass_rate: event.tests_total > 0 ? Math.round((event.tests_passed / event.tests_total) * 100) : 0,
          halstead_volume: event.prod_halstead_volume ?? 0,
          maintainability_index: event.prod_maintainability_index ?? 100,
          nesting_depth: event.prod_nesting_depth ?? 0,
          max_params: event.prod_max_params ?? 0,
          tests_duration_ms: event.tests_duration_ms ?? 0,
          test_ratio: (event.prod_loc_total ?? 0) > 0
            ? Math.round(((event.test_loc_total ?? 0) / (event.prod_loc_total ?? 1)) * 100)
            : 0,
        };

        setChartData((prev) => ({
          test: [...prev.test, testPoint],
          production: [...prev.production, prodPoint],
        }));
        return;
      }

      // Backward compatibility for older per-file events.
      const point: ChartPoint = toPoint(
        event.cycle,
        event.complexity,
        event.loc_added,
        event.loc_removed ?? 0,
        event.loc_total,
        event.functions,
        event.conditionals,
        event.classes,
        0,
        event.tests_passed,
        event.tests_total,
        event.halstead_volume ?? 0,
        event.maintainability_index ?? 100,
        event.nesting_depth ?? 0,
        event.max_params ?? 0,
        event.tests_duration_ms ?? 0,
        0,
      );

      const categoryKey: "test" | "production" =
        event.category === "test" ? "test" : "production";

      setChartData((prev) => ({
        ...prev,
        [categoryKey]: [...prev[categoryKey], point],
      }));
    };

    return () => {
      socketRef.current = null;
      socket.close();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("telemetry-theme", themeMode);
  }, [themeMode]);

  const latestEvents = events.slice(0, 3);
  const olderEvents = events.slice(3);

  const visibleEvents = historyMode === "latest"
    ? events.slice(0, 1)
    : events;

  const visibleChartData: ChartData = historyMode === "latest"
    ? {
        test: chartData.test.slice(-1),
        production: chartData.production.slice(-1),
      }
    : chartData;

  const latestVisibleEvents = visibleEvents.slice(0, 3);
  const olderVisibleEvents = visibleEvents.slice(3);

  function clearVisibleMetrics() {
    setEvents([]);
    setChartData({ test: [], production: [] });
    setShowOlderEvents(false);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.appBg,
        color: theme.text,
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.25; transform: scale(1.5); }
        }

        @keyframes flowtide-mark {
          0%, 100% {
            transform: scale(1);
            filter: brightness(1) saturate(1);
            box-shadow: 0 14px 28px rgba(15, 23, 42, 0.16);
          }
          50% {
            transform: scale(1.08);
            filter: brightness(1.28) saturate(1.35);
            box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.38), 0 0 34px rgba(251, 191, 36, 0.5), 0 0 60px rgba(251, 191, 36, 0.22), 0 18px 38px rgba(15, 23, 42, 0.22);
          }
        }
      `}</style>
      {/* Header */}
      <div
        style={{
          padding: "16px 28px",
          borderBottom: `1px solid ${theme.borderSoft}`,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <FlowtideMark theme={theme} />
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", lineHeight: 1 }}>
            <span style={{ fontFamily: "'Outfit', system-ui, sans-serif", fontSize: 26, fontWeight: 800, letterSpacing: -0.8 }}>
              <span style={{ color: themeMode === "dark" ? "#fbbf24" : "#f97316" }}>flow</span>
              <span style={{ color: themeMode === "dark" ? theme.titleColor : "#f97316" }}>tide</span>
            </span>
            <span style={{ fontFamily: "'Outfit', system-ui, sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: 1.5, color: theme.textMuted, textTransform: "uppercase", marginTop: 4 }}>TDD Telemetry Tool</span>
          </div>
        </div>
        <span style={{ color: theme.textFaint, fontSize: 13 }}>{visibleEvents.length} event{visibleEvents.length !== 1 ? "s" : ""} visible</span>
        <button
          onClick={() => setHistoryMode("all")}
          style={{
            marginLeft: 12,
            background: historyMode === "all" ? theme.surfaceAlt : theme.surface,
            color: historyMode === "all" ? theme.text : theme.textMuted,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: "6px 10px",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Show All Cycles
        </button>
        <button
          onClick={() => setHistoryMode("latest")}
          style={{
            background: historyMode === "latest" ? theme.surfaceAlt : theme.surface,
            color: historyMode === "latest" ? theme.text : theme.textMuted,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: "6px 10px",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Keep Latest Cycle
        </button>
        <button
          onClick={clearVisibleMetrics}
          style={{
            background: theme.surface,
            color: "#ef4444",
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: "6px 10px",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Clear View
        </button>
        <button
          onClick={() => setShowClearDbDialog(true)}
          style={{
            background: theme.surface,
            color: "#ef4444",
            border: `1px solid #ef4444`,
            borderRadius: 8,
            padding: "6px 10px",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Clear All Data
        </button>
        <button
          onClick={() => setThemeMode((prev) => (prev === "dark" ? "light" : "dark"))}
          style={{
            marginLeft: "auto",
            background: theme.surface,
            color: theme.textMuted,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: "6px 10px",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {themeMode === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Chart area */}
        <div style={{ flex: 1, padding: "24px 28px", overflow: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 8 }}>
            <MetricsChart
              title="Test Code"
              accentColor="#6366f1"
              data={visibleChartData.test}
              emptyLabel="No test file changes yet"
              theme={theme}
              chartKind="test"
            />
            <MetricsChart
              title="Production Code"
              accentColor="#10b981"
              data={visibleChartData.production}
              emptyLabel="No production file changes yet"
              theme={theme}
              chartKind="production"
            />
          </div>

          {visibleEvents.length === 0 && (
            <div
              style={{
                textAlign: "center",
                color: theme.textFaint,
                marginTop: 60,
                fontSize: 15,
              }}
            >
              Waiting for file changes... Save a file in the watched directory to see data.
            </div>
          )}

          {/* Test summary strip — shown below chart once we have data */}
          {visibleEvents.length > 0 && (() => {
            const latest = visibleEvents[0];
            return (
              <div
                style={{
                  marginTop: 28,
                  background: theme.surface,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 10,
                  padding: "16px 20px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: "#c084fc",
                        boxShadow: "0 0 0 4px #c084fc22, 0 0 12px #d946ef99, 0 0 18px #a855f7aa",
                        animation: "pulse-dot 1.4s ease-in-out infinite",
                      }}
                    />
                    <span style={{ fontWeight: 800, color: theme.text, fontSize: 20 }}>
                      Current Cycle
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, color: theme.textMuted, fontSize: 13 }}>
                    Test Suite - Cycle #{latest.cycle}
                  </div>
                </div>

                {/* Pass / Fail bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#10b981" }} />
                    <span style={{ color: "#10b981", fontWeight: 700, fontSize: 20 }}>{latest.tests_passed}</span>
                    <span style={{ color: theme.textFaint, fontSize: 12 }}>passing</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ef4444" }} />
                    <span style={{ color: "#ef4444", fontWeight: 700, fontSize: 20 }}>{latest.tests_failed}</span>
                    <span style={{ color: theme.textFaint, fontSize: 12 }}>failing</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: theme.textFaint, fontSize: 12 }}>of</span>
                    <span style={{ color: theme.text, fontWeight: 700, fontSize: 20 }}>{latest.tests_total}</span>
                    <span style={{ color: theme.textFaint, fontSize: 12 }}>total</span>
                  </div>
                  {/* Progress bar */}
                  {latest.tests_total > 0 && (
                    <div style={{ flex: 1, height: 8, background: theme.surfaceAlt, borderRadius: 4, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${(latest.tests_passed / latest.tests_total) * 100}%`,
                          background: latest.tests_failed === 0 ? "#10b981" : "#f59e0b",
                          borderRadius: 4,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* New tests this cycle */}
                <div>
                  <span style={{ color: theme.textFaint, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 }}>
                    New tests this cycle
                  </span>
                  {latest.new_tests.length === 0 ? (
                    <div style={{ color: theme.textFaint, fontSize: 13, marginTop: 4 }}>
                      No new tests — count unchanged
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                      {latest.new_tests.map((name, i) => (
                        <span
                          key={i}
                          style={{
                            background: themeMode === "dark" ? "#1d4ed822" : "#dbeafe",
                            color: "#60a5fa",
                            border: themeMode === "dark" ? "1px solid #1d4ed855" : "1px solid #93c5fd",
                            borderRadius: 4,
                            padding: "2px 8px",
                            fontSize: 12,
                            fontFamily: "monospace",
                          }}
                        >
                          + {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Metrics legend */}
                <div
                  style={{
                    marginTop: 20,
                    paddingTop: 16,
                    borderTop: `1px solid ${theme.borderSoft}`,
                    boxShadow: `inset 0 1px 0 ${theme.appBg === "#0f172a" ? "#ffffff08" : "#ffffffcc"}`,
                  }}
                >
                  <span style={{ color: theme.textFaint, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 }}>
                    Metric reference
                  </span>
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
                    {[
                      { color: "#f59e0b", label: "Complexity",          desc: "Cyclomatic complexity — branches + conditionals per function" },
                      { color: "#3b82f6", label: "LOC Added",           desc: "Lines of code added in this cycle" },
                      { color: "#14b8a6", label: "Total LOC",           desc: "Total non-empty lines across tracked files" },
                      { color: "#ef4444", label: "Functions",           desc: "Number of function / method definitions" },
                      { color: "#a855f7", label: "Conditionals",        desc: "if / else if / switch / when / guard expressions" },
                      { color: "#06b6d4", label: "Classes",             desc: "Class, struct, enum, or type definitions" },
                      { color: "#f97316", label: "LOC Removed",         desc: "Lines of code deleted in this cycle" },
                      { color: "#84cc16", label: "Files Changed",       desc: "Number of distinct files modified" },
                      { color: "#10b981", label: "Pass Rate %",         desc: "Percentage of tests currently passing (0 – 100)" },
                      { color: "#e879f9", label: "Test Duration (ms)",  desc: "Wall-clock milliseconds for the full test suite to run" },
                      { color: "#fbbf24", label: "Test/Prod Ratio ×100",desc: "test LOC ÷ prod LOC × 100 — 100 = 1:1, 33 = 1:3" },
                      { color: "#6366f1", label: "Halstead Volume",     desc: "N × log₂(n) — operator/operand token volume" },
                      { color: "#22c55e", label: "Maintainability (MI)",desc: "0 – 100 score from Halstead + complexity + LOC. Higher = easier to maintain" },
                      { color: "#f43f5e", label: "Nesting Depth",       desc: "Maximum control-structure nesting level in changed files" },
                      { color: "#fb923c", label: "Max Params",          desc: "Largest parameter count across all function definitions" },
                    ].map(({ color, label, desc }) => (
                      <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 4 }} />
                        <div>
                          <span style={{ color: theme.text, fontSize: 12, fontWeight: 600 }}>{label}</span>
                          <span style={{ color: theme.textFaint, fontSize: 11 }}> — {desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Side trace panel */}
        <div
          style={{
            width: 320,
            borderLeft: `1px solid ${theme.borderSoft}`,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 16px 10px",
              borderBottom: `1px solid ${theme.borderSoft}`,
              fontSize: 13,
              fontWeight: 600,
              color: theme.textMuted,
              flexShrink: 0,
            }}
          >
            Recent Changes
          </div>
          <div
            ref={sidebarRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 12px",
            }}
          >
            {visibleEvents.length === 0 ? (
              <div style={{ color: theme.textFaint, fontSize: 13, textAlign: "center", marginTop: 40 }}>
                No events yet
              </div>
            ) : (
              <>
                {latestVisibleEvents.map((event, i) => (
                  <EventCard key={`${event.timestamp}-${i}`} event={event} index={i} theme={theme} isLatest={i === 0} />
                ))}

                {olderVisibleEvents.length > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      borderTop: `1px solid ${theme.borderSoft}`,
                      paddingTop: 10,
                    }}
                  >
                    <button
                      onClick={() => setShowOlderEvents((prev) => !prev)}
                      style={{
                        width: "100%",
                        background: theme.surfaceAlt,
                        color: theme.textMuted,
                        border: `1px solid ${theme.border}`,
                        borderRadius: 6,
                        padding: "8px 10px",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {showOlderEvents
                        ? `Hide older changes (${olderVisibleEvents.length})`
                        : `Show older changes (${olderVisibleEvents.length})`}
                    </button>

                    {showOlderEvents && (
                      <div style={{ marginTop: 10 }}>
                        {olderVisibleEvents.map((event, i) => (
                          <EventCard
                            key={`${event.timestamp}-older-${i}`}
                            event={event}
                            index={i + 3}
                            theme={theme}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          borderTop: `1px solid ${theme.borderSoft}`,
          padding: "10px 28px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: theme.textFaint,
          fontSize: 11,
          letterSpacing: 0.3,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span>Flowtide v{APP_VERSION}</span>
          <span>Created by Ngumbah Michael Nyika</span>
        </div>
        <span>{CURRENT_YEAR}</span>
      </div>

      {/* Clear All Data confirmation dialog */}
      {showClearDbDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowClearDbDialog(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: 12,
              padding: "28px 32px",
              maxWidth: 420,
              width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: "#ef4444", marginBottom: 10 }}>
              ⚠ Clear All Data?
            </div>
            <p style={{ color: theme.textMuted, fontSize: 14, lineHeight: 1.6, margin: "0 0 20px" }}>
              This will permanently delete <strong style={{ color: theme.text }}>all recorded events</strong> from the database.
              Charts and metrics will be reset and cannot be recovered.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowClearDbDialog(false)}
                style={{
                  background: theme.surfaceAlt,
                  color: theme.textMuted,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 8,
                  padding: "8px 18px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  socketRef.current?.send(JSON.stringify({ type: "clear_db" }));
                  setShowClearDbDialog(false);
                }}
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 18px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Yes, clear everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

