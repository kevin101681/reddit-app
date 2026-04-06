import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  ViewToken,
  ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { getPosts } from '../utils/api';
import { RedditPost } from '../utils/types';
import { PostCard } from '../components/PostCard';
import { FeedSkeleton } from '../components/SkeletonLoader';
import { getFavorites, addFavorite, removeFavorite, getSortPreference, setSortPreference, getViewModePreference, setViewModePreference } from '../utils/storage';
import { Colors, Spacing, Typography } from '../constants/theme';
import { useTheme } from '../utils/ThemeContext';
import { NavigationSheet } from '../components/NavigationSheet';

const BRAND = '#7ba0b3';

const SORT_OPTIONS = [
  { label: 'Hot',           value: 'hot' },
  { label: 'New',           value: 'new' },
  { label: 'Top',           value: 'top' },
  { label: 'Controversial', value: 'controversial' },
] as const;

export default function FeedScreen() {
  const { subreddit } = useLocalSearchParams<{ subreddit: string }>();
  const sub = (Array.isArray(subreddit) ? subreddit[0] : subreddit) ?? 'popular';
  const { theme, themeName, toggleTheme } = useTheme();
  const [viewMode, setViewMode] = useState<'standard' | 'compact'>('standard');

  // ── Viewability — MUST be useRef so FlatList never sees a new reference ─────
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      setActivePostId(viewableItems[0]?.item?.id ?? null);
    }
  ).current;

  // ── Sort preference ─────────────────────────────────────────────────────────
  const [sort, setSort] = useState('hot');

  useEffect(() => {
    let active = true;
    Promise.all([getSortPreference(sub), getViewModePreference(sub)]).then(([s, v]) => {
      if (!active) return;
      setSort(s);
      setViewMode(v as 'standard' | 'compact');
    });
    return () => { active = false; };
  }, [sub]);

  const handleSortSelect = useCallback(async (newSort: string) => {
    setSortPreference(newSort, sub);
    setSort(newSort);
  }, [sub]);

  function openSortPicker() {
    const labels  = SORT_OPTIONS.map((o) => o.label);
    const current = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Hot';

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: 'Sort by', options: [...labels, 'Cancel'], cancelButtonIndex: labels.length },
        (i) => { if (i < SORT_OPTIONS.length) handleSortSelect(SORT_OPTIONS[i].value); }
      );
    } else {
      Alert.alert(
        'Sort by',
        `Currently: ${current}`,
        [
          ...SORT_OPTIONS.map((o) => ({
            text: o.value === sort ? `${o.label} ✓` : o.label,
            onPress: () => handleSortSelect(o.value),
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ],
        { cancelable: true }
      );
    }
  }

  // ── Feed state ──────────────────────────────────────────────────────────────
  const [posts, setPosts]           = useState<RedditPost[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [after, setAfter]           = useState<string | undefined>(undefined);
  const [hasMore, setHasMore]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Favourite state ─────────────────────────────────────────────────────────
  const [isFavorited, setIsFavorited] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getFavorites().then((favs) => {
      if (!cancelled) setIsFavorited(favs.includes(sub.toLowerCase()));
    });
    return () => { cancelled = true; };
  }, [sub]);

  async function toggleFavorite() {
    if (isFavorited) {
      await removeFavorite(sub);
      setIsFavorited(false);
    } else {
      await addFavorite(sub);
      setIsFavorited(true);
    }
  }

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchPosts = useCallback(
    async (reset: boolean, cursor?: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setError(null);
        const data = await getPosts(sub, sort, cursor, controller.signal);
        setPosts((prev) => (reset ? data.posts : [...prev, ...data.posts]));
        const nextCursor =
          data.after ?? (data.posts.length ? data.posts[data.posts.length - 1].name : undefined);
        setAfter(nextCursor ?? undefined);
        setHasMore(!!nextCursor && data.posts.length > 0);
      } catch (err: any) {
        if (err?.name !== 'AbortError') setError(err?.message ?? 'Failed to load posts');
      }
    },
    [sub, sort]
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

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Hot';

  return (
    <>
      <Stack.Screen
        options={{
          title: `r/${sub}`,
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: '700', color: theme.text },
          headerRight: () => (
            <View style={styles.headerRight}>
              {/* Theme toggle */}
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

              {/* View mode toggle */}
              <Pressable
                onPress={() => setViewMode((m) => { const next = m === 'standard' ? 'compact' : 'standard'; setViewModePreference(next, sub); return next; })}
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

              {/* Sort picker */}
              <Pressable
                onPress={openSortPicker}
                style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}
                hitSlop={8}
                accessibilityLabel={`Sort: ${sortLabel}`}
                accessibilityRole="button"
              >
                <MaterialIcons name="filter-list" size={24} color={BRAND} />
              </Pressable>

              {/* Favourite star */}
              <Pressable
                onPress={toggleFavorite}
                style={({ pressed }) => [styles.starBtn, pressed && styles.starBtnPressed]}
                hitSlop={8}
                accessibilityLabel={isFavorited ? 'Remove from favourites' : 'Add to favourites'}
                accessibilityRole="button"
              >
                <Text style={[styles.starIcon, isFavorited && styles.starIconFilled]}>
                  {isFavorited ? '\u2605' : '\u2606'}
                </Text>
              </Pressable>
            </View>
          ),
        }}
      />

      {loading ? (
        <View style={styles.container}>
          <FeedSkeleton />
        </View>
      ) : error && posts.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Could not load r/{sub}</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <Text style={styles.retryHint}>Pull down to retry</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          extraData={themeName}
          style={styles.container}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={BRAND}
              colors={[BRAND]}
              progressBackgroundColor={Colors.surface}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          removeClippedSubviews
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={11}
          ListHeaderComponent={
            error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>⚠️ {error}</Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={BRAND} style={styles.loadingMore} />
            ) : null
          }
        />
      )}
      <NavigationSheet />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  listContent: { paddingTop: Spacing.sm, paddingBottom: Spacing.xl },
  center: {
    flex: 1, backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center', padding: Spacing.xl,
  },
  errorIcon: { fontSize: 40, marginBottom: Spacing.md },
  errorTitle: {
    color: Colors.text, fontSize: Typography.lg,
    fontWeight: '700', marginBottom: Spacing.sm,
  },
  errorMessage: {
    color: Colors.textMuted, fontSize: Typography.sm,
    textAlign: 'center', marginBottom: Spacing.md,
  },
  retryHint: { color: Colors.textDisabled, fontSize: Typography.sm },
  errorBanner: {
    backgroundColor: Colors.surface, marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm, padding: Spacing.md, borderRadius: 8,
  },
  errorBannerText: { color: Colors.textMuted, fontSize: Typography.sm },
  loadingMore: { paddingVertical: Spacing.xl },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },
  headerBtnPressed: { opacity: 0.5 },
  starBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  starBtnPressed: { opacity: 0.5 },
  starIcon: {
    fontSize: 24,
    color: Colors.textMuted,
  },
  starIconFilled: {
    color: BRAND,
  },
});