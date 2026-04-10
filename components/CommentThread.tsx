import React, { memo, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking, Image } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { RedditComment } from '../utils/types';
import { buildMarkdownStyles, suppressImageRule } from '../utils/markdownStyles';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import { useTheme } from '../utils/ThemeContext';

const getTimeAgo = (timestamp: number): string => {
  if (!timestamp) return '';
  const seconds = Math.floor(Date.now() / 1000) - timestamp;
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + 'y ago';
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + 'mo ago';
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + 'd ago';
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + 'h ago';
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + 'm ago';
  return 'just now';
};
// Matches bare image URLs on their own line (Reddit CDN + common image hosts).
// These are stripped from the Markdown body text so they don't render as plain
// text links alongside the inline <Image> previews already rendered below.
const BARE_IMAGE_RE = /^\s*https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|gifv|webp|mp4)(?:\?[^\s]*)?\s*$/gim;

function openLink(url: string): boolean {
  Linking.openURL(url).catch(() => {});
  return true;
}

function useCommentMdStyles(depth: number, themeName: string) {
  return useMemo(() => {
    const fontSize   = Math.max(Typography.sm, Typography.md - Math.floor(depth / 3));
    const lineHeight = fontSize + 9;
    return buildMarkdownStyles({ fontSize, lineHeight, themeName });
  }, [depth, themeName]);
}

interface CommentThreadProps {
  comment: RedditComment;
  depth?: number;
}

export const CommentThread = memo(function CommentThread({
  comment,
  depth = 0,
}: CommentThreadProps) {
  const { theme, themeName } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const mdStyles = useCommentMdStyles(depth, themeName);

  const commentColors = themeName === 'dark' ? {
    background: '#1e1e1e',
    text: '#fff',
    author: '#a0a0a0',
    line: '#505050',
  } : {
    background: '#fff',
    text: '#000',
    author: '#333',
    line: '#e0e0e0',
  };

  if (!comment.body || comment.body === '[deleted]' || comment.body === '[removed]') {
    return null;
  }

  const replyCount = comment.replies?.length ?? 0;

  // Left border encodes nesting depth; no margin stacking keeps deep nesting readable
  const nestedStyle = depth > 0
    ? { borderLeftWidth: 3, borderLeftColor: commentColors.line, paddingLeft: Spacing.sm }
    : undefined;

  // Strip bare image URL lines and markdown image syntax from the body so they
  // don't appear as plain-text links alongside the inline Image previews.
  const extractedImageRe = /(https?:\/\/(?:preview\.redd\.it|i\.redd\.it)[^\s)]+)/g;
  const cleanBody = comment.body
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(extractedImageRe, '')
    .replace(BARE_IMAGE_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // -- Collapsed: show only the depth border + blank tap target -------------
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

  // -- Expanded --------------------------------------------------------------
  return (
    <View style={[styles.container, nestedStyle]}>
      <View style={[styles.card, { backgroundColor: commentColors.background }]}>

        {/* Blank 24px tap strip at the top of every card to collapse */}
        <Pressable
          onPress={() => setIsCollapsed(true)}
          style={styles.collapseTarget}
          accessibilityRole="button"
          accessibilityLabel="Collapse comment"
        />

        {/* Author + time */}
        <View style={styles.commentMeta}>
          <Text style={[styles.commentAuthor, { color: commentColors.author }]}>{"u/" + comment.author}</Text>
          <Text style={[styles.commentTime, { color: commentColors.author }]}>{" \u00b7 " + getTimeAgo(comment.created_utc)}</Text>
        </View>

        {/* Comment body */}
        <Markdown
          style={{ ...mdStyles, body: { ...mdStyles.body, color: commentColors.text }, paragraph: { ...mdStyles.paragraph, color: commentColors.text } }}
          onLinkPress={openLink}
          rules={suppressImageRule}
        >
          {cleanBody}
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
  // and collapse (top of expanded card) � no text, just touch area.
  collapseTarget: {
    height: 24,
    width: '100%',
  },
  inlineImage: {
    width: '100%',
    height: 200,
    marginTop: Spacing.sm,
    borderRadius: 12,
    overflow: 'hidden',
  },
  replies: {
    marginTop: Spacing.xs,
  },
  commentMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  commentAuthor: { fontSize: 12, fontWeight: '700' },
  commentTime: { fontSize: 12 },
});