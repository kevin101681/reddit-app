import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewToken,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPosts } from '../utils/api';
import { RedditPost } from '../utils/types';
import { PostCard } from '../components/PostCard';
import { FeedSkeleton } from '../components/SkeletonLoader';
import { getFavorites, removeFavorite, getSortPreference, setSortPreference } from '../utils/storage';
import { Colors, Spacing, Typography, Radius } from '../constants/theme';
import { useTheme } from '../utils/ThemeContext';

const SUBREDDIT = 'all';
const BRAND     = '#7ba0b3';
const FAB_SIZE  = 56;

const SORT_OPTIONS = [
  { label: 'Hot',           value: 'hot' },
  { label: 'New',           value: 'new' },
  { label: 'Top',           value: 'top' },
  { label: 'Controversial', value: 'controversial' },
] as const;

export default function FrontpageScreen() {
  const insets = useSafeAreaInsets();
  const { theme, themeName, toggleTheme } = useTheme();

  const [sort, setSort]             = useState('hot');
  const [posts, setPosts]           = useState<RedditPost[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [after, setAfter]           = useState<string | undefined>(undefined);
  const [hasMore, setHasMore]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Menu state ───────────────────────────────────────────────────────────────
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuInput, setMenuInput]   = useState('');
  const [favorites, setFavorites]   = useState<string[]>([]);

  // ── Sort dropdown state ──────────────────────────────────────────────────────
  const [isSortOpen, setIsSortOpen] = useState(false);

  // ── View mode ────────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'standard' | 'compact'>('standard');

  // ── Viewability ───────────────────────────────────────────────────────────────
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      setActivePostId(viewableItems[0]?.item?.id ?? null);
    }
  ).current;

  // ── FAB hide-on-scroll ────────────────────────────────────────────────────────
  const fabTranslateY = useRef(new Animated.Value(0)).current;
  const isFabHidden   = useRef(false);
  const lastScrollY   = useRef(0);

  const handleScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      const y  = e.nativeEvent.contentOffset.y;
      const dy = y - lastScrollY.current;
      lastScrollY.current = y;

      if (Math.abs(dy) < 4) return;

      if (dy > 0 && !isFabHidden.current) {
        isFabHidden.current = true;
        Animated.spring(fabTranslateY, {
          toValue: FAB_SIZE + 32 + insets.bottom,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
        }).start();
      } else if (dy < 0 && isFabHidden.current) {
        isFabHidden.current = false;
        Animated.spring(fabTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
        }).start();
      }
    },
    [insets.bottom, fabTranslateY]
  );

  // ── Sort ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    getSortPreference(SUBREDDIT).then((s) => { if (active) setSort(s); });
    return () => { active = false; };
  }, []);

  const handleSortSelect = useCallback(async (newSort: string) => {
    setSortPreference(newSort, SUBREDDIT);
    setSort(newSort);
    setIsSortOpen(false);
  }, []);

  // ── Favorites ─────────────────────────────────────────────────────────────────
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

  // ── Data fetching ─────────────────────────────────────────────────────────────
  const fetchPosts = useCallback(
    async (reset: boolean, cursor?: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setError(null);
        const data = await getPosts(SUBREDDIT, sort, cursor, controller.signal);
        setPosts((prev) => (reset ? data.posts : [...prev, ...data.posts]));
        const nextCursor =
          data.after ?? (data.posts.length ? data.posts[data.posts.length - 1].name : undefined);
        setAfter(nextCursor ?? undefined);
        setHasMore(!!nextCursor && data.posts.length > 0);
      } catch (err: any) {
        if (err?.name !== 'AbortError') setError(err?.message ?? 'Failed to load posts');
      }
    },
    [sort]
  );

  useEffect(() => {
    setLoading(true);
    setPosts([]);
    setAfter(undefined);
    setHasMore(true);
    setActivePostId(null);
    fetchPosts(true).finally(() => setLoading(false));
    return () => abortRef.current?.abort();
  }, [fetchPosts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setAfter(undefined);
    setHasMore(true);
    await fetchPosts(true);
    setRefreshing(false);
  }, [fetchPosts]);

  const onEndReached = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await fetchPosts(false, after);
    setLoadingMore(false);
  }, [loadingMore, hasMore, after, fetchPosts]);

  const renderItem = useCallback(
    ({ item }: { item: RedditPost }) => (
      <PostCard post={item} activePostId={activePostId} viewMode={viewMode} />
    ),
    [activePostId, viewMode]
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  const fabBottom = Math.max(insets.bottom, Spacing.lg) + Spacing.lg;
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Hot';

  const renderBody = () => {
    if (loading) {
      return (
        <View style={[styles.fillContainer, { backgroundColor: theme.background }]}>
          <FeedSkeleton />
        </View>
      );
    }

    if (error && posts.length === 0) {
      return (
        <View style={[styles.center, { backgroundColor: theme.background }]}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={[styles.errorTitle, { color: theme.text }]}>Could not load posts</Text>
          <Text style={[styles.errorMessage, { color: theme.textMuted }]}>{error}</Text>
          <Text style={[styles.retryHint, { color: theme.textMuted }]}>Pull down to retry</Text>
        </View>
      );
    }

    return (
      <View style={[styles.fillContainer, { backgroundColor: theme.background }]}>
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={[styles.fillContainer, { backgroundColor: theme.background }]}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: FAB_SIZE + fabBottom + Spacing.xl },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={BRAND}
              colors={[BRAND]}
              progressBackgroundColor={theme.surface}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          removeClippedSubviews
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={11}
          ListHeaderComponent={
            error ? (
              <View style={[styles.errorBanner, { backgroundColor: theme.surface }]}>
                <Text style={[styles.errorBannerText, { color: theme.textMuted }]}>⚠️ {error}</Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={BRAND} style={styles.loadingMore} />
            ) : null
          }
        />

        {/* Material 3 sort dropdown */}
        {isSortOpen && (
          <>
            <Pressable style={styles.sortBackdrop} onPress={() => setIsSortOpen(false)} />
            <View style={[styles.sortDropdown, { backgroundColor: theme.surface }]}>
              {SORT_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={({ pressed }) => [
                    styles.sortRow,
                    pressed && { backgroundColor: theme.surfaceElevated },
                  ]}
                  onPress={() => handleSortSelect(option.value)}
                >
                  <Text style={[
                    styles.sortRowText,
                    { color: theme.text },
                    sort === option.value && styles.sortRowTextActive,
                  ]}>
                    {option.label}
                  </Text>
                  {sort === option.value && (
                    <MaterialIcons name="check" size={16} color={BRAND} />
                  )}
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    // Plain View — extends to the physical screen edges.
    // expo-router's Stack.Screen handles the top safe area natively via the
    // header; no paddingTop needed here. Bottom stays at 0 so the absolute
    // menu panel anchors flush to the physical screen edge.
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'r/all',
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: '700', color: theme.text },
          headerShown: true,
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable
                onPress={toggleTheme}
                style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}
                hitSlop={8}
                accessibilityLabel={themeName === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                accessibilityRole="button"
              >
                <MaterialIcons
                  name={themeName === 'dark' ? 'light-mode' : 'dark-mode'}
                  size={22}
                  color={BRAND}
                />
              </Pressable>
              <Pressable
                onPress={() => setViewMode((m) => m === 'standard' ? 'compact' : 'standard')}
                style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}
                hitSlop={8}
                accessibilityLabel={viewMode === 'standard' ? 'Switch to compact view' : 'Switch to standard view'}
                accessibilityRole="button"
              >
                <MaterialIcons
                  name={viewMode === 'standard' ? 'view-list' : 'view-agenda'}
                  size={22}
                  color={BRAND}
                />
              </Pressable>
              <Pressable
                onPress={() => setIsSortOpen((prev) => !prev)}
                style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}
                hitSlop={8}
                accessibilityLabel={`Sort: ${sortLabel}`}
                accessibilityRole="button"
              >
                <MaterialIcons name="filter-list" size={24} color={BRAND} />
              </Pressable>
            </View>
          ),
        }}
      />

      <View style={styles.fillContainer}>{renderBody()}</View>

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

      {/* Subreddit menu — direct child of the root View so bottom:0 is the
          physical screen edge, eliminating any safe-area gap. */}
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

            {/* Single ScrollView — search bar + favourites scroll as one block */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  // Root View — no SafeAreaView; touches physical screen edges.
  // Background color applied inline from theme so it updates on toggle.
  screen: {
    flex: 1,
  },
  fillContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingTop: Spacing.sm,
  },
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  errorIcon: { fontSize: 40, marginBottom: Spacing.md },
  errorTitle: {
    color: Colors.text,
    fontSize: Typography.lg,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  errorMessage: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  retryHint: { color: Colors.textDisabled, fontSize: Typography.sm },
  errorBanner: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 8,
  },
  errorBannerText: { color: Colors.textMuted, fontSize: Typography.sm },
  loadingMore: { paddingVertical: Spacing.xl },
  headerBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },
  headerBtnPressed: { opacity: 0.5 },

  // ── FAB ──────────────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    right: Spacing.lg,
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

  // ── Sort dropdown ─────────────────────────────────────────────────────────────
  sortBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  sortDropdown: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    elevation: 5,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    minWidth: 160,
    overflow: 'hidden',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  sortRowPressed: { backgroundColor: '#2a2a2a' },
  sortRowText: { color: Colors.text, fontSize: Typography.md },
  sortRowTextActive: { color: BRAND, fontWeight: '700' },

  // ── Menu panel ────────────────────────────────────────────────────────────────
  menuScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 99,
  },
  // Animated.View anchored to the physical bottom edge (bottom:0 of the root
  // View which has no bottom safe-area padding). paddingBottom is applied
  // inside the ScrollView contentContainerStyle.
  menuPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    margin: 0,
    zIndex: 100,
    backgroundColor: '#121212',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%' as any,
    paddingTop: 12,
    paddingHorizontal: 0,
  },
  menuHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
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
    color: Colors.text,
    fontSize: Typography.lg,
    fontWeight: '700',
  },
  menuClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuClosePressed: { opacity: 0.6 },
  menuCloseText: {
    color: Colors.textMuted,
    fontSize: Typography.md,
    lineHeight: 18,
  },

  // ── Search ────────────────────────────────────────────────────────────────────
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontSize: Typography.md,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  goBtn: {
    backgroundColor: BRAND,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  goBtnPressed: { opacity: 0.8 },
  goBtnText: { color: '#fff', fontWeight: '700', fontSize: Typography.md },

  // ── Favourites ────────────────────────────────────────────────────────────────
  sectionLabel: {
    color: Colors.textMuted,
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
    color: Colors.textDisabled,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: Typography.lg,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  emptyHint: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  favList: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  favRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  favMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  favMainPressed: { backgroundColor: Colors.surfaceElevated },
  favName: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.md,
    fontWeight: '600',
  },
  favChevron: {
    color: Colors.textDisabled,
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
    backgroundColor: Colors.border,
    marginLeft: Spacing.lg,
  },
});
