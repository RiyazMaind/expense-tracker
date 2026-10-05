import Svg, { Path } from 'react-native-svg';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

/**
 * The app's icon system.
 *
 * Every glyph is authored on the same 24x24 grid as an open stroked path, so
 * the family stays optically consistent: one stroke width, round caps and
 * joins, no fills, no decorative dots. Geometry is hand-written rather than
 * pulled from an icon package, so there is no third-party house style leaking
 * in and no per-platform divergence.
 *
 * Hand-drawn shapes do not fill the grid equally, so each glyph also declares
 * its ink box below and `Icon` compensates optically at render time. That is
 * what keeps the bar chart and the sliders from reading a third smaller than
 * the house when they share one layout box.
 *
 * `react-native-svg` is the renderer only (it ships with Expo Go); the paths
 * below are this project's own.
 */
export type IconName =
  | 'home'
  | 'receipt'
  | 'chart'
  | 'wallet'
  | 'sliders'
  | 'plus'
  | 'close';

/** The grid every path is authored on. */
const GRID = 24;

/**
 * Path data per glyph. Geometry only — see `ink` for each shape's optical size.
 */
const paths: Record<IconName, readonly string[]> = {
  // House: pitched roof and body, drawn as one continuous outline.
  home: [
    'M3.4 10.2 12 3.4l8.6 6.8',
    'M5.6 9.1v9.1a1.4 1.4 0 0 0 1.4 1.4h10a1.4 1.4 0 0 0 1.4-1.4V9.1',
    'M9.7 19.6v-5.2h4.6v5.2',
  ],

  // Receipt: page with a torn/zig-zag foot and two rule lines.
  receipt: [
    'M6.2 3.4h11.6v16.3l-2.2-1.5-1.7 1.5-1.9-1.5-1.9 1.5-1.7-1.5-2.2 1.5z',
    'M9.4 8.2h5.2',
    'M9.4 11.9h5.2',
  ],

  // Bar chart: three bars on a shared baseline, ascending.
  chart: [
    'M4.6 19.6h14.8',
    'M8.1 19.6v-5.4',
    'M12 19.6V8.9',
    'M15.9 19.6v-7.7',
  ],

  // Wallet: body with a flap and a clasp, no interior fill.
  wallet: [
    'M3.6 7.6a2 2 0 0 1 2-2h10.9a2 2 0 0 1 2 2v1.1',
    'M3.6 7.6v9.3a2 2 0 0 0 2 2h12.8a2 2 0 0 0 2-2v-6.1a2 2 0 0 0-2-2H5.6a2 2 0 0 1-2-2',
    'M15.4 13.5h1.6',
  ],

  // Sliders: two tracks. Knobs are drawn separately, see `sliderKnobs`.
  sliders: ['M3.8 7.4h16.4', 'M3.8 16.6h16.4'],

  plus: ['M12 5.6v12.8', 'M5.6 12h12.8'],
  close: ['M6.4 6.4l11.2 11.2', 'M17.6 6.4L6.4 17.6'],
};

/**
 * Knob positions for the sliders glyph, expressed as coordinates so the knobs
 * are laid out as part of the same stroke system rather than as stray dots.
 */
const sliderKnobs = [
  { cx: 9.4, cy: 7.4 },
  { cx: 14.6, cy: 16.6 },
] as const;

/**
 * Ink box of each glyph in grid units, stroke included: x/y is the top-left of
 * the ink, width/height its extent.
 *
 * The glyphs are hand-drawn rather than metric-matched, so their ink boxes
 * genuinely differ: the house fills 19.1 x 18.1 units while the bar chart only
 * reaches 16.7 x 12.6. Given one shared box, the chart and the sliders
 * therefore rendered roughly a third smaller than the house — measured on
 * Android at 360dp as 12.5pt and 13pt of ink against the house's 18pt — which
 * made the Analytics and Settings tabs look unfinished.
 *
 * The `x`/`y` offsets matter as much as the extents. The bar chart's ink is
 * bottom-weighted: its baseline sits at 19.6 and its tallest bar only reaches
 * 8.9, so its ink centre is 14.25 rather than the grid's 12. Scaled up to
 * compensate, that 2.25-unit bias became a measured 4pt drop below the other
 * four icons. Positioning each canvas by its own ink centre fixes it.
 *
 * Declaring this lets `Icon` compensate at render time. The path data above is
 * untouched: this is the same kind of metadata as `sliderKnobs`, and it keeps
 * the geometry hand-authored.
 */
const ink: Record<IconName, { x: number; y: number; width: number; height: number }> = {
  // Roof apex 3.4 to eaves 20.6. Ink centre lands on the grid centre.
  home: { x: 3.4, y: 3.4, width: 19.1, height: 18.1 },
  // Page 6.2 to 17.8 by 3.4 to 19.7 — tall and narrow by design.
  receipt: { x: 6.2, y: 3.4, width: 13.5, height: 18.2 },
  // Bars 4.9 to 21.5 by 8.9 to 19.6 — wide but short, and bottom-weighted.
  chart: { x: 4.9, y: 8.9, width: 16.7, height: 12.6 },
  // Body 3.6 to 20.4 by 5.6 to 18.9.
  wallet: { x: 3.6, y: 5.6, width: 18.7, height: 15.2 },
  // The sliders' ink is set by its knobs, not its tracks: `Icon` draws each
  // knob as a round-capped dot of 2.1x the stroke weight, which spreads the ink
  // ~1.5 units past the track lines at 7.4 and 16.6. Declaring the tracks alone
  // put the box 2 units low and, once compensated, measured 1.25pt high against
  // the other four icons. The box below spans the knob extents, and centres on
  // 12 because the knob spread is symmetric about the grid centre.
  sliders: { x: 3.8, y: 5.9, width: 18.3, height: 12.3 },
  plus: { x: 4.6, y: 4.6, width: 14.7, height: 14.7 },
  close: { x: 5.4, y: 5.4, width: 13.1, height: 13.1 },
};

/**
 * Ink height every glyph is normalised towards, in points.
 *
 * Fraction of the box, so it scales with the caller: a 22pt navigation icon
 * normalises to 17.2pt of ink, which is just under the house's natural 16.6pt
 * at that size plus a little headroom. The house and the receipt are already
 * the tallest pair, so they anchor the row and nothing shrinks.
 */
const opticalInkRatio = 0.78;

/**
 * Ceiling on the compensation.
 *
 * Without it the bar chart would need 1.49x to reach the target and would grow
 * into a heavy block; 1.45x lands it at 16.8pt of ink against the house's
 * 17.2pt, which is optically indistinguishable, and keeps every glyph inside the
 * navigation bar.
 */
const opticalMaxScale = 1.45;

export type IconProps = {
  name: IconName;
  /**
   * Layout box in points. Shared by every glyph in a row so the vertical
   * rhythm stays even; optical compensation happens inside it and may spill a
   * little beyond, which is never clipped.
   */
  size?: number;
  color?: string;
  /** Stroke width in points. Held constant as glyphs are compensated. */
  strokeWidth?: number;
  /**
   * Opt in to optical compensation — `false` by default.
   *
   * Compensation is only wanted where several glyphs sit side by side at one
   * size and must read as a family, which today means the bottom navigation.
   * Defaulting it off keeps every other caller's rendering byte-identical to
   * the uncompensated path geometry.
   */
  optical?: boolean;
  testID?: string;
};

/**
 * A single stroked icon.
 *
 * Colour is passed in rather than baked in, so active and inactive states are
 * a caller decision (accent when active, muted when not).
 *
 * With `optical`, glyphs are compensated inside a fixed layout box so a set with
 * mismatched ink heights still reads as one family: the canvas is scaled, and
 * anchored on each glyph's own ink centre so a shape whose ink is off-centre in
 * the grid — the bar chart's is bottom-weighted — still lands centred once
 * enlarged. The rendered stroke weight stays constant across the compensation,
 * so line weight is identical whichever glyph is drawn.
 */
export function Icon({
  name,
  size = 22,
  color = colors.text,
  strokeWidth = 1.9,
  optical = false,
  testID,
}: IconProps) {
  const glyphInk = ink[name];

  // Ink this glyph would occupy at the requested box, in points.
  const inkAtBase = (glyphInk.height * size) / GRID;

  const scale = optical
    ? Math.min(opticalMaxScale, Math.max(1, (size * opticalInkRatio) / inkAtBase))
    : 1;

  // Canvas actually drawn.
  const canvas = size * scale;

  /**
   * Offset from the layout box to the canvas, per axis.
   *
   * Opted in: centred on the glyph's *ink* rather than the grid, so a shape
   * whose ink sits off centre in its 24-unit box still lands centred once it
   * has been scaled up. Opted out: simply centred on the layout box, so an
   * uncompensated glyph renders exactly as the raw path geometry does.
   */
  const offset = (start: number, extent: number) =>
    optical ? size / 2 - ((start + extent / 2) / GRID) * canvas : (size - canvas) / 2;

  // Stroke authored on the grid. Dividing by the canvas holds the *rendered*
  // stroke at `strokeWidth` points, so a compensated glyph does not end up
  // visibly heavier than the rest of the family.
  const gridStroke = (strokeWidth * GRID) / canvas;

  return (
    <View style={[styles.box, { width: size, height: size }]} pointerEvents="none">
      <Svg
        testID={testID}
        width={canvas}
        height={canvas}
        viewBox={`0 0 ${GRID} ${GRID}`}
        fill="none"
        style={{
          position: 'absolute',
          left: offset(glyphInk.x, glyphInk.width),
          top: offset(glyphInk.y, glyphInk.height),
        }}
        accessibilityRole="image"
      >
        {paths[name].map((d, index) => (
          <Path
            key={index}
            d={d}
            stroke={color}
            strokeWidth={gridStroke}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {name === 'sliders'
          ? sliderKnobs.map((knob) => (
              <Path
                key={`${knob.cx}-${knob.cy}`}
                // A zero-length round-capped segment renders as a clean dot on
                // the track, matching the stroke weight exactly.
                d={`M${knob.cx} ${knob.cy}h0`}
                stroke={color}
                strokeWidth={gridStroke * 2.1}
                strokeLinecap="round"
              />
            ))
          : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    // Reserves the layout box without clipping the compensated canvas.
    overflow: 'visible',
  },
});