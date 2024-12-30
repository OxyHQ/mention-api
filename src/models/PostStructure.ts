
export interface PostStructure {
  feed: FeedItem[];
  cursor: string;
}

export interface FeedItem {
  post: Post;
  feedContext: string;
}

export interface Post {
  uri: string;
  cid: string;
  author: Author;
  record: Record;
  embed: any;
  replyCount: number;
  repostCount: number;
  likeCount: number;
  quoteCount: number;
  indexedAt: string;
  labels: string[];
}

export interface Author {
  did: string;
  handle: string;
  displayName: string;
  avatar: string;
  associated: {
    chat: {
      allowIncoming: string;
    };
  };
  labels: string[];
  createdAt: string;
}

export interface Record {
  $type: string;
  createdAt: string;
  embed: any;
  langs: string[];
  text: string;
}