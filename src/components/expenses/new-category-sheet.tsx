import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import {
  CATEGORY_ICON_NAMES,
  categoryIconLabel,
  categoryIconMatches,
  Icon,
  type CategoryIconName,
} from '@/components/ui/icon';
import { ButtonLabel, GlassButton } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  CUSTOM_CATEGORY_COLORS,
  categories,
  tint,
  type Category,
} from '@/constants/categories';
import { CATEGORY_NAME_MAX_LENGTH } from '@/database/repositories/category-repository';
import { useCategoryStore } from '@/store/categoryStore';
import { borders, colors, glass, radii, spacing, textVariants, touchTarget } from '@/theme';

export type NewCategorySheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Fired with the freshly created, already-persisted category. */
  onCreated: (category: Category) => void;
};

/**
 * Create a category: name it and pick its icon.
 *
 * A native `Modal` like the calendar sheet (vercel-react-native-skills/rules/
 * ui-native-modals.md), so the Android back button dismisses it and it reads as
 * its own surface. Everything is validated here, before `onCreated`, so the
 * picker only ever learns about a category that actually exists in SQLite.
 *
 * The icon grid is searchable: twenty-five glyphs is too many to scan, and a
 * category's icon is the first thing people will look at later in the history
 * list — worth the one extra tap an exact search saves.
 */

/** Columns in the icon grid. Five clear the 44pt touch floor on a 360dp phone and keep the sheet short enough to sit beside the keyboard. */
const ICON_COLUMNS = 5;

export function NewCategorySheet({ visible, onClose, onCreated }: NewCategorySheetProps) {
  const { width } = useWindowDimensions();
  const customCategories = useCategoryStore((state) => state.ordered);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState<CategoryIconName>('food');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sheetWidth = Math.min(width - spacing.sm * 2, 380);

  const trimmedName = name.trim();
  const duplicate = isDuplicateName(trimmedName, customCategories);
  const valid = trimmedName !== '' && !duplicate;

  // The store assigns a colour by rotation before creating; mirror it here so
  // the preview chip shows the colour the category will actually get.
  const previewColor = CUSTOM_CATEGORY_COLORS[customCategories.length % CUSTOM_CATEGORY_COLORS.length];

  const iconChoices = CATEGORY_ICON_NAMES.filter((choice) => categoryIconMatches(choice, query));

  const handleCreate = async () => {
    if (!valid || creating) {
      return;
    }

    /*
      Set before awaiting, like the save button on Add Expense: a second tap
      inside the write would create two categories. The button's `disabled` prop
      is not a substitute, because a press already dispatched is not withdrawn.
    */
    setCreating(true);
    setError(null);

    try {
      const category = await useCategoryStore.getState().create(trimmedName, icon);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
        // Never block on a device without haptics.
      });
      onCreated(category);
    } catch (createError) {
      console.warn('[new-category] could not create the category', createError);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {
        // Never block on a device without haptics.
      });

      setCreating(false);
      setError(
        createError instanceof Error ? createError.message : 'Could not create the category',
      );
    }
  };

  const handleSelectIcon = (choice: CategoryIconName) => {
    if (choice === icon) {
      return;
    }

    Haptics.selectionAsync().catch(() => {
      // Never block the tap on a device without haptics.
    });
    setIcon(choice);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close new category"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetPosition}
        pointerEvents="box-none"
      >
        <GlassSurface
          level="strong"
          solid={Platform.OS === 'android'}
          radius={radii.xl}
          shadow="lg"
          highlighted
          style={{ width: sheetWidth }}
          testID="new-category-sheet"
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.sheetBody}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.sheetHeader}>
              <View style={styles.headerSpacer} />
              <Text variant="title3" center accessibilityRole="header">
                New category
              </Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                testID="new-category-close"
              >
                <Icon name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.field}>
              <Text variant="label" tone="secondary">
                Name
              </Text>
              <GlassSurface
                level="subtle"
                borderLevel="subtle"
                radius={radii.lg}
                shadow="sm"
              >
                <TextInput
                  value={name}
                  onChangeText={(next) => {
                    setName(next);
                    setError(null);
                  }}
                  placeholder="E.g. Rent"
                  placeholderTextColor={colors.textTertiary}
                  maxLength={CATEGORY_NAME_MAX_LENGTH}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  blurOnSubmit
                  selectionColor={colors.accent}
                  underlineColorAndroid="transparent"
                  style={styles.input}
                  accessibilityLabel="Category name"
                  accessibilityHint="A short name for the new category"
                  testID="new-category-name"
                />
              </GlassSurface>
              {error != null ? (
                <Text
                  variant="caption"
                  tone="destructive"
                  accessibilityLiveRegion="polite"
                  testID="new-category-error"
                >
                  {error}
                </Text>
              ) : duplicate ? (
                <Text variant="caption" tone="destructive" testID="new-category-duplicate">
                  A category is already named that
                </Text>
              ) : null}
            </View>

            {/*
              Live preview in the picker chip's own language, so what gets
              created is exactly what the user sees — cheap insurance against
              "that's not the chip I meant" surprises later in the list.
            */}
            <View
              style={[
                styles.preview,
                { backgroundColor: tint(previewColor), borderColor: previewColor + '66' },
              ]}
              accessible
              accessibilityLabel={`Preview: ${trimmedName === '' ? 'category' : trimmedName} with a ${categoryIconLabel(icon)} icon`}
            >
              <Icon name={icon} size={20} color={previewColor} />
              <Text
                variant="caption"
                numberOfLines={1}
                style={{ color: previewColor, fontWeight: '700' }}
              >
                {trimmedName === '' ? 'Category' : trimmedName}
              </Text>
            </View>

            <View style={styles.field}>
              <Text variant="label" tone="secondary">
                Pick an icon
              </Text>

              <GlassSurface
                level="subtle"
                borderLevel="subtle"
                radius={radii.lg}
                shadow="sm"
              >
                <View style={styles.searchRow}>
                  <Icon name="search" size={16} color={colors.textSecondary} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search icons"
                    placeholderTextColor={colors.textTertiary}
                    maxLength={40}
                    returnKeyType="search"
                    selectionColor={colors.accent}
                    underlineColorAndroid="transparent"
                    style={styles.input}
                    accessibilityLabel="Search icons"
                    accessibilityHint="Filters the icons by name or meaning"
                    testID="icon-search"
                  />
                  {query.trim() !== '' ? (
                    <Pressable
                      onPress={() => setQuery('')}
                      accessibilityRole="button"
                      accessibilityLabel="Clear search"
                      style={({ pressed }) => [styles.searchClear, pressed && styles.pressed]}
                      testID="icon-search-clear"
                    >
                      <Icon name="close" size={16} color={colors.textSecondary} />
                    </Pressable>
                  ) : null}
                </View>
              </GlassSurface>

              <View
                style={styles.grid}
                accessibilityRole="radiogroup"
                accessibilityLabel="Icon"
              >
                {iconChoices.map((choice) => {
                  const selected = choice === icon;

                  return (
                    <Pressable
                      key={choice}
                      onPress={() => handleSelectIcon(choice)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, checked: selected }}
                      accessibilityLabel={`${categoryIconLabel(choice)} icon`}
                      style={({ pressed }) => [
                        styles.iconCell,
                        selected
                          ? {
                              backgroundColor: tint(previewColor),
                              borderColor: previewColor + '66',
                            }
                          : styles.iconCellIdle,
                        pressed && styles.iconCellPressed,
                      ]}
                      testID={`icon-${choice}`}
                    >
                      <Icon
                        name={choice}
                        size={22}
                        color={selected ? previewColor : colors.textSecondary}
                        strokeWidth={selected ? 2.2 : 1.8}
                      />
                    </Pressable>
                  );
                })}
              </View>

              {iconChoices.length === 0 ? (
                <Text
                  variant="caption"
                  tone="tertiary"
                  center
                  accessibilityLiveRegion="polite"
                  testID="icon-no-matches"
                >
                  No icons match {`"${query.trim()}"`}
                </Text>
              ) : null}
            </View>

            <GlassButton
              block
              size="lg"
              variant="primary"
              onPress={handleCreate}
              disabled={!valid || creating}
              haptic={false}
              accessibilityLabel={creating ? 'Creating category' : 'Create category'}
              accessibilityHint={
                valid
                  ? 'Creates the category and adds it to the list'
                  : 'Enter a name that is not already used first'
              }
              testID="create-category"
            >
              <ButtonLabel>{creating ? 'Creating…' : 'Create category'}</ButtonLabel>
            </GlassButton>
          </ScrollView>
        </GlassSurface>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Whether the trimmed name already belongs to a builtin or an existing custom
 * category, case-insensitively. Two chips that read the same defeat the point
 * of naming a category, so this is a blocking check, not a hint.
 */
function isDuplicateName(
  name: string,
  customCategories: readonly Category[],
): boolean {
  if (name === '') {
    return false;
  }

  const needle = name.toLowerCase();

  if (categories.some((category) => category.label.toLowerCase() === needle)) {
    return true;
  }

  return customCategories.some((category) => category.label.toLowerCase() === needle);
}

const styles = StyleSheet.create({
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
    maxWidth: 380,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerSpacer: {
    width: touchTarget.min,
    height: touchTarget.min,
  },
  iconButton: {
    width: touchTarget.min,
    height: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  field: {
    gap: spacing.xs,
  },
  input: {
    ...textVariants.body,
    color: colors.text,
    flex: 1,
    padding: 0,
    margin: 0,
    minHeight: touchTarget.min,
    textAlignVertical: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  searchClear: {
    width: touchTarget.min,
    height: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  iconCell: {
    // One fifth of the sheet body, percentage-based so the grid tiles exactly
    // at any sheet width (the same reasoning as the calendar's columns).
    width: `${100 / ICON_COLUMNS}%`,
    aspectRatio: 1,
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  iconCellIdle: {
    backgroundColor: glass.subtle,
    borderColor: borders.subtle,
  },
  iconCellPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.94 }],
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 64,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});