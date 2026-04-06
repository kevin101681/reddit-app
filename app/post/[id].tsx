import { useLocalSearchParams } from "expo-router";
import PostDetail from "../../components/PostDetail";

export default function PostScreen() {
  const { id, subreddit, subreddit_name_prefixed, url } =
    useLocalSearchParams<{
      id: string;
      subreddit: string;
      subreddit_name_prefixed: string;
      url: string;
    }>();

  return (
    <PostDetail
      postId={id as string}
      subreddit={subreddit as string}
      subredditNamePrefixed={subreddit_name_prefixed as string}
      url={url as string}
    />
  );
}