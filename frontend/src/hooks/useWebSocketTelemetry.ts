import { useEffect, useRef, useState } from "react";
import { TelemetryEvent, ChartData, SnapshotMessage } from "../types/telemetry";

const BACKEND_WS_URL = import.meta.env.VITE_BACKEND_WS_URL
  ?? `ws://${import.meta.env.VITE_BACKEND_HOST ?? "localhost"}:${import.meta.env.VITE_BACKEND_PORT ?? "8080"}`;

export function useWebSocketTelemetry() {
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [chartData, setChartData] = useState<ChartData>({ test: [], production: [] });
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket(BACKEND_WS_URL);
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
    ) => ({
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
        return;
      }

      if (raw?.type === "snapshot" && Array.isArray(raw.events)) {
        const snapshot = (raw as SnapshotMessage).events.map(normalizeEvent);
        const latestFirst = [...snapshot].sort((a, b) => (b.cycle ?? 0) - (a.cycle ?? 0));
        setEvents(latestFirst);
        setChartData(buildChartData(snapshot));
        return;
      }

      const event: TelemetryEvent = normalizeEvent(raw);
      setEvents((prev) => [event, ...prev]);

      if (event.category === "checkpoint") {
        const testPoint = {
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

        const prodPoint = {
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

  return { events, setEvents, chartData, setChartData };
}
