import mongoose, { Document, Schema } from 'mongoose';

export interface IHashtag extends Document {
    name: string;
    count: number;
    created_at: Date;
    updated_at: Date;
}

const HashtagSchema = new Schema<IHashtag>({
    name: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

// Indexes
HashtagSchema.index({ name: 1 });
HashtagSchema.index({ count: -1 });

export const Hashtag = mongoose.model<IHashtag>('Hashtag', HashtagSchema); 