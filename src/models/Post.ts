import mongoose, { Document, Schema } from "mongoose";

export interface IPost extends Document {
  uri: string;
  cid: string;
  author: {
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
    createdAt: Date;
  };
  record: {
    $type: string;
    createdAt: Date;
    embed: any;
    langs: string[];
    text: string;
  };
  embed: any;
  replyCount: number;
  repostCount: number;
  likeCount: number;
  quoteCount: number;
  indexedAt: Date;
  labels: string[];
}

const PostSchema: Schema = new Schema({
  uri: { type: String, required: true },
  cid: { type: String, required: true },
  author: {
    did: { type: String, required: true },
    handle: { type: String, required: true },
    displayName: { type: String, required: true },
    avatar: { type: String, required: true },
    associated: {
      chat: {
        allowIncoming: { type: String, required: true },
      },
    },
    labels: { type: [String], required: true },
    createdAt: { type: Date, required: true },
  },
  record: {
    $type: { type: String, required: true },
    createdAt: { type: Date, required: true },
    embed: { type: Schema.Types.Mixed, required: true },
    langs: { type: [String], required: true },
    text: { type: String, required: true },
  },
  embed: { type: Schema.Types.Mixed, required: true },
  replyCount: { type: Number, required: true },
  repostCount: { type: Number, required: true },
  likeCount: { type: Number, required: true },
  quoteCount: { type: Number, required: true },
  indexedAt: { type: Date, required: true },
  labels: { type: [String], required: true },
});

export default mongoose.model<IPost>("Post", PostSchema);
