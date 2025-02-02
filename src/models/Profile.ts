import mongoose, { Document, Schema } from "mongoose";

export interface IProfile extends Document {
  userID: mongoose.Schema.Types.ObjectId;
  name?: {
    first?: string;
    last?: string;
  };
  avatar?: string;
  associated?: {
    lists?: number;
    feedgens?: number;
    starterPacks?: number;
    labeler?: boolean;
  };
  labels?: string[];
  created_at?: Date;
  description?: string;
  indexedAt?: Date;
  banner?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  pinnedPost?: {
    cid?: string;
    uri?: string;
  };
  _count?: {
    followers?: number;
    following?: number;
    posts?: number;
  };
}

const ProfileSchema: Schema = new Schema(
  {
    userID: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: {
      first: { type: String },
      last: { type: String }
    },
    avatar: { type: String },
    associated: {
      lists: { type: Number },
      feedgens: { type: Number },
      starterPacks: { type: Number },
      labeler: { type: Boolean }
    },
    labels: { type: [String] },
    created_at: { type: Date },
    description: { type: String },
    indexedAt: { type: Date },
    banner: { type: String },
    followersCount: { type: Number },
    followsCount: { type: Number },
    postsCount: { type: Number },
    pinnedPost: {
      cid: { type: String },
      uri: { type: String }
    },
    _count: {
      followers: { type: Number },
      following: { type: Number },
      posts: { type: Number }
    }
  },
  { timestamps: true }
);

export default mongoose.model<IProfile>("Profile", ProfileSchema);
