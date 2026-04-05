import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Pressable,
  Platform,
} from 'react-native';
import { router, Stack } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPosts } from '../utils/api';
import { RedditPost } from '../utils/types';
import { PostCard } from '../components/PostCard';
import { FeedSkeleton } from '../components/SkeletonLoader';
import { Colors, Spacing, Typography } from '../constants/theme';

const SUBREDDIT = 'all';
const SORT = 'hot';
const BRAND = '#7ba0b3';

export default function FrontpageScreen() {
  const insets = useSafeAreaInsets();

  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [after, setAfter] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchPosts = useCallback(async (reset: boolean, cursor?: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setError(null);
      const data = await getPosts(SUBREDDIT, SORT, cursor, controller.signal);
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
  }, []);

  useEffect(() => {
    fetchPosts(true).finally(() => setLoading(false));
    return () => abortRef.current?.abort();
  }, []);

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
        renderItem={({ item }) => <PostCard post={item} />}
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

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'r/all',
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.text,
          headerTitleStyle: { fontWeight: '700', color: Colors.text },
          headerShown: true,
        }}
      />

      <View style={styles.fillContainer}>{renderBody()}</View>

      {/* Footer: menu button pinned to bottom-right */}
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