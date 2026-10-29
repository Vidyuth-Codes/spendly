import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Type } from '@/constants/theme';
import { formatCompactPaise, niceMax, type Slice } from '@/features/insights/chart-utils';
import { useTheme } from '@/hooks/use-theme';

const AXIS_LEFT = 40;
const AXIS_BOTTOM = 22;
const PAD_TOP = 10;
const PAD_RIGHT = 6;

function useWidth() {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.floor(e.nativeEvent.layout.width));
  return { width, onLayout };
}

// ------------------------------------------------------------------------- donut

export function DonutChart({
  slices,
  size = 190,
  thickness = 26,
  centerLabel,
  centerValue,
}: {
  slices: Slice[];
  size?: number;
  thickness?: number;
  centerLabel: string;
  centerValue: string;
}) {
  const theme = useTheme();
  const total = slices.reduce((t, s) => t + s.value, 0);
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const mid = size / 2;

  let offset = 0;
  const arcs = slices.map((s) => {
    const length = (s.value / total) * circumference;
    const gap = slices.length > 1 ? Math.min(2, length * 0.2) : 0; // small gap between slices
    const arc = (
      <Circle
        key={s.key}
        cx={mid}
        cy={mid}
        r={r}
        fill="none"
        stroke={s.color}
        strokeWidth={thickness}
        strokeDasharray={`${Math.max(length - gap, 0)} ${circumference}`}
        strokeDashoffset={-offset}
      />
    );
    offset += length;
    return arc;
  });

  return (
    <View
      style={[styles.donut, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel={`Spending by category. ${slices.map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(', ')}`}>
      <Svg width={size} height={size}>
        <Circle cx={mid} cy={mid} r={r} fill="none" stroke={theme.backgroundSelected} strokeWidth={thickness} />
        {total > 0 ? <G rotation={-90} origin={`${mid}, ${mid}`}>{arcs}</G> : null}
      </Svg>
      <View style={styles.donutCenter} pointerEvents="none">
        <ThemedText type="small" themeColor="textSecondary">
          {centerLabel}
        </ThemedText>
        <ThemedText type="smallBold">{centerValue}</ThemedText>
      </View>
    </View>
  );
}

// --------------------------------------------------------------------------- bars

export type BarDatum = { key: string; value: number };

export function BarChart({
  data,
  labelFor,
  averagePaise,
  selectedIndex,
  onSelect,
  height = 190,
  highlightIndex,
}: {
  data: BarDatum[];
  /** X-axis label for bar i, or null to skip it. */
  labelFor: (index: number) => string | null;
  averagePaise?: number;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  height?: number;
  /** Bar drawn in full color (e.g. today); the rest are slightly muted. */
  highlightIndex?: number;
}) {
  const theme = useTheme();
  const { width, onLayout } = useWidth();

  const plotW = Math.max(0, width - AXIS_LEFT - PAD_RIGHT);
  const plotH = height - AXIS_BOTTOM - PAD_TOP;
  const max = niceMax(Math.max(averagePaise ?? 0, ...data.map((d) => d.value)));
  const slot = data.length ? plotW / data.length : 0;
  const barW = Math.max(3, Math.min(28, slot * 0.62));
  const yFor = (v: number) => PAD_TOP + plotH - (v / max) * plotH;

  return (
    <View onLayout={onLayout} accessibilityRole="image" accessibilityLabel="Daily spending bar chart">
      {width > 0 ? (
        <Svg width={width} height={height}>
          {[0, 0.5, 1].map((f) => (
            <G key={f}>
              <Line
                x1={AXIS_LEFT}
                x2={width - PAD_RIGHT}
                y1={yFor(max * f)}
                y2={yFor(max * f)}
                stroke={theme.border}
                strokeWidth={1}
              />
              <SvgText x={AXIS_LEFT - 6} y={yFor(max * f) + 3} fontSize={10} fontFamily={Type.body} fill={theme.textSecondary} textAnchor="end">
                {formatCompactPaise(max * f)}
              </SvgText>
            </G>
          ))}

          {data.map((d, i) => {
            const x = AXIS_LEFT + i * slot + (slot - barW) / 2;
            const h = (d.value / max) * plotH;
            const selected = selectedIndex === i;
            const label = labelFor(i);
            return (
              <G key={d.key}>
                {h > 0 ? (
                  <Rect
                    x={x}
                    y={PAD_TOP + plotH - h}
                    width={barW}
                    height={h}
                    rx={Math.min(4, barW / 3)}
                    fill={theme.primary}
                    opacity={selectedIndex !== null && !selected ? 0.35 : highlightIndex === undefined || highlightIndex === i ? 1 : 0.75}
                  />
                ) : null}
                {label ? (
                  <SvgText x={x + barW / 2} y={height - 6} fontSize={10} fontFamily={Type.body} fill={theme.textSecondary} textAnchor="middle">
                    {label}
                  </SvgText>
                ) : null}
                {/* Full-height, invisible touch target so thin bars are easy to hit. */}
                <Rect
                  x={AXIS_LEFT + i * slot}
                  y={PAD_TOP}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  onPress={() => onSelect(selected ? null : i)}
                />
              </G>
            );
          })}

          {averagePaise ? (
            <G>
              <Line
                x1={AXIS_LEFT}
                x2={width - PAD_RIGHT}
                y1={yFor(averagePaise)}
                y2={yFor(averagePaise)}
                stroke={theme.textSecondary}
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />
            </G>
          ) : null}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}

// --------------------------------------------------------------------------- line

export type LineSeries = {
  key: string;
  values: number[];
  color: string;
  dashed?: boolean;
  /** Draw a dot on the final point. */
  endDot?: boolean;
};

export function LineChart({
  series,
  length,
  labelFor,
  height = 170,
}: {
  series: LineSeries[];
  /** Number of x positions (days). */
  length: number;
  labelFor: (index: number) => string | null;
  height?: number;
}) {
  const theme = useTheme();
  const { width, onLayout } = useWidth();

  const plotW = Math.max(0, width - AXIS_LEFT - PAD_RIGHT - 6);
  const plotH = height - AXIS_BOTTOM - PAD_TOP;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const xFor = (i: number) => AXIS_LEFT + 3 + (length > 1 ? (i / (length - 1)) * plotW : plotW / 2);
  const yFor = (v: number) => PAD_TOP + plotH - (v / max) * plotH;
  const path = (values: number[]) => values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)} ${yFor(v).toFixed(1)}`).join(' ');

  return (
    <View onLayout={onLayout} accessibilityRole="image" accessibilityLabel="Cumulative spending compared with the previous period">
      {width > 0 ? (
        <Svg width={width} height={height}>
          {[0, 0.5, 1].map((f) => (
            <G key={f}>
              <Line x1={AXIS_LEFT} x2={width - PAD_RIGHT} y1={yFor(max * f)} y2={yFor(max * f)} stroke={theme.border} strokeWidth={1} />
              <SvgText x={AXIS_LEFT - 6} y={yFor(max * f) + 3} fontSize={10} fontFamily={Type.body} fill={theme.textSecondary} textAnchor="end">
                {formatCompactPaise(max * f)}
              </SvgText>
            </G>
          ))}

          {Array.from({ length }, (_, i) => {
            const label = labelFor(i);
            return label ? (
              <SvgText key={i} x={xFor(i)} y={height - 6} fontSize={10} fontFamily={Type.body} fill={theme.textSecondary} textAnchor="middle">
                {label}
              </SvgText>
            ) : null;
          })}

          {series.map((s) =>
            s.values.length ? (
              <G key={s.key}>
                <Path
                  d={path(s.values)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={s.dashed ? '6 5' : undefined}
                />
                {s.endDot ? (
                  <Circle cx={xFor(s.values.length - 1)} cy={yFor(s.values[s.values.length - 1])} r={4.5} fill={s.color} />
                ) : null}
              </G>
            ) : null,
          )}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}


// -------------------------------------------------------------------- ring gauge

/** A circular progress ring with content in the middle. `fraction` is how much of the ring is filled (0-1). */
export function RingGauge({
  fraction,
  color,
  size = 196,
  thickness = 16,
  children,
}: {
  fraction: number;
  color: string;
  size?: number;
  thickness?: number;
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, fraction)) * circumference;
  const mid = size / 2;

  return (
    <View style={[styles.donut, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle cx={mid} cy={mid} r={r} fill="none" stroke={theme.backgroundSelected} strokeWidth={thickness} />
        {filled > 0 ? (
          <G rotation={-90} origin={`${mid}, ${mid}`}>
            <Circle
              cx={mid}
              cy={mid}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference}`}
            />
          </G>
        ) : null}
      </Svg>
      <View style={styles.donutCenter} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

// ----------------------------------------------------------------------- mini bars

/** Compact bars with no axes, for at-a-glance cards. Empty days show a small stub. */
export function MiniBars({
  values,
  labels,
  highlightIndex,
  height = 96,
}: {
  values: number[];
  labels: string[];
  highlightIndex?: number;
  height?: number;
}) {
  const theme = useTheme();
  const { width, onLayout } = useWidth();
  const labelH = 20;
  const plotH = height - labelH;
  const max = Math.max(1, ...values);
  const slot = values.length ? width / values.length : 0;
  const barW = Math.min(30, slot * 0.62);

  return (
    <View onLayout={onLayout} accessibilityRole="image" accessibilityLabel="Spending this week">
      {width > 0 ? (
        <Svg width={width} height={height}>
          {values.map((v, i) => {
            const h = v > 0 ? Math.max(6, (v / max) * plotH) : 6;
            const x = i * slot + (slot - barW) / 2;
            const on = i === highlightIndex;
            return (
              <G key={i}>
                <Rect x={x} y={plotH - h} width={barW} height={h} rx={Math.min(8, barW / 2)} fill={on ? theme.primary : theme.backgroundSelected} />
                <SvgText x={x + barW / 2} y={height - 4} fontSize={11} fontFamily={Type.body} fill={on ? theme.primary : theme.textSecondary} textAnchor="middle">
                  {labels[i]}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  donut: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  donutCenter: { position: 'absolute', alignItems: 'center' },
});
