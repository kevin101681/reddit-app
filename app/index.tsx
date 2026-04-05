import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Animated,
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
import { router, Stack } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPosts } from '../utils/api';
import { RedditPost } from '../utils/types';
import { PostCard } from '../components/PostCard';
import { FeedSkeleton } from '../components/SkeletonLoader';
import { getSortPreference, setSortPreference } from '../utils/storage';
import { Colors, Spacing, Typography } from '../constants/theme';

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

  const [sort, setSort]           = useState('hot');
  const [posts, setPosts]         = useState<RedditPost[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [after, setAfter]         = useState<string | undefined>(undefined);
  const [hasMore, setHasMore]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Viewability — MUST be useRef so FlatList never sees a new reference ─────
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      setActivePostId(viewableItems[0]?.item?.id ?? null);
    }
  ).current;

  // ── FAB hide-on-scroll ───────────────────────────────────────────────────────
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

  // ── Sort ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    getSortPreference().then((s) => { if (active) setSort(s); });
    return () => { active = false; };
  }, []);

  const handleSortSelect = useCallback(async (newSort: string) => {
    setSortPreference(newSort);
    setSort(newSort);
  }, []);

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

  // ── Data fetching ───────────────────────────────────────────────────────────
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
      <PostCard post={item} activePostId={activePostId} />
    ),
    [activePostId]
  );

  // ── Render helpers ──────────────────────────────────────────────────────────
  const fabPaddingBottom = Math.max(insets.bottom, Spacing.lg);

  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.fillContainer}>
          <FeedSkeleton />
        </View>
      );
    }

    if (error && posts.length === 0) {
      return (
        <View style={styles.center}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Could not load posts</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <Text style={styles.retryHint}>Pull down to retry</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        style={styles.fillContainer}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: FAB_SIZE + fabPaddingBottom + Spacing.xl },
        ]}
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
        onScroll={handleScroll}
        scrollEventThrottle={16}
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
    );
  };

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Hot';

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'r/all',
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.text,
          headerTitleStyle: { fontWeight: '700', color: Colors.text },
          headerShown: true,
          headerRight: () => (
            <Pressable
              onPress={openSortPicker}
              style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}
              hitSlop={8}
              accessibilityLabel={`Sort: ${sortLabel}`}
              accessibilityRole="button"
            >
              <MaterialIcons name="filter-list" size={24} color={BRAND} />
            </Pressable>
          ),
        }}
      />

      <View style={styles.fillContainer}>{renderBody()}</View>

      {/* Hide-on-scroll FAB — opens subreddit menu */}
      <Animated.View
        style={[
          styles.fab,
          {
            bottom: fabPaddingBottom + Spacing.lg,
            transform: [{ translateY: fabTranslateY }],
          },
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => router.push('/menu')}
          style={({ pressed }) => [styles.fabBtn, pressed && styles.fabBtnPressed]}
          accessibilityLabel="Open subreddit menu"
          accessibilityRole="button"
        >
          <MaterialIcons name="explore" size={26} color="#fff" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
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
});