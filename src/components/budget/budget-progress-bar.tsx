import { StyleSheet, View } from 'react-native';

import { colors, glass, radii } from '@/theme';

/**
 * Horizontal budget bar: a track with a fill sized to the fraction used.
 *
 * The fill never overshoots 100% — `visualFraction` is already capped by the
 * math layer — so an over-spent bar saturates the track, and the "over" message
 * carries the extra information. Colour moves accent → amber → red so the state
 * survives a screen where colour is the only cue at first glance.
 */
export function BudgetProgressBar({
  fraction,
  exceeded,
  nearlySpent,
  accessibilityLabel,
  accessibilityValue,
  testID,
  thickness = 12,
}: {
  /** 0 to 1, already capped. */
  fraction: number;
  exceeded: boolean;
  /** >= 80% used but not yet over: the amber band. */
  nearlySpent: boolean;
  accessibilityLabel: string;
  accessibilityValue: { min: number; max: number; now: number; text: string };
  testID?: string;
  /**
   * Track height in points. Defaults to the Budget screen's 12; the Home
   * card passes a thinner value so the bar reads as evidence for the amount
   * above it rather than as a second focal point.
   */
  thickness?: number;
}) {
  const fillColor = exceeded ? colors.destructive : nearlySpent ? colors.warning : colors.accent;
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);

  return (
    <View
      style={[styles.track, { height: thickness }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={accessibilityValue}
      testID={testID}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${pct}%`,
            backgroundColor: fillColor,
          },
        ]}
        testID={testID ? `${testID}-fill` : undefined}
      >
        {/*
          The trailing dot needs headroom to read as a bead on the fill; on a
          hairline track it would simply fill the bar and add nothing.
        */}
        {pct > 5 && thickness >= 10 && (
          <View style={[styles.glowDot, { backgroundColor: '#FFFFFF' }]} />
        )}
      </View>
    </View>
  );
}

/** Track height comes from the `thickness` prop; the corner is shared with the fill. */
const styles = StyleSheet.create({
  track: {
    borderRadius: radii.pill,
    borderCurve: 'continuous',
    backgroundColor: glass.strong,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 2,
  },
  glowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.9,
  },
});
