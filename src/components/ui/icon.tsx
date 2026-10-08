import Svg, { Path } from 'react-native-svg';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';
import type { IconName } from './icon-catalog';

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
export type { IconName } from './icon-catalog';

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
  check: ['M5 12.6 9.7 17.3 19 6.6'],

  // Waste bin: lid line with a raised handle, tapered can, two inner rules.
  trash: [
    'M4.4 6.6h15.2',
    'M9.7 6.6V4.95a1.35 1.35 0 0 1 1.35-1.35h1.9a1.35 1.35 0 0 1 1.35 1.35V6.6',
    'M6.3 6.6l.85 13.05a1.5 1.5 0 0 0 1.5 1.4h6.7a1.5 1.5 0 0 0 1.5-1.4l.85-13.05',
    'M10.3 10.3v7.2',
    'M13.7 10.3v7.2',
  ],

  // Calendar: page, header rule, two hangers.
  calendar: [
    'M4.6 6.6h14.8a1 1 0 0 1 1 1v11.2a1 1 0 0 1-1 1H4.6a1 1 0 0 1-1-1V7.6a1 1 0 0 1 1-1z',
    'M3.6 10.6h16.8',
    'M8.2 4.6v3.4',
    'M15.8 4.6v3.4',
  ],

  chevronLeft: ['M14.8 5.6 8.4 12l6.4 6.4'],
  chevronRight: ['M9.2 5.6 15.6 12l-6.4 6.4'],

  // Fork and knife: three tines into a shared stem, beside a rounded blade.
  food: [
    'M8.6 3.9v4.5',
    'M11 3.9v4.5',
    'M13.4 3.9v4.5',
    'M8.6 8.4h4.8',
    'M11 8.4v11.7',
    'M16.3 3.9c1.8 1.5 2.5 3.9 2.5 6.1 0 1.7-1 2.6-2.5 2.6v8.5',
  ],

  // Car in side profile: roofline and body, two wheels below the sill.
  transport: [
    'M3.6 16.8v-4.4a1.5 1.5 0 0 1 .34-.9l2.42-3.22a2 2 0 0 1 1.6-.78h8.28a2 2 0 0 1 1.6.78l2.42 3.22a1.5 1.5 0 0 1 .34.9v4.4',
    'M3.6 16.8h16.8',
    'M6.6 16.8v1.7',
    'M17.4 16.8v1.7',
  ],

  // Shopping bag: tapered body, one arched handle.
  shopping: [
    'M5.7 8h12.6l-.95 11.2a1.5 1.5 0 0 1-1.5 1.3H8.15a1.5 1.5 0 0 1-1.5-1.3z',
    'M8.9 8.4V6.7a3.1 3.1 0 0 1 6.2 0v1.7',
  ],

  // Ring with a play triangle.
  entertainment: [
    'M12 3.9a8.1 8.1 0 1 0 0 16.2 8.1 8.1 0 0 0 0-16.2',
    'M10.2 8.7 15.6 12l-5.4 3.3z',
  ],

  // Heart, drawn as one continuous outline.
  health: [
    'M12 20.2S3.9 15.5 3.9 9.8A4.65 4.65 0 0 1 12 6.7a4.65 4.65 0 0 1 8.1 3.1c0 5.7-8.1 10.4-8.1 10.4z',
  ],

  // Open book: two pages meeting at a spine.
  education: [
    'M12 6.9v12.5',
    'M3.9 6.1a1.4 1.4 0 0 1 1.4-1.4h4.3A2.4 2.4 0 0 1 12 6.9v12.5a1.9 1.9 0 0 0-1.9-1.4H5.3a1.4 1.4 0 0 1-1.4-1.4z',
    'M20.1 6.1a1.4 1.4 0 0 0-1.4-1.4h-4.3A2.4 2.4 0 0 0 12 6.9v12.5a1.9 1.9 0 0 1 1.9-1.4h4.9a1.4 1.4 0 0 0 1.4-1.4z',
  ],

  // Basket: tapered body with two splayed handle rails.
  groceries: [
    'M3.7 9.5h16.6l-1.6 8.9a1.7 1.7 0 0 1-1.66 1.3H6.96a1.7 1.7 0 0 1-1.66-1.3z',
    'M8.5 9.5 10.7 3.9',
    'M15.5 9.5 13.3 3.9',
  ],

  // Ring only — the three dots are drawn separately, see `dots`.
  other: ['M12 3.9a8.1 8.1 0 1 0 0 16.2 8.1 8.1 0 0 0 0-16.2'],

  // Magnifier: circle off-centre up-left, a short handle down-right.
  search: [
    'M10.5 5.1a5.4 5.4 0 1 0 0 10.8 5.4 5.4 0 0 0 0-10.8',
    'M14.6 14.6 19 19',
  ],

  // Coffee: two steam curls over a cup with an overlapping handle.
  coffee: [
    'M8.4 6.6c.7-.9.7-1.8 0-2.7',
    'M12.3 6.6c.7-.9.7-1.8 0-2.7',
    'M4 9.4h12.4v3.1a3.4 3.4 0 0 1-3.4 3.4H7.4a3.4 3.4 0 0 1-3.4-3.4V9.4z',
    'M16.4 10.9h.4a1.9 1.9 0 0 1 0 3.8h-.4',
  ],

  // Gift: box with lid band, a ribbon down the middle, and two loops for a bow.
  gift: [
    'M4.6 10.9h14.8v7.8a1.6 1.6 0 0 1-1.6 1.6H6.2a1.6 1.6 0 0 1-1.6-1.6V10.9z',
    'M4.2 7.9h15.6v1.4H4.2z',
    'M12 9.3v11',
    'M7.5 8.7a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
    'M16.5 8.7a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  ],

  // Paper plane: folded dart with a crease from the left wing tip.
  plane: [
    'M3.4 12.4 20.6 3.4 15.4 20.7z',
    'M3.4 12.4 11 6.2',
  ],

  // Paw: a large pad with four toes arcing over it.
  paw: [
    'M8 15.8a4 4 0 1 0 8 0 4 4 0 0 0-8 0',
    'M4.7 9.6a1.9 2.3 0 1 0 3.8 0 1.9 2.3 0 0 0-3.8 0',
    'M8.1 7.9a1.9 2.3 0 1 0 3.8 0 1.9 2.3 0 0 0-3.8 0',
    'M12.1 7.9a1.9 2.3 0 1 0 3.8 0 1.9 2.3 0 0 0-3.8 0',
    'M15.5 9.6a1.9 2.3 0 1 0 3.8 0 1.9 2.3 0 0 0-3.8 0',
  ],

  // Barbell: central bar with two plate pairs.
  dumbbell: [
    'M4.8 12h14.4',
    'M4.8 7.8h2.4v8.4h-2.4z',
    'M7.2 8.8h2.4v6.4h-2.4z',
    'M14.4 8.8h2.4v6.4h-2.4z',
    'M16.8 7.8h2.4v8.4h-2.4z',
  ],

  // Pacifier: grip ring bar, a rounded shield, and the nipple bulb below.
  baby: [
    'M12 4.6a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2',
    'M9.4 7.2h5.2',
    'M6.8 10.6h10.4v1.6a1.6 1.6 0 0 1-1.6 1.6H8.4a1.6 1.6 0 0 1-1.6-1.6V10.6z',
    'M10.1 15a1.9 1.9 0 1 0 3.8 0 1.9 1.9 0 0 0-3.8 0',
  ],

  // Party hat: pom on top, a cone, and a straight brim.
  party: [
    'M10.5 4.2a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 0 0-3.2 0',
    'M6.9 15.4 12.1 6l5.2 9.4z',
    'M5.9 16.6h12.4',
  ],

  // Cog: hub with eight plate lines — tools, settings, maintenance.
  tools: [
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    'M12 9V6.6',
    'M15 12h2.4',
    'M12 15v2.4',
    'M9 12H6.6',
    'M14.1 9.9 15.9 8.1',
    'M14.1 14.1 15.9 15.9',
    'M9.9 14.1 8.1 15.9',
    'M9.9 9.9 8.1 8.1',
  ],

  // Flower: four petals around a centre, on a stem.
  flower: [
    'M10.1 6.6a1.9 1.9 0 1 0 3.8 0 1.9 1.9 0 0 0-3.8 0',
    'M13.5 10a1.9 1.9 0 1 0 3.8 0 1.9 1.9 0 0 0-3.8 0',
    'M10.1 13.4a1.9 1.9 0 1 0 3.8 0 1.9 1.9 0 0 0-3.8 0',
    'M6.7 10a1.9 1.9 0 1 0 3.8 0 1.9 1.9 0 0 0-3.8 0',
    'M9.8 10a2.2 2.2 0 1 0 4.4 0 2.2 2.2 0 0 0-4.4 0',
    'M12 13.4v6',
  ],

  // Smartphone: rounded screen body with a speaker and a home bar.
  phone: [
    'M7.8 4.4h8.4a1.4 1.4 0 0 1 1.4 1.4v12.4a1.4 1.4 0 0 1-1.4 1.4H7.8a1.4 1.4 0 0 1-1.4-1.4V5.8a1.4 1.4 0 0 1 1.4-1.4z',
    'M10 6.8h4',
    'M10 17.4h4',
  ],

  // Banknote: a note with a coin circle and a value line.
  banknote: [
    'M4.6 6.8h14.8v10.7a1.2 1.2 0 0 1-1.2 1.2H5.8a1.2 1.2 0 0 1-1.2-1.2V6.8z',
    'M10 10a2 2 0 1 0 4 0 2 2 0 0 0-4 0',
    'M12 15.4c1.2-1.2 2.4-1.2 3.6 0',
  ],

  // Bed: mattress frame, headboard rail, two legs and a pillow.
  bed: [
    'M3.6 9.6h16.8v6.4a1.4 1.4 0 0 1-1.4 1.4H5a1.4 1.4 0 0 1-1.4-1.4V9.6z',
    'M3.6 9.6V7h3',
    'M5.4 17.4v2',
    'M18.6 17.4v2',
    'M5.4 10.6h5v2.4H5.4z',
  ],

  // Laptop: screen on a wider base.
  laptop: [
    'M4.7 5.8h14.6v9.3a1 1 0 0 1-1 1H5.7a1 1 0 0 1-1-1z',
    'M3.4 18.4h17.2',
    'M5.7 16.1 3.4 18.4',
    'M18.3 16.1 20.6 18.4',
  ],

  // Droplet nested; reads as "fuel / refill / low".
  fuel: [
    'M12 4.2C8.7 8 6.4 10.9 6.4 13.9A5.6 5.6 0 0 0 12 19.9a5.6 5.6 0 0 0 5.6-6c0-3-2.3-5.9-5.6-9.7z',
    'M12 7.8c-1.7 2.2-2.8 3.9-2.8 5.4A2.8 2.8 0 0 0 12 16.2a2.8 2.8 0 0 0 2.8-3c0-1.5-1.1-3.2-2.8-5.4z',
  ],
};

/**
 * Round dots drawn as part of a glyph's stroke system rather than as stray
 * decoration, expressed as coordinates on the same grid as the paths.
 *
 * A zero-length segment with a round line cap renders as a clean dot at exactly
 * the stroke weight — the same trick `sliders` already used for its knobs. It
 * is generalised here into a per-glyph list so `other` can be a proper
 * three-dot "more" mark drawn in the house style, rather than a borrowed glyph
 * or an emoji. `weight` scales the dot against the stroke; the sliders' knobs
 * keep their original 2.1.
 */
const dots: Partial<Record<IconName, readonly { x: number; y: number; weight: number }[]>> = {
  sliders: [
    { x: 9.4, y: 7.4, weight: 2.1 },
    { x: 14.6, y: 16.6, weight: 2.1 },
  ],
  other: [
    { x: 8.3, y: 12, weight: 1.5 },
    { x: 12, y: 12, weight: 1.5 },
    { x: 15.7, y: 12, weight: 1.5 },
  ],
};

/**
 * Ink box of each glyph in grid units, stroke included: x/y is the top-left of
 * the ink, width/height its extent.
 *
 * The glyphs are hand-drawn rather than metric-matched, so their ink boxes
 * genuinely differ: the house fills 19.1 x 18.1 units while the bar chart only
 * reaches 16.7 x 12.6. Given one shared box, the chart and the sliders
 * therefore rendered roughly a third smaller than the house — measured on
 * Android at 360dp as 12.5pt and 13pt of ink against the house's 18pt — which
 * made them read as unfinished beside it at any size.
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
  check: { x: 3.8, y: 5.6, width: 16.4, height: 12.8 },
  // Lid 4.4 to 19.6, handle top 3.6, can floor 19.65 — centred on x 12.
  trash: { x: 3.5, y: 2.7, width: 17.0, height: 17.9 },
  // Page 3.6 to 20.4 by 4.6 to 19.8; hangers reach the highest.
  calendar: { x: 2.6, y: 3.6, width: 18.8, height: 17.8 },
  chevronLeft: { x: 7.4, y: 4.6, width: 9.2, height: 14.8 },
  chevronRight: { x: 7.4, y: 4.6, width: 9.2, height: 14.8 },
  // Tines 8.6 to 13.4 and blade to 18.8, stem to 20.1 — tall and narrow.
  food: { x: 7.6, y: 2.9, width: 12.2, height: 18.2 },
  // Roof 6.4 to wheels 19.4, nose 3.6 to tail 20.4 — wide and low.
  transport: { x: 2.6, y: 6.4, width: 18.8, height: 13.1 },
  // Handle arc peaks at 3.6, bag floor at 20.5.
  shopping: { x: 4.7, y: 2.6, width: 14.6, height: 18.9 },
  // Ring 3.9 to 20.1; the triangle sits inside it.
  entertainment: { x: 2.9, y: 2.9, width: 18.2, height: 18.2 },
  health: { x: 2.9, y: 5.7, width: 18.2, height: 15.5 },
  education: { x: 2.9, y: 3.7, width: 18.2, height: 16.7 },
  groceries: { x: 2.7, y: 2.9, width: 18.6, height: 17.8 },
  other: { x: 2.9, y: 2.9, width: 18.2, height: 18.2 },
  // Circle 5.1–15.9 with the handle cursor to (19,19) at a 45° line.
  search: { x: 4.1, y: 4.1, width: 15.9, height: 15.9 },
  // Body 4–16.4; handle loops out to 18.7; steam carries the tops to 2.9.
  coffee: { x: 3.0, y: 2.9, width: 16.7, height: 14.0 },
  // Lid spans the widest at 4.2–19.8; the ribbon carries the bottom to ~21.3.
  gift: { x: 3.2, y: 5.7, width: 17.6, height: 15.6 },
  // A dart: nose (20.6, 3.4) to tip (15.4, 20.7), left wing (3.4, 12.4).
  plane: { x: 2.4, y: 2.4, width: 19.2, height: 19.2 },
  // Toes 4.7–19.3 over the pad 8–16, pad floor at 19.8.
  paw: { x: 3.7, y: 4.6, width: 16.6, height: 16.2 },
  // Bar 4.8–19.2; plates 7.8–16.2 make the height.
  dumbbell: { x: 3.7, y: 6.8, width: 16.6, height: 10.4 },
  // Shield 6.8–17.2, ring to 4.6, bulb to 16.9.
  baby: { x: 5.8, y: 3.6, width: 12.4, height: 14.3 },
  // Brim 5.9–18.3; pom carries the top to ~2.6.
  party: { x: 4.9, y: 1.6, width: 14.4, height: 16.0 },
  // Teeth 6.6–17.4 around the hub, symmetric about 12.
  tools: { x: 5.6, y: 5.6, width: 12.8, height: 12.8 },
  // Petals 6.7–15.4; the stem runs to 19.4.
  flower: { x: 5.7, y: 5.6, width: 10.7, height: 14.8 },
  // Body 7.8–17.6 by 4.4–18.2 — tall and narrow like the receipt.
  phone: { x: 6.8, y: 3.4, width: 11.8, height: 15.8 },
  // Note 4.6–19.4 by 6.8–18.7, wide and short.
  banknote: { x: 3.6, y: 5.8, width: 16.8, height: 13.9 },
  // Frame 3.6–20.4, legs to 19.4, headboard to 6.
  bed: { x: 2.6, y: 6.0, width: 18.8, height: 14.4 },
  // Screen 4.7–19.3; the base rails make it the widest glyph.
  laptop: { x: 2.4, y: 4.8, width: 19.2, height: 14.6 },
  // Droplet 6.4–17.6 by 4.2–19.9 — tall, like the receipt.
  fuel: { x: 5.4, y: 3.2, width: 13.2, height: 17.7 },
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

        {dots[name]?.map((dot) => (
          <Path
            key={`${dot.x}-${dot.y}`}
            // A zero-length round-capped segment renders as a clean dot on the
            // track, matching the stroke weight exactly.
            d={`M${dot.x} ${dot.y}h0`}
            stroke={color}
            strokeWidth={gridStroke * dot.weight}
            strokeLinecap="round"
          />
        ))}
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

/*
  The catalogue — icon name unions, the picker set, search hints and the
  predicates over them — lives in `icon-catalog.ts`, a module with no JSX, so
  pure modules in the test graph (`data-transfer`, the category repository)
  can validate names without loading this renderer. Re-exported here so every
  consumer keeps the one import path.
*/
export {
  CATEGORY_ICON_NAMES,
  categoryIconLabel,
  categoryIconMatches,
  isIconName,
  type CategoryIconName,
} from './icon-catalog';