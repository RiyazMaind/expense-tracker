import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { borders, colors, glass, radii, spacing, touchTarget } from '@/theme';
import {
  addMonths,
  buildMonthGrid,
  buildQuickDateOptions,
  formatFullDate,
  formatMonthYear,
  fromDateKey,
  isSameDateKey,
  toDateKey,
  WEEKDAY_INITIALS,
} from '@/utils/dates';

export type DatePickerProps = {
  /** Selected day as `YYYY-MM-DD`. */
  value: string;
  onChange: (next: string) => void;
  testID?: string;
};

/**
 * Column width for the calendar grid, as a percentage of the sheet body.
 *
 * Percentage rather than `flex: 1`, and that distinction matters: React Native
 * resolves `flex` against content size when the parent wraps, so flexed cells in
 * a `flexWrap` row collapse to the width of the day number and the grid
 * shatters. A percentage width is resolved against the parent, so seven columns
 * always tile the sheet exactly.
 */
const COLUMN_WIDTH = `${100 / WEEKDAY_INITIALS.length}%` as const;

/**
 * The date selector: quick chips for the common case, a calendar for the rest.
 *
 * Backdating is usually zero or one day, so the first two chips are "Today" and
 * "Yesterday" and the following week follows as short dates. Every realistic
 * entry is a single tap. The calendar is there so the field is never a dead end
 * for an expense logged last month, without paying for a full picker on every
 * entry.
 *
 * A date picker dependency was deliberately not added: the brief rules out new
 * dependencies, and the two-date-plus-grid case is small enough to own.
 */
export function DatePicker({ value, onChange, testID }: DatePickerProps) {
  const today = useMemo(() => new Date(), []);
  const todayKey = toDateKey(today);
  const quickOptions = useMemo(() => buildQuickDateOptions(today), [today]);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const selectedDate = useMemo(() => fromDateKey(value), [value]);

  const handleSelect = (key: string) => {
    if (!isSameDateKey(key, value)) {
      Haptics.selectionAsync().catch(() => {
        // Never block the tap on a device without haptics.
      });
      onChange(key);
    }
  };

  const handleOpenCalendar = () => {
    Haptics.selectionAsync().catch(() => {
      // Never block the tap on a device without haptics.
    });
    setCalendarOpen(true);
  };

  return (
    <View style={styles.root} testID={testID}>
      <View style={styles.heading}>
        <Text variant="label" tone="secondary">
          Date
        </Text>
        <Pressable
          onPress={handleOpenCalendar}
          accessibilityRole="button"
          accessibilityLabel="Choose a date"
          accessibilityHint="Opens a calendar"
          style={({ pressed }) => [styles.calendarButton, pressed && styles.pressed]}
          testID="open-calendar"
        >
          <Icon name="calendar" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Taps must land on a chip even if the list is mid-settle, otherwise a
        // quick entry can miss.
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chips}
        style={styles.chipsScroll}
        accessibilityRole="radiogroup"
        accessibilityLabel="Date"
      >
        {quickOptions.map((option) => {
          const selected = isSameDateKey(option.key, value);

          return (
            <Pressable
              key={option.key}
              onPress={() => handleSelect(option.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={describeOption(option.key, option.label, todayKey)}
              style={({ pressed }) => [
                styles.chip,
                selected ? styles.chipSelected : styles.chipIdle,
                pressed && styles.pressed,
              ]}
              testID={`date-${option.key}`}
            >
              <Text
                variant="body"
                tone={selected ? 'primary' : 'secondary'}
                numberOfLines={1}
                style={selected ? styles.chipLabelSelected : undefined}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/*
        The chips are abbreviated, so the resolved date is always spelled out.
        Without this, "3 Oct" is the only record of which day was chosen.
      */}
      <Text variant="caption" tone="tertiary" testID="date-resolved">
        {formatFullDate(selectedDate)}
      </Text>

      <CalendarSheet
        visible={calendarOpen}
        selectedKey={value}
        month={selectedDate}
        onClose={() => setCalendarOpen(false)}
        onSelect={(key) => {
          handleSelect(key);
          setCalendarOpen(false);
        }}
        todayKey={todayKey}
      />
    </View>
  );
}

/** "Yesterday, 5 October 2026" rather than just the chip's short label. */
function describeOption(key: string, label: string, todayKey: string): string {
  if (isSameDateKey(key, todayKey)) {
    return 'Today';
  }

  return `${label}, ${formatFullDate(fromDateKey(key))}`;
}

/**
 * Month grid in a native modal.
 *
 * Native `Modal` rather than an in-page overlay so the Android back button
 * dismisses it, and so the grid is announced and dismissed as its own surface
 * (vercel-react-native-skills/rules/ui-native-modals.md).
 */
function CalendarSheet({
  visible,
  selectedKey,
  month,
  onClose,
  onSelect,
  todayKey,
}: {
  visible: boolean;
  selectedKey: string;
  month: Date;
  onClose: () => void;
  onSelect: (key: string) => void;
  todayKey: string;
}) {
  const { width } = useWindowDimensions();
  const [viewMonth, setViewMonth] = useState(() => new Date(month));

  const days = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  // The sheet reaches closer to the screen edges and pads less than a typical
  // modal, purely so seven columns can clear 44dp on a 360dp phone. At the old
  // margins every day cell came out at 42.3dp — a miss wide enough to make
  // adjacent dates genuinely hard to hit, and the whole point of a calendar is
  // hitting the day you meant.
  const sheetWidth = Math.min(width - spacing.sm * 2, 380);

  /**
   * Re-anchor the grid on every close, so reopening always starts at the day
   * currently chosen instead of wherever the user browsed last time.
   *
   * Done in the close handlers rather than in an effect keyed on `visible`: the
   * sheet has exactly three exits — backdrop, day selection and hardware back —
   * and all of them pass through here, so there is one place to reset and no
   * cascading render on open.
   */
  const handleClose = () => {
    setViewMonth(new Date(month));
    onClose();
  };

  const handleShiftMonth = (delta: number) => {
    Haptics.selectionAsync().catch(() => {
      // Never block the tap on a device without haptics.
    });
    setViewMonth((current) => addMonths(current, delta));
  };

  const handleSelectDay = (date: Date) => {
    Haptics.selectionAsync().catch(() => {
      // Never block the tap on a device without haptics.
    });
    setViewMonth(new Date(month));
    onSelect(toDateKey(date));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={handleClose}
        accessibilityRole="button"
        accessibilityLabel="Close date picker"
      />

      <View style={styles.sheetPosition} pointerEvents="box-none">
        <GlassSurface
          level="strong"
          radius={radii.xl}
          shadow="lg"
          highlighted
          style={{ width: sheetWidth }}
          testID="calendar-sheet"
        >
          <View style={styles.sheetBody}>
            <View style={styles.sheetHeader}>
              <Pressable
                onPress={() => handleShiftMonth(-1)}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
                testID="calendar-prev"
              >
                <Icon name="chevronLeft" size={18} color={colors.textSecondary} />
              </Pressable>

              <Text variant="title3" center accessibilityRole="header">
                {formatMonthYear(viewMonth)}
              </Text>

              <Pressable
                onPress={() => handleShiftMonth(1)}
                accessibilityRole="button"
                accessibilityLabel="Next month"
                style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
                testID="calendar-next"
              >
                <Icon name="chevronRight" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.weekdayRow}>
              {WEEKDAY_INITIALS.map((initial, index) => (
                <View key={`${initial}-${index}`} style={styles.gridCell}>
                  <Text variant="micro" tone="tertiary" center>
                    {initial}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.days}>
              {days.map((date) => {
                const key = toDateKey(date);
                const selected = isSameDateKey(key, selectedKey);
                const isToday = isSameDateKey(key, todayKey);
                const outsideMonth = date.getMonth() !== viewMonth.getMonth();

                return (
                  <View key={key} style={styles.gridCell}>
                    <Pressable
                      onPress={() => handleSelectDay(date)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, checked: selected }}
                      accessibilityLabel={formatFullDate(date)}
                      style={({ pressed }) => [
                        styles.day,
                        selected && styles.daySelected,
                        pressed && styles.pressed,
                      ]}
                      testID={`calendar-day-${key}`}
                    >
                      <Text
                        variant="body"
                        tone={
                          selected
                            ? 'onAccent'
                            : outsideMonth
                              ? 'tertiary'
                              : isToday
                                ? 'accent'
                                : 'primary'
                        }
                        style={selected || isToday ? styles.dayLabelStrong : undefined}
                      >
                        {`${date.getDate()}`}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <View style={styles.sheetFooter}>
              <Pressable
                onPress={() => handleSelectDay(fromDateKey(todayKey))}
                accessibilityRole="button"
                accessibilityLabel="Jump to today"
                style={({ pressed }) => [styles.todayButton, pressed && styles.pressed]}
                testID="calendar-today"
              >
                <Text variant="caption" tone="accent" style={styles.todayLabel}>
                  Jump to today
                </Text>
              </Pressable>
            </View>
          </View>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarButton: {
    // Square, and at the 44pt touch floor.
    width: touchTarget.min,
    height: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.sm,
    borderRadius: radii.md,
    borderCurve: 'continuous',
  },
  chipsScroll: {
    // Room for the chip border and its own focus ring.
    marginHorizontal: -spacing.xxs,
  },
  chips: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xxs,
    paddingVertical: spacing.xxs,
  },
  chip: {
    // Clears the 44pt touch floor even though the visual chip is a slim
    // segmented control.
    minHeight: touchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  chipIdle: {
    backgroundColor: glass.subtle,
    borderColor: borders.subtle,
  },
  chipSelected: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  chipLabelSelected: {
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim,
  },
  sheetPosition: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  sheetBody: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  navButton: {
    width: touchTarget.min,
    height: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderCurve: 'continuous',
    backgroundColor: glass.subtle,
    borderWidth: 1,
    borderColor: borders.subtle,
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  days: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  /**
   * Equal-width columns driven by a percentage width rather than a precomputed
   * pixel size. The old `cellSize` arithmetic silently produced 42.3dp targets
   * because it could not know the device width.
   */
  gridCell: {
    width: COLUMN_WIDTH,
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: {
    width: '100%',
    // Stretching the cell would undo the 44dp floor the flex column guarantees.
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderCurve: 'continuous',
  },
  daySelected: {
    backgroundColor: colors.accent,
  },
  dayLabelStrong: {
    fontWeight: '700',
  },
  sheetFooter: {
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  todayButton: {
    minHeight: touchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  todayLabel: {
    fontWeight: '700',
  },
});