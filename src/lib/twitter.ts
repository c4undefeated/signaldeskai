// ============================================================
// SignalDesk AI - X (Twitter) Lead Discovery Engine
// Uses the X API v2 Recent Search endpoint.
// Requires the TWITTER_BEARER_TOKEN environment variable.
// Gracefully no-ops (returns []) when the token is absent so
// the rest of the discovery pipeline is never broken.
// ============================================================

export interface TwitterPost {
  id: string;
  text: string;
  author_id: string;
  /** ISO 8601 — present when tweet.fields includes created_at */
  created_at: string;
  public_metrics: {
    like_count: number;
    reply_count: number;
    retweet_count: number;
    impression_count: number;
  };
  /** Hydrated via expansions=author_id */
  author?: {
    id: string;
    username: string;
    name: string;
  };
}

interface TwitterSearchResponse {
  data?: TwitterPost[];
  includes?: {
    users?: Array<{ id: string; username: string; name: string }>;
  };
  meta?: {
    result_count?: number;
    next_token?: string;
    newest_id?: string;
    oldest_id?: string;
  };
  errors?: Array<{ title: string; detail: string; type: string }>;
}

const TWITTER_API_BASE = 'https://api.twitter.com/2';

// ── Internal: single query search ─────────────────────────────────────────────

async function searchTweets(
  query: string,
  maxResults: number,
  bearerToken: string,
): Promise<TwitterPost[]> {
  // Exclude retweets and non-English posts to reduce noise
  const safeQuery = `${query} -is:retweet lang:en`;

  const params = new URLSearchParams({
    query: safeQuery,
    max_results: String(Math.min(Math.max(maxResults, 10), 100)),
    'tweet.fields': 'id,text,author_id,created_at,public_metrics',
    expansions: 'author_id',
    'user.fields': 'id,username,name',
  });

  const url = `${TWITTER_API_BASE}/tweets/search/recent?${params}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      },
      // Never serve a cached response — leads must be fresh
      next: { revalidate: 0 },
    });

    if (res.status === 429) {
      console.warn('[Twitter] Rate limit reached — skipping remaining Twitter queries');
      return [];
    }

    if (!res.ok) {
      const body = await res.text();
      console.error(`[Twitter] API error ${res.status}: ${body}`);
      return [];
    }

    const data: TwitterSearchResponse = await res.json();

    if (data.errors?.length) {
      console.warn('[Twitter] API errors:', data.errors.map((e) => e.detail).join('; '));
    }

    if (!data.data?.length) return [];

    // Attach author metadata (from expansions) to each tweet
    const usersById = new Map(
      (data.includes?.users ?? []).map((u) => [u.id, u]),
    );

    return data.data.map((tweet) => ({
      ...tweet,
      author: usersById.get(tweet.author_id),
    }));
  } catch (error) {
    console.error(`[Twitter] Search error for "${query}":`, error);
    return [];
  }
}

// ── Public: multi-query search ─────────────────────────────────────────────────

/**
 * Searches X for tweets matching the same query structure used by Reddit
 * discovery.  Accepts the existing SearchQuery array format so the caller
 * (POST /api/leads) can pass `queries` unchanged.
 *
 * Applies client-side deduplication by tweet ID.
 * Limits to 5 queries to stay within X API rate windows.
 * Inserts a 1.2 s delay between requests (Basic tier: ~1 req/s).
 */
export async function searchTwitterPosts(
  queries: Array<{ query: string; type: string; subreddits?: string[] }>,
  perQuery = 10,
): Promise<TwitterPost[]> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  if (!bearerToken) {
    console.warn('[Twitter] TWITTER_BEARER_TOKEN not set — skipping Twitter search');
    return [];
  }

  const seen = new Set<string>();
  const results: TwitterPost[] = [];
  const querySlice = queries.slice(0, 5); // Conservative limit

  for (let i = 0; i < querySlice.length; i++) {
    const { query } = querySlice[i];
    const tweets = await searchTweets(query, perQuery, bearerToken);

    for (const tweet of tweets) {
      if (!seen.has(tweet.id)) {
        seen.add(tweet.id);
        results.push(tweet);
      }
    }

    // Rate-limit guard between consecutive requests
    if (i < querySlice.length - 1) {
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  return results;
}

// ── Public: normalise tweet → lead row ────────────────────────────────────────

/**
 * Maps a TwitterPost to the same shape returned by redditPostToLead().
 * Fields that have no Twitter equivalent (subreddit) are set to null.
 * engagement metrics map as: likes → upvotes, replies → comment_count.
 */
export function twitterPostToLead(post: TwitterPost, projectId: string) {
  const MAX_TITLE_LEN = 100;
  const title =
    post.text.length > MAX_TITLE_LEN
      ? post.text.slice(0, MAX_TITLE_LEN).trimEnd() + '…'
      : post.text;

  return {
    project_id: projectId,
    source:      'twitter' as const,
    external_id: post.id,
    url:         `https://x.com/i/web/status/${post.id}`,
    title,
    body:        post.text.slice(0, 2000),
    author:      post.author?.username ?? post.author_id,
    subreddit:   null,
    upvotes:     post.public_metrics?.like_count    ?? 0,
    comment_count: post.public_metrics?.reply_count ?? 0,
    posted_at:   post.created_at ?? null,
    status:      'new' as const,
  };
}
