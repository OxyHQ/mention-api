import mongoose, { Document, Schema } from "mongoose";

export interface IProfile extends Document {
  did: string;
  handle: string;
  displayName: string;
  avatar: string;
  associated: {
    lists: number;
    feedgens: number;
    starterPacks: number;
    labeler: boolean;
  };
  labels: string[];
  createdAt: Date;
  description: string;
  indexedAt: Date;
  banner: string;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  pinnedPost: {
    cid: string;
    uri: string;
  };
}

const ProfileSchema: Schema = new Schema({
  did: { type: String, required: true },
  handle: { type: String, required: true },
  displayName: { type: String, required: true },
  avatar: { type: String, required: true },
  associated: {
    lists: { type: Number, required: true },
    feedgens: { type: Number, required: true },
    starterPacks: { type: Number, required: true },
    labeler: { type: Boolean, required: true },
  },
  labels: { type: [String], required: true },
  createdAt: { type: Date, required: true },
  description: { type: String, required: true },
  indexedAt: { type: Date, required: true },
  banner: { type: String, required: true },
  followersCount: { type: Number, required: true },
  followsCount: { type: Number, required: true },
  postsCount: { type: Number, required: true },
  pinnedPost: {
    cid: { type: String, required: true },
    uri: { type: String, required: true },
  },
});

export default mongoose.model<IProfile>("Profile", ProfileSchema);
