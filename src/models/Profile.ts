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
  location?: string;
  website?: string;
  pinnedPost?: {
    cid?: string;
    uri?: string;
  };
  _count?: {
    followers?: number;
    following?: number;
    posts?: number;
    karma?: number;
  };
}

const ProfileSchema: Schema = new Schema(
  {
    userID: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: true
    },
    name: {
      first: { type: String },
      last: { type: String }
    },
    avatar: { type: String },
    associated: {
      lists: { type: Number, default: 0 },
      feedgens: { type: Number, default: 0 },
      starterPacks: { type: Number, default: 0 },
      labeler: { type: Boolean, default: false }
    },
    labels: { type: [String], default: [] },
    created_at: { type: Date, default: Date.now },
    description: { type: String },
    indexedAt: { type: Date },
    banner: { type: String },
    location: { type: String },
    website: { type: String },
    pinnedPost: {
      cid: { type: String },
      uri: { type: String }
    },
    _count: {
      followers: { type: Number, default: 0 },
      following: { type: Number, default: 0 },
      posts: { type: Number, default: 0 }
    }
  },
  { 
    timestamps: true,
    strict: true
  }
);

// Create an index on userID for faster lookups
ProfileSchema.index({ userID: 1 }, { unique: true });

export default mongoose.model<IProfile>("Profile", ProfileSchema);
