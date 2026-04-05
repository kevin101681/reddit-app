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
const BRAND = '#7ba0b3';

const SORT_OPTIONS = [
  { label: 'Hot',           value: 'hot' },
  { label: 'New',           value: 'new' },
  { label: 'Top',           value: 'top' },
  { label: 'Controversial', value: 'controversial' },
] as const;

// Stable outside the component so FlatList never sees a new reference
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 70 };

export default function FrontpageScreen() {
  const insets = useSafeAreaInsets();

  const [sort, setSort] = useState('hot');
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [after, setAfter] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load persisted sort on mount — if stored value equals default ('hot')
  // React bails out of the re-render and no extra fetch occurs.
  useEffect(() => {
    let active = true;
    getSortPreference().then((s) => { if (active) setSort(s); });
    return () => { active = false; };
  }, []);

  // Persist and apply a new sort — state change propagates to fetchPosts
  // via its dep list, which in turn triggers the reset effect below.
  const handleSortSelect = useCallback(async (newSort: string) => {
    setSortPreference(newSort); // fire-and-forget
    setSort(newSort);
  }, []);

  function openSortPicker() {
    const labels  = SORT_OPTIONS.map((o) => o.label);
    const current = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Hot';

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Sort by',
          options: [...labels, 'Cancel'],
          cancelButtonIndex: labels.length,
        },
        (index) => {
          if (index < SORT_OPTIONS.length) {
            handleSortSelect(SORT_OPTIONS[index].value);
          }
        }
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

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      setActivePostId(viewableItems[0]?.item?.id ?? null);
    },
    []
  );

  // fetchPosts captures 'sort' in its closure. A new sort value creates a new
  // function reference, which causes the reset effect below to fire.
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
        if (err?.name !== 'AbortError') {
          setError(err?.message ?? 'Failed to load posts');
        }
      }
    },
    [sort]
  );

  // Fires on mount AND whenever fetchPosts changes (i.e. when sort changes).
  // AbortController in fetchPosts ensures any in-flight request from the
  // previous sort is cancelled before the new one starts.
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

  const footerHeight = 56 + Math.max(insets.bottom, Spacing.md);

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
        contentContainerStyle={[styles.listContent, { paddingBottom: footerHeight + Spacing.md }]}
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
        viewabilityConfig={VIEWABILITY_CONFIG}
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

      {/* Bottom footer: bookmarks menu button */}
      <View
        style={[
          styles.footer,
          {
            height: footerHeight,
            paddingBottom: Math.max(insets.bottom, Spacing.md),
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [styles.menuBtn, pressed && styles.menuBtnPressed]}
          onPress={() => router.push('/menu')}
          hitSlop={8}
          accessibilityLabel="Open subreddit menu"
          accessibilityRole="button"
        >
          <MaterialIcons name="bookmarks" size={26} color={BRAND} />
        </Pressable>
      </View>
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

  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  menuBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
  },
  menuBtnPressed: {
    opacity: 0.6,
  },
});