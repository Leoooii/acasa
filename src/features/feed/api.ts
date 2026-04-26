import { supabase } from "@/api/supabase";

export type PostType = "announcement" | "event" | "poll";

export type PollPayload = {
  options: string[];
};

export type EventPayload = {
  start_at: string;
  end_at: string;
  participants: string[];
};

export type FeedReaction = { emoji: string; user_id: string };
export type FeedPollVote = { option_index: number; user_id: string };

export type FeedPost = {
  id: string;
  space_id: string;
  author_id: string;
  type: PostType;
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
  reactions: FeedReaction[];
  poll_votes: FeedPollVote[];
};

export async function getPost(id: string) {
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, space_id, author_id, type, title, body, payload, created_at, profiles:author_id(display_name, avatar_url), reactions(emoji, user_id), poll_votes(option_index, user_id)",
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as unknown as FeedPost;
}

export async function listPosts(spaceId: string) {
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, space_id, author_id, type, title, body, payload, created_at, profiles:author_id(display_name, avatar_url), reactions(emoji, user_id), poll_votes(option_index, user_id)",
    )
    .eq("space_id", spaceId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as FeedPost[];
}

export async function createPost(input: {
  spaceId: string;
  type: PostType;
  title: string;
  body?: string | null;
  payload?: Record<string, unknown> | null;
}) {
  const { data, error } = await supabase
    .from("posts")
    .insert({
      space_id: input.spaceId,
      type: input.type,
      title: input.title.trim(),
      body: input.body?.trim() || null,
      payload: input.payload ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function toggleReaction(
  postId: string,
  emoji: string,
  myReacted: boolean,
) {
  if (myReacted) {
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) throw new Error("not_authenticated");
    const { error } = await supabase
      .from("reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId)
      .eq("emoji", emoji);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("reactions")
      .insert({ post_id: postId, emoji });
    if (error) throw error;
  }
}

export async function deletePost(id: string) {
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) throw error;
}

export async function voteOnPoll(postId: string, optionIndex: number) {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error("not_authenticated");
  const { error } = await supabase
    .from("poll_votes")
    .upsert(
      { post_id: postId, user_id: userId, option_index: optionIndex },
      { onConflict: "post_id,user_id" },
    );
  if (error) throw error;
}
