// ============================================================
// SignalDesk AI - Reddit Lead Discovery Engine
// ============================================================

export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  url: string;
  permalink: string;
  score: number;
  num_comments: number;
  created_utc: number;
  is_self: boolean;
}

export interface RedditSearchResult {
  posts: RedditPost[];
  query: string;
  subreddit?: string;
}

const REDDIT_API_BASE = 'https://www.reddit.com';

// High-value subreddits for B2B lead discovery
const B2B_SUBREDDITS = [
  'entrepreneur', 'startups', 'SaaS', 'smallbusiness', 'marketing',
  'sales', 'productivity', 'software', 'learnprogramming', 'webdev',
  'sysadmin', 'devops', 'AskMarketing', 'growthhacking', 'digital_marketing',
  'ecommerce', 'dropship', 'Entrepreneur', 'business', 'freelance',
  'sidehustle', 'passive_income', 'remotework', 'remotejobs',
];

export async function searchReddit(
  query: string,
  options: {
    subreddit?: string;
    sort?: 'relevance' | 'new' | 'top' | 'comments';
    time?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
    limit?: number;
  } = {}
): Promise<RedditPost[]> {
  const {
    subreddit,
    sort = 'relevance',
    time = 'week',
    limit = 10,
  } = options;

  const baseUrl = subreddit
    ? `${REDDIT_API_BASE}/r/${subreddit}/search.json`
    : `${REDDIT_API_BASE}/search.json`;

  const params = new URLSearchParams({
    q: query,
    sort,
    t: time,
    limit: String(Math.min(limit, 25)),
    type: 'link',
    restrict_sr: subreddit ? 'on' : 'off',
  });

  const url = `${baseUrl}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SignalDeskAI/1.0 (lead discovery platform)',
        'Accept': 'application/json',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      console.error(`Reddit API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    const posts: RedditPost[] = [];

    if (data?.data?.children) {
      for (const child of data.data.children) {
        const post = child.data;
        if (post.is_self || post.selftext) {
          posts.push({
            id: post.id,
            title: post.title || '',
            selftext: post.selftext || '',
            author: post.author || '[deleted]',
            subreddit: post.subreddit || '',
            url: `https://reddit.com${post.permalink}`,
            permalink: post.permalink,
            score: post.score || 0,
            num_comments: post.num_comments || 0,
            created_utc: post.created_utc || 0,
            is_self: post.is_self || false,
          });
        }
      }
    }

    return posts;
  } catch (error) {
    console.error('Reddit search error:', error);
    return [];
  }
}

export async function searchMultipleSubreddits(
  query: string,
  subreddits: string[],
  limit = 5
): Promise<RedditPost[]> {
  const promises = subreddits.map(sub =>
    searchReddit(query, { subreddit: sub, limit, sort: 'new', time: 'week' })
  );

  const results = await Promise.allSettled(promises);
  const posts: RedditPost[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      posts.push(...result.value);
    }
  }

  // Deduplicate by id
  const seen = new Set<string>();
  return posts.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

export async function fetchLeadsFromReddit(
  queries: Array<{ query: string; type: string; subreddits?: string[] }>,
  maxPostsPerQuery = 8
): Promise<RedditPost[]> {
  const allPosts: RedditPost[] = [];
  const seen = new Set<string>();

  // Process queries with a small delay to avoid rate limiting
  for (let i = 0; i < Math.min(queries.length, 8); i++) {
    const { query, subreddits } = queries[i];

    try {
      let posts: RedditPost[];

      if (subreddits && subreddits.length > 0) {
        posts = await searchMultipleSubreddits(query, subreddits.slice(0, 3), maxPostsPerQuery);
      } else {
        // Search across general subreddits
        posts = await searchReddit(query, {
          sort: 'relevance',
          time: 'month',
          limit: maxPostsPerQuery,
        });
      }

      for (const post of posts) {
        if (!seen.has(post.id)) {
          seen.add(post.id);
          allPosts.push(post);
        }
      }

      // Rate limit: small delay between requests
      if (i < queries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`Error fetching Reddit posts for query "${query}":`, error);
    }
  }

  return allPosts;
}

export function redditPostToLead(post: RedditPost, projectId: string) {
  return {
    project_id: projectId,
    source: 'reddit' as const,
    external_id: post.id,
    url: post.url,
    title: post.title,
    body: post.selftext.slice(0, 2000), // Limit body size
    author: post.author,
    subreddit: post.subreddit,
    upvotes: post.score,
    comment_count: post.num_comments,
    posted_at: post.created_utc
      ? new Date(post.created_utc * 1000).toISOString()
      : null,
    status: 'new' as const,
  };
}
