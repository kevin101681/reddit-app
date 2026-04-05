import React, { memo, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { RedditComment } from '../utils/types';
import { buildMarkdownStyles, suppressImageRule } from '../utils/markdownStyles';
import { Colors, Spacing, Typography } from '../constants/theme';

const BRAND = '#7ba0b3';

// One distinct border color per nesting depth — cycles after 6 levels
const DEPTH_COLORS = [
  Colors.primary,  // 0 — orange
  '#7193ff',       // 1 — periwinkle
  '#46d160',       // 2 — green
  '#ffd635',       // 3 — gold
  '#ff585b',       // 4 — coral
  '#00b4d8',       // 5 — teal
];

function depthColor(depth: number): string {
  return DEPTH_COLORS[depth % DEPTH_COLORS.length];
}

/** All tapped links open externally in the device browser. */
function openLink(url: string): boolean {
  Linking.openURL(url).catch(() => {});
  return true;
}

/**
 * Memoised markdown styles per nesting depth.
 * Font size shrinks slightly at deeper levels so text stays readable
 * inside narrow indented columns.
 */
function useCommentMdStyles(depth: number) {
  return useMemo(() => {
    const fontSize   = Math.max(Typography.xs, Typography.sm - Math.floor(depth / 3));
    const lineHeight = fontSize + 7;
    return buildMarkdownStyles({ fontSize, lineHeight });
  }, [depth]);
}

interface CommentThreadProps {
  comment: RedditComment;
  depth?: number;
}

export const CommentThread = memo(function CommentThread({
  comment,
  depth = 0,
}: CommentThreadProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const mdStyles = useCommentMdStyles(depth);

  // Skip deleted / removed bodies entirely
  if (
    !comment.body ||
    comment.body === '[deleted]' ||
    comment.body === '[removed]'
  ) {
    return null;
  }

  const color      = depthColor(depth);
  const replyCount = comment.replies?.length ?? 0;

  // Each nesting level adds a coloured left border + a single paddingLeft step.
  // No marginLeft stacking — cumulative indent stays proportional and never
  // pushes deeply-nested text off-screen.
  const nestedStyle = depth > 0
    ? { borderLeftWidth: 3, borderLeftColor: color, paddingLeft: Spacing.sm }
    : undefined;

  return (
    <View style={[styles.container, nestedStyle]}>

      {isCollapsed ? (
        // ── Collapsed: tap the placeholder to expand ──────────────────────────
        <Pressable
          onPress={() => setIsCollapsed(false)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Expand comment"
        >
          <Text style={styles.collapsedPlaceholder}>[+]</Text>
        </Pressable>
      ) : (
        // ── Expanded: tap the body to collapse ───────────────────────────────
        <>
          <Pressable
            onPress={() => setIsCollapsed(true)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="Collapse comment"
          >
            {/*
              flex: 1 / flexShrink: 1 prevent horizontal overflow inside
              deeply indented columns where available width is narrow.
            */}
            <View style={styles.bodyWrap}>
              <Markdown
                style={mdStyles}
                onLinkPress={openLink}
                rules={suppressImageRule}
              >
                {comment.body}
              </Markdown>
            </View>
          </Pressable>

          {replyCount > 0 && (
            <View style={styles.replies}>
              {comment.replies!.map((reply) => (
                <CommentThread
                  key={reply.id}
                  comment={reply}
                  depth={depth + 1}
                />
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  // Tiny tappable target shown when the thread is collapsed
  collapsedPlaceholder: {
    color: BRAND,
    fontSize: Typography.xs,
    fontWeight: '700',
    paddingVertical: 8,
  },
  bodyWrap: {
    flex: 1,
    flexShrink: 1,
    marginBottom: Spacing.xs,
  },
  replies: {
    marginTop: Spacing.xs,
  },
});