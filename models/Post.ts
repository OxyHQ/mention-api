import mongoose, { Document, Schema } from 'mongoose';

export interface IPost extends Document {
    text: string;
    userID: mongoose.Types.ObjectId;
    author: mongoose.Types.ObjectId;
    media: string[];
    hashtags: mongoose.Types.ObjectId[];
    quoted_post_id: mongoose.Types.ObjectId | null;
    quoted_post: mongoose.Types.ObjectId | null;
    in_reply_to_status_id: mongoose.Types.ObjectId | null;
    source: string;
    possibly_sensitive: boolean;
    lang: string;
    created_at: Date;
    updated_at: Date;
    metadata?: string;
}

const PostSchema = new Schema<IPost>({
    text: { type: String, required: false },
    userID: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    media: [{ type: String }],
    hashtags: [{ type: Schema.Types.ObjectId, ref: 'Hashtag' }],
    quoted_post_id: { type: Schema.Types.ObjectId, ref: 'Post', default: null },
    quoted_post: { type: Schema.Types.ObjectId, ref: 'Post', default: null },
    in_reply_to_status_id: { type: Schema.Types.ObjectId, ref: 'Post', default: null },
    source: { type: String, default: 'web' },
    possibly_sensitive: { type: Boolean, default: false },
    lang: { type: String, default: 'en' },
    metadata: { type: String },
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

// Indexes
PostSchema.index({ userID: 1, created_at: -1 });
PostSchema.index({ hashtags: 1, created_at: -1 });
PostSchema.index({ in_reply_to_status_id: 1, created_at: -1 });
PostSchema.index({ quoted_post_id: 1 });

export const Post = mongoose.model<IPost>('Post', PostSchema); 