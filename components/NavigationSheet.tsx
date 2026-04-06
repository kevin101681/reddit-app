import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getFavorites, removeFavorite } from '../utils/storage';
import { Spacing, Typography, Radius } from '../constants/theme';
import { useTheme } from '../utils/ThemeContext';

const BRAND    = '#7ba0b3';
const FAB_SIZE = 56;

const SORT_OPTIONS = [
  { label: 'Hot',           value: 'hot' },
  { label: 'New',           value: 'new' },
  { label: 'Top',           value: 'top' },
  { label: 'Controversial', value: 'controversial' },
] as const;

interface NavigationSheetProps {
  sort?: string;
  onSortSelect?: (sort: string) => void;
  viewMode?: 'standard' | 'compact';
  onViewModeToggle?: () => void;
}

export function NavigationSheet({
  sort,
  onSortSelect,
  viewMode,
  onViewModeToggle,
}: NavigationSheetProps) {
  const insets = useSafeAreaInsets();
  const { theme, themeName, toggleTheme } = useTheme();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuInput, setMenuInput]   = useState('');
  const [favorites, setFavorites]   = useState<string[]>([]);

  const fabTranslateY = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getFavorites().then((favs) => { if (active) setFavorites(favs); });
      return () => { active = false; };
    }, [])
  );

  async function handleDeleteFavorite(subreddit: string) {
    Alert.alert(
      'Remove Favourite',
      `Remove r/${subreddit} from your favourites?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeFavorite(subreddit);
            setFavorites((prev) => prev.filter((s) => s !== subreddit));
          },
        },
      ]
    );
  }

  function navigateToSubreddit(subreddit: string) {
    const sub = subreddit.trim().replace(/^r\//i, '');
    if (!sub) return;
    setIsMenuOpen(false);
    setMenuInput('');
    setTimeout(() => {
      router.push({ pathname: '/feed', params: { subreddit: sub } });
    }, 50);
  }

  function handleSortChip(value: string) {
    onSortSelect?.(value);
    setIsMenuOpen(false);
  }

  const fabBottom = Math.max(insets.bottom, Spacing.lg) + Spacing.lg;
  const showSort  = !!sort && !!onSortSelect;

  return (
    <>
      {/* FAB */}
      <Animated.View
        style={[
          styles.fab,
          { bottom: fabBottom, transform: [{ translateY: fabTranslateY }] },
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => setIsMenuOpen(true)}
          style={({ pressed }) => [styles.fabBtn, pressed && styles.fabBtnPressed]}
          accessibilityLabel="Open subreddit menu"
          accessibilityRole="button"
        >
          <Text style={styles.fabIcon}>⊕</Text>
        </Pressable>
      </Animated.View>

      {isMenuOpen && (
        <>
          <Pressable style={styles.menuScrim} onPress={() => setIsMenuOpen(false)} />

          <Animated.View style={[styles.menuPanel, { backgroundColor: theme.surface }]}>
            <View style={[styles.menuHandle, { backgroundColor: theme.border }]} />

            {/* Header row — close button only, title text removed */}
            <View style={styles.menuHeader}>
              <Pressable
                style={({ pressed }) => [
                  styles.menuClose,
                  { backgroundColor: theme.surfaceElevated },
                  pressed && styles.menuClosePressed,
                ]}
                onPress={() => setIsMenuOpen(false)}
                hitSlop={8}
                accessibilityLabel="Close menu"
                accessibilityRole="button"
              >
                <Text style={[styles.menuCloseText, { color: theme.textMuted }]}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}
            >
              {/* ── Theme & View Mode toggles ─────────────────────────────── */}
              <View style={styles.controlRow}>
                <Pressable
                  style={[styles.controlBtn, { borderColor: theme.border, backgroundColor: theme.background }]}
                  onPress={toggleTheme}
                  accessibilityRole="button"
                  accessibilityLabel={themeName === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  <MaterialIcons
                    name={themeName === 'dark' ? 'light-mode' : 'dark-mode'}
                    size={20}
                    color={BRAND}
                  />
                  <Text style={[styles.controlLabel, { color: theme.textMuted }]}>
                    {themeName === 'dark' ? 'Light' : 'Dark'}
                  </Text>
                </Pressable>

                {onViewModeToggle && (
                  <Pressable
                    style={[styles.controlBtn, { borderColor: theme.border, backgroundColor: theme.background }]}
                    onPress={() => { onViewModeToggle(); setIsMenuOpen(false); }}
                    accessibilityRole="button"
                    accessibilityLabel={viewMode === 'standard' ? 'Switch to compact view' : 'Switch to standard view'}
                  >
                    <MaterialIcons
                      name={viewMode === 'standard' ? 'view-list' : 'view-agenda'}
                      size={20}
                      color={BRAND}
                    />
                    <Text style={[styles.controlLabel, { color: theme.textMuted }]}>
                      {viewMode === 'standard' ? 'Compact' : 'Standard'}
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* ── Sort By ───────────────────────────────────────────────── */}
              {showSort && (
                <>
                  <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>SORT BY</Text>
                  <View style={styles.sortChips}>
                    {SORT_OPTIONS.map((option) => (
                      <Pressable
                        key={option.value}
                        style={[
                          styles.sortChip,
                          { borderColor: theme.border, backgroundColor: theme.background },
                          sort === option.value && styles.sortChipActive,
                        ]}
                        onPress={() => handleSortChip(option.value)}
                        accessibilityRole="button"
                        accessibilityLabel={`Sort by ${option.label}`}
                        accessibilityState={{ selected: sort === option.value }}
                      >
                        <Text style={[
                          styles.sortChipText,
                          { color: theme.textMuted },
                          sort === option.value && styles.sortChipTextActive,
                        ]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              {/* ── Subreddit search — no placeholder ────────────────────── */}
              <View style={styles.searchRow}>
                <TextInput
                  style={[styles.searchInput, {
                    backgroundColor: theme.background,
                    color: theme.text,
                    borderColor: theme.border,
                  }]}
                  placeholderTextColor={theme.textMuted}
                  value={menuInput}
                  onChangeText={setMenuInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={() => navigateToSubreddit(menuInput)}
                />
                <Pressable
                  style={({ pressed }) => [styles.goBtn, pressed && styles.goBtnPressed]}
                  onPress={() => navigateToSubreddit(menuInput)}
                >
                  <Text style={styles.goBtnText}>Go</Text>
                </Pressable>
              </View>

              {/* ── Favourites — muted grey label ─────────────────────────── */}
              <Text style={styles.favSectionLabel}>
                {favorites.length === 0 ? 'NO FAVOURITES YET' : 'FAVOURITES'}
              </Text>

              {favorites.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={[styles.emptyStar, { color: theme.textMuted }]}>☆</Text>
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>No saved subreddits</Text>
                  <Text style={[styles.emptyHint, { color: theme.textMuted }]}>
                    Browse any subreddit and tap the ★ star in the header to save it here.
                  </Text>
                </View>
              ) : (
                <View style={[styles.favList, { backgroundColor: theme.surfaceElevated }]}>
                  {favorites.map((fav, index) => (
                    <React.Fragment key={fav}>
                      <View style={[styles.favRow, { backgroundColor: theme.surfaceElevated }]}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.favMain,
                            pressed && { backgroundColor: theme.border },
                          ]}
                          onPress={() => navigateToSubreddit(fav)}
                        >
                          <Text style={[styles.favName, { color: theme.text }]}>r/{fav}</Text>
                          <Text style={[styles.favChevron, { color: theme.textMuted }]}>›</Text>
                        </Pressable>
                        {/* Task 5 — Material trash icon */}
                        <Pressable
                          style={({ pressed }) => [styles.favDelete, pressed && styles.favDeletePressed]}
                          onPress={() => handleDeleteFavorite(fav)}
                          hitSlop={8}
                          accessibilityLabel={`Remove r/${fav} from favourites`}
                          accessibilityRole="button"
                        >
                          <MaterialIcons name="delete-outline" size={24} color="#888" />
                        </Pressable>
                      </View>
                      {index < favorites.length - 1 && (
                        <View style={[styles.favSeparator, { backgroundColor: theme.border }]} />
                      )}
                    </React.Fragment>
                  ))}
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    zIndex: 50,
  },
  fabBtn: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
  },
  fabBtnPressed: { opacity: 0.85 },
  fabIcon: { fontSize: 26, color: '#fff' },

  menuScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 99,
  },
  menuPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%' as any,
    paddingTop: 12,
  },
  menuHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  menuHeader: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    marginBottom: Spacing.xs,
  },
  menuClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuClosePressed: { opacity: 0.6 },
  menuCloseText: {
    fontSize: Typography.md,
    lineHeight: 18,
  },

  // ── Theme & View mode toggles ─────────────────────────────────────────────
  controlRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  controlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  controlLabel: {
    fontSize: Typography.sm,
    fontWeight: '600',
  },

  // ── Sort chips ────────────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: Typography.xs,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
  sortChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sortChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  sortChipActive: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },
  sortChipText: {
    fontSize: Typography.sm,
    fontWeight: '600',
  },
  sortChipTextActive: {
    color: '#fff',
  },

  // ── Search ────────────────────────────────────────────────────────────────
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.md,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
  },
  goBtn: {
    backgroundColor: BRAND,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  goBtnPressed: { opacity: 0.8 },
  goBtnText: { color: '#fff', fontWeight: '700', fontSize: Typography.md },

  // ── Favourites ────────────────────────────────────────────────────────────
  // Fixed muted grey — independent of theme per Task 7
  favSectionLabel: {
    fontSize: Typography.xs,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
    color: '#666666',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyStar: {
    fontSize: 40,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  emptyHint: {
    fontSize: Typography.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  favList: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  favRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  favName: {
    flex: 1,
    fontSize: Typography.md,
    fontWeight: '600',
  },
  favChevron: {
    fontSize: Typography.xl,
    fontWeight: '300',
    marginRight: Spacing.sm,
  },
  favDelete: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  favDeletePressed: { opacity: 0.4 },
  favSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.lg,
  },
});