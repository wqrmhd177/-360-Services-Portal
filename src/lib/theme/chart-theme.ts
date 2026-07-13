"use client";

import { useMemo } from "react";

export type ChartTheme = {
  tickFill: string;
  gridStroke: string;
  axisStroke: string;
  tooltipBg: string;
  tooltipBorder: string;
  labelFill: string;
  referenceStroke: string;
  activeDotStroke: string;
  pieSliceStroke: string;
};

const LIGHT: ChartTheme = {
  tickFill: "#64748b",
  gridStroke: "#e2e8f0",
  axisStroke: "#e2e8f0",
  tooltipBg: "rgba(255, 255, 255, 0.95)",
  tooltipBorder: "#e2e8f0",
  labelFill: "#475569",
  referenceStroke: "#94a3b8",
  activeDotStroke: "#ffffff",
  pieSliceStroke: "#ffffff",
};

export function useChartTheme(): ChartTheme {
  return useMemo(() => LIGHT, []);
}
