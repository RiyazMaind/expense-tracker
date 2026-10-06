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
}: {
  /** 0 to 1, already capped. */
  fraction: number;
  exceeded: boolean;
  /** >= 80% used but not yet over: the amber band. */
  nearlySpent: boolean;
  accessibilityLabel: string;
  accessibilityValue: { min: number; max: number; now: number; text: string };
  testID?: string;
}) {
  const fillColor = exceeded ? colors.destructive : nearlySpent ? colors.warning : colors.accent;

  return (
    <View
      style={styles.track}
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
            width: `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`,
            backgroundColor: fillColor,
          },
        ]}
        testID={testID ? `${testID}-fill` : undefined}
      />
    </View>
  );
}

/** Track height and corner are shared so the fill cannot stick out of the track. */
const styles = StyleSheet.create({
  track: {
    height: 10,
    borderRadius: radii.pill,
    borderCurve: 'continuous',
    backgroundColor: glass.strong,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
  },
});
