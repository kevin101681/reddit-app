import React, { memo, useMemo, useState } from 'react';
import { View, Pressable, StyleSheet, Linking, Image } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { RedditComment } from '../utils/types';
import { buildMarkdownStyles, suppressImageRule } from '../utils/markdownStyles';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import { useTheme } from '../utils/ThemeContext';

// Cold-tone depth palette — cycles via modulo for deeper nesting
const DEPTH_COLORS = [
  '#7ba0b3', // 0
  '#5a879d', // 1
  '#457287', // 2
  '#345e72', // 3
  '#264a5c', // 4
  '#1b3847', // 5+
];

function depthColor(depth: number): string {
  return DEPTH_COLORS[depth % DEPTH_COLORS.length];
}

function openLink(url: string): boolean {
  Linking.openURL(url).catch(() => {});
  return true;
}

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
  const { theme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const mdStyles = useCommentMdStyles(depth);

  if (!comment.body || comment.body === '[deleted]' || comment.body === '[removed]') {
    return null;
  }

  const color      = depthColor(depth);
  const replyCount = comment.replies?.length ?? 0;

  // Left border encodes nesting depth; no margin stacking keeps deep nesting readable
  const nestedStyle = depth > 0
    ? { borderLeftWidth: 3, borderLeftColor: color, paddingLeft: Spacing.sm }
    : undefined;

  // ── Collapsed: show only the depth border + blank tap target ─────────────
  if (isCollapsed) {
    return (
      <View style={[styles.container, nestedStyle]}>
        <Pressable
          onPress={() => setIsCollapsed(false)}
          style={styles.collapseTarget}
          accessibilityRole="button"
          accessibilityLabel="Expand comment"
        />
      </View>
    );
  }

  // ── Expanded ──────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, nestedStyle]}>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>

        {/* Blank 24px tap strip at the top of every card to collapse */}
        <Pressable
          onPress={() => setIsCollapsed(true)}
          style={styles.collapseTarget}
          accessibilityRole="button"
          accessibilityLabel="Collapse comment"
        />

        {/* Comment body */}
        <Markdown
          style={mdStyles}
          onLinkPress={openLink}
          rules={suppressImageRule}
        >
          {comment.body}
        </Markdown>

        {/* Inline Reddit images from the comment body */}
        {(() => {
          const imageRegex = /(https?:\/\/(?:preview\.redd\.it|i\.redd\.it)[^\s)]+)/g;
          const imageMatches = comment.body.match(imageRegex);
          if (!imageMatches) return null;
          return imageMatches.map((rawUrl, i) => {
            const url = rawUrl.replace(/&amp;/g, '&');
            return (
              <Image
                key={i}
                source={{ uri: url }}
                style={styles.inlineImage}
                resizeMode="contain"
              />
            );
          });
        })()}

      </View>

      {/* Recursive replies */}
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
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.sm,
  },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  // Invisible full-width tap strip used for both expand (collapsed state)
  // and collapse (top of expanded card) — no text, just touch area.
  collapseTarget: {
    height: 24,
    width: '100%',
  },
  inlineImage: {
    width: '100%',
    height: 200,
    marginTop: Spacing.sm,
    borderRadius: Radius.sm,
  },
  replies: {
    marginTop: Spacing.xs,
  },
});