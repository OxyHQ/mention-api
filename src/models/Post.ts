import mongoose, { Document, Schema } from "mongoose";
import { IUser } from './User';

export interface IPost extends Document {
  text: string;
  userID: IUser['_id'];
  author: mongoose.Types.ObjectId;
  media: string[];
  hashtags: string[];
  mentions: IUser['_id'][];
  quoted_post_id: mongoose.Types.ObjectId | null;
  quoted_post: mongoose.Types.ObjectId | null;
  repost_of: mongoose.Types.ObjectId | null;
  in_reply_to_status_id: mongoose.Types.ObjectId | null;
  source: string;
  possibly_sensitive: boolean;
  lang: string;
  created_at: Date;
  updated_at: Date;
  metadata?: string;
  replies: mongoose.Types.ObjectId[];
  likes: mongoose.Types.ObjectId[];
  reposts: mongoose.Types.ObjectId[];
  bookmarks: mongoose.Types.ObjectId[];
  _count?: {
    replies: number;
    likes: number;
    reposts: number;
    bookmarks: number;
  };
}

const PostSchema = new Schema<IPost>({
  text: { type: String, required: false },
  userID: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  author: { type: Schema.Types.ObjectId, ref: 'User' },
  media: [{ type: String }],
  hashtags: [{ type: String }],
  mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  quoted_post_id: { type: Schema.Types.ObjectId, ref: 'Post', default: null },
  quoted_post: { type: Schema.Types.ObjectId, ref: 'Post', default: null },
  repost_of: { type: Schema.Types.ObjectId, ref: 'Post', default: null },
  in_reply_to_status_id: { type: Schema.Types.ObjectId, ref: 'Post', default: null },
  source: { type: String, default: 'web' },
  possibly_sensitive: { type: Boolean, default: false },
  lang: { type: String, default: 'en' },
  metadata: { type: String },
  replies: [{ type: Schema.Types.ObjectId, ref: 'Post' }],
  likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  reposts: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  bookmarks: [{ type: Schema.Types.ObjectId, ref: 'User' }]
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  },
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
});

// Virtual fields for counts
PostSchema.virtual('_count').get(function() {
  return {
    replies: this.replies?.length || 0,
    likes: this.likes?.length || 0,
    reposts: this.reposts?.length || 0,
    bookmarks: this.bookmarks?.length || 0
  };
});

// Middleware to update user's post count on create
PostSchema.post('save', async function(this: IPost) {
  const User = mongoose.model('User');
  const count = await mongoose.model('Post').countDocuments({ userID: this.userID });
  await User.findByIdAndUpdate(this.userID, { 
    $set: { '_count.posts': count }
  });
});

// Middleware to update user's post count on delete
PostSchema.post('deleteOne', async function(this: IPost) {
  if (this.userID) {
    const User = mongoose.model('User');
    const count = await mongoose.model('Post').countDocuments({ userID: this.userID });
    await User.findByIdAndUpdate(this.userID, { 
      $set: { '_count.posts': count }
    });
  }
});

// Indexes
PostSchema.index({ userID: 1, created_at: -1 });
PostSchema.index({ hashtags: 1, created_at: -1 });
PostSchema.index({ mentions: 1, created_at: -1 });
PostSchema.index({ in_reply_to_status_id: 1, created_at: -1 });
PostSchema.index({ quoted_post_id: 1 });
PostSchema.index({ repost_of: 1 });
PostSchema.index({ replies: 1 });
PostSchema.index({ likes: 1 });
PostSchema.index({ reposts: 1 });
PostSchema.index({ bookmarks: 1 });

export const Post = mongoose.model<IPost>('Post', PostSchema);
export default Post;
