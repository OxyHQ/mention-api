import mongoose, { Document, Schema } from "mongoose";

export interface IProfile extends Document {
  userID: string;
  name: {
    first: string;
    last: string;
  };
  avatar: string;
  associated: {
    lists: number;
    feedgens: number;
    starterPacks: number;
    labeler: boolean;
  };
  labels: string[];
  created_at: Date;
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
  _count: {
    followers: number;
    following: number;
    posts: number;
  };
}

const ProfileSchema: Schema = new Schema({
  userID: { type: String, required: true },
  name: {
    first: { type: String, required: false },
    last: { type: String, required: false },
  },
  avatar: { type: String, required: true },
  associated: {
    lists: { type: Number, required: true },
    feedgens: { type: Number, required: true },
    starterPacks: { type: Number, required: true },
    labeler: { type: Boolean, required: true },
  },
  labels: { type: [String], required: true },
  created_at: { type: Date, required: true },
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
  _count: {
    followers: { type: Number, required: true },
    following: { type: Number, required: true },
    posts: { type: Number, required: true },
  },
});

export default mongoose.model<IProfile>("Profile", ProfileSchema);
