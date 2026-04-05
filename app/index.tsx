import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
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

  // ── Bottom sheet state ───────────────────────────────────────────────────────
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuInput, setMenuInput]   = useState('');
  const [favorites, setFavorites]   = useState<string[]>([]);

  // ── Sort dropdown state ──────────────────────────────────────────────────────
  const [isSortOpen, setIsSortOpen] = useState(false);

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
    setIsSortOpen(false);
  }, []);

  // ── Favorites (bottom sheet) ─────────────────────────────────────────────────
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
      <View style={styles.fillContainer}>
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

        {/* Material 3 sort dropdown — floats over the list */}
        {isSortOpen && (
          <>
            <Pressable style={styles.sortBackdrop} onPress={() => setIsSortOpen(false)} />
            <View style={styles.sortDropdown}>
              {SORT_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={({ pressed }) => [
                    styles.sortRow,
                    pressed && styles.sortRowPressed,
                  ]}
                  onPress={() => handleSortSelect(option.value)}
                >
                  <Text style={[styles.sortRowText, sort === option.value && styles.sortRowTextActive]}>
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
              onPress={() => setIsSortOpen((prev) => !prev)}
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
          onPress={() => setIsMenuOpen(true)}
          style={({ pressed }) => [styles.fabBtn, pressed && styles.fabBtnPressed]}
          accessibilityLabel="Open subreddit menu"
          accessibilityRole="button"
        >
          <MaterialIcons name="explore" size={26} color="#fff" />
        </Pressable>
      </Animated.View>

      {/* Slide-up bottom sheet for subreddit navigation */}
      <Modal
        visible={isMenuOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsMenuOpen(false)}
      >
        {/* Scrim backdrop — tap to dismiss */}
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setIsMenuOpen(false)}
        />

        {/* Bottom sheet container */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrapper}
        >
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
            {/* Drag handle */}
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Subreddits</Text>
              <Pressable
                style={({ pressed }) => [styles.sheetClose, pressed && styles.sheetClosePressed]}
                onPress={() => setIsMenuOpen(false)}
                hitSlop={8}
                accessibilityLabel="Close menu"
                accessibilityRole="button"
              >
                <Text style={styles.sheetCloseText}>✕</Text>
              </Pressable>
            </View>

            {/* Search row */}
            <View style={styles.sheetSearchRow}>
              <TextInput
                style={styles.sheetInput}
                placeholder="r/subreddit name…"
                placeholderTextColor={Colors.textDisabled}
                value={menuInput}
                onChangeText={setMenuInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={() => navigateToSubreddit(menuInput)}
              />
              <Pressable
                style={({ pressed }) => [styles.sheetGoBtn, pressed && styles.sheetGoBtnPressed]}
                onPress={() => navigateToSubreddit(menuInput)}
              >
                <Text style={styles.sheetGoBtnText}>Go</Text>
              </Pressable>
            </View>

            {/* Favourites list */}
            <Text style={styles.sheetSectionLabel}>
              {favorites.length === 0 ? 'NO FAVOURITES YET' : 'FAVOURITES'}
            </Text>

            {favorites.length === 0 ? (
              <View style={styles.sheetEmpty}>
                <Text style={styles.sheetEmptyStar}>☆</Text>
                <Text style={styles.sheetEmptyTitle}>No saved subreddits</Text>
                <Text style={styles.sheetEmptyHint}>
                  Browse any subreddit and tap the ★ star in the header to save it here.
                </Text>
              </View>
            ) : (
              <FlatList
                data={favorites}
                keyExtractor={(item) => item}
                style={styles.sheetList}
                contentContainerStyle={styles.sheetListContent}
                renderItem={({ item }) => (
                  <View style={styles.sheetRow}>
                    <Pressable
                      style={({ pressed }) => [styles.sheetRowMain, pressed && styles.sheetRowMainPressed]}
                      onPress={() => navigateToSubreddit(item)}
                    >
                      <Text style={styles.sheetRowName}>r/{item}</Text>
                      <Text style={styles.sheetChevron}>›</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.sheetDeleteBtn, pressed && styles.sheetDeleteBtnPressed]}
                      onPress={() => handleDeleteFavorite(item)}
                      hitSlop={8}
                    >
                      <Text style={styles.sheetDeleteIcon}>🗑</Text>
                    </Pressable>
                  </View>
                )}
                ItemSeparatorComponent={() => <View style={styles.sheetSeparator} />}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

  // ── Sort dropdown ────────────────────────────────────────────────────────────
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
  sortRowText: {
    color: Colors.text,
    fontSize: Typography.md,
  },
  sortRowTextActive: {
    color: BRAND,
    fontWeight: '700',
  },

  // ── Bottom sheet ─────────────────────────────────────────────────────────────
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    height: '60%' as any,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.lg,
    fontWeight: '700',
  },
  sheetClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetClosePressed: { opacity: 0.6 },
  sheetCloseText: {
    color: Colors.textMuted,
    fontSize: Typography.md,
    lineHeight: 18,
  },
  sheetSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  sheetInput: {
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
  sheetGoBtn: {
    backgroundColor: BRAND,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  sheetGoBtnPressed: { opacity: 0.8 },
  sheetGoBtnText: { color: '#fff', fontWeight: '700', fontSize: Typography.md },
  sheetSectionLabel: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
  sheetEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 40,
  },
  sheetEmptyStar: {
    fontSize: 40,
    color: Colors.textDisabled,
    marginBottom: Spacing.md,
  },
  sheetEmptyTitle: {
    color: Colors.text,
    fontSize: Typography.lg,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  sheetEmptyHint: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  sheetList: {
    flex: 1,
  },
  sheetListContent: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  sheetRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  sheetRowMainPressed: { backgroundColor: Colors.surfaceElevated },
  sheetRowName: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.md,
    fontWeight: '600',
  },
  sheetChevron: {
    color: Colors.textDisabled,
    fontSize: Typography.xl,
    fontWeight: '300',
    marginRight: Spacing.sm,
  },
  sheetDeleteBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  sheetDeleteBtnPressed: { opacity: 0.4 },
  sheetDeleteIcon: { fontSize: 18 },
  sheetSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: Spacing.lg,
  },
});