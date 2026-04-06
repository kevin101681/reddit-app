import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  ViewToken,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPosts } from '../utils/api';
import { RedditPost } from '../utils/types';
import { PostCard } from '../components/PostCard';
import { FeedSkeleton } from '../components/SkeletonLoader';
import { getSortPreference, setSortPreference } from '../utils/storage';
import { Colors, Spacing, Typography } from '../constants/theme';
import { useTheme } from '../utils/ThemeContext';
import { NavigationSheet } from '../components/NavigationSheet';

const SUBREDDIT = 'all';
const BRAND     = '#7ba0b3';
const FAB_SIZE  = 56; // used for list bottom padding clearance

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



  // ── View mode ────────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'standard' | 'compact'>('standard');

  // ── Viewability ───────────────────────────────────────────────────────────────
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      setActivePostId(viewableItems[0]?.item?.id ?? null);
    }
  ).current;


  // ── Sort ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    getSortPreference(SUBREDDIT).then((s) => { if (active) setSort(s); });
    return () => { active = false; };
  }, []);

  const handleSortSelect = useCallback(async (newSort: string) => {
    setSortPreference(newSort, SUBREDDIT);
    setSort(newSort);
  }, []);

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
          extraData={themeName}
          style={[styles.fillContainer, { backgroundColor: theme.background }]}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: FAB_SIZE + 80 + Spacing.xl },
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
            </View>
          ),
        }}
      />

      <View style={styles.fillContainer}>{renderBody()}</View>

      <NavigationSheet sort={sort} onSortSelect={handleSortSelect} />
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

});
