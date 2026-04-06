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

export function NavigationSheet() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuInput, setMenuInput]   = useState('');
  const [favorites, setFavorites]   = useState<string[]>([]);

  // ── FAB hide-on-scroll animation ─────────────────────────────────────────
  const fabTranslateY = useRef(new Animated.Value(0)).current;

  // ── Favorites ─────────────────────────────────────────────────────────────
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

  const fabBottom = Math.max(insets.bottom, Spacing.lg) + Spacing.lg;

  return (
    <>
      {/* Hide-on-scroll FAB */}
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
          <MaterialIcons name="explore" size={26} color="#fff" />
        </Pressable>
      </Animated.View>

      {/* Subreddit menu bottom sheet */}
      {isMenuOpen && (
        <>
          {/* Scrim */}
          <Pressable
            style={styles.menuScrim}
            onPress={() => setIsMenuOpen(false)}
          />

          <Animated.View style={[styles.menuPanel, { backgroundColor: theme.surface }]}>
            {/* Drag handle */}
            <View style={[styles.menuHandle, { backgroundColor: theme.border }]} />

            {/* Title row */}
            <View style={styles.menuHeader}>
              <Text style={[styles.menuTitle, { color: theme.text }]}>Subreddits</Text>
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

            {/* Single ScrollView — search + favourites scroll together */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}
            >
              {/* Search bar */}
              <View style={styles.searchRow}>
                <TextInput
                  style={[styles.searchInput, {
                    backgroundColor: theme.background,
                    color: theme.text,
                    borderColor: theme.border,
                  }]}
                  placeholder="r/subreddit name…"
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

              {/* Favourites */}
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
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
                        <Pressable
                          style={({ pressed }) => [styles.favDelete, pressed && styles.favDeletePressed]}
                          onPress={() => handleDeleteFavorite(fav)}
                          hitSlop={8}
                        >
                          <Text style={styles.favDeleteIcon}>🗑</Text>
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
    margin: 0,
    zIndex: 100,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%' as any,
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: Spacing.sm,
  },
  menuTitle: {
    flex: 1,
    fontSize: Typography.lg,
    fontWeight: '700',
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
  sectionLabel: {
    fontSize: Typography.xs,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
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
  favDeleteIcon: { fontSize: 18 },
  favSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.lg,
  },
});
