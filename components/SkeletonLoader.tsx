import React from 'react';
import { Platform, View, StyleSheet, Animated } from 'react-native';
import { Colors, Radius, Spacing } from '../constants/theme';

interface SkeletonBoxProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}

export function SkeletonBox({ width, height, borderRadius = Radius.sm, style }: SkeletonBoxProps) {
  const shimmer = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 900,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 900,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    ).start();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.4],
  });

  return (
    <Animated.View
      style={[
        styles.box,
        { width: width as number, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

export function PostSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.meta}>
        <SkeletonBox width={90} height={11} />
        <SkeletonBox width={60} height={11} style={{ marginLeft: Spacing.sm }} />
      </View>
      <SkeletonBox width="92%" height={16} style={{ marginTop: Spacing.sm }} />
      <SkeletonBox width="70%" height={16} style={{ marginTop: Spacing.xs }} />
      <SkeletonBox width="100%" height={180} borderRadius={Radius.md} style={{ marginTop: Spacing.md }} />
      <View style={styles.actions}>
        <SkeletonBox width={60} height={28} borderRadius={Radius.full} />
        <SkeletonBox width={80} height={28} borderRadius={Radius.full} style={{ marginLeft: Spacing.sm }} />
      </View>
    </View>
  );
}

export function FeedSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: Colors.skeleton,
  },
  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
  },
});
