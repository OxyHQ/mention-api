import mongoose, { Document, Schema } from "mongoose";

export interface IProfile extends Document {
  userID: mongoose.Schema.Types.ObjectId;
  name?: {
    first?: string;
    last?: string;
  };
  privacySettings: {
    isPrivateAccount: boolean;
    hideOnlineStatus: boolean;
    hideLastSeen: boolean;
    profileVisibility: boolean;
    postVisibility: boolean;
    twoFactorEnabled: boolean;
    loginAlerts: boolean;
    blockScreenshots: boolean;
    secureLogin: boolean;
    biometricLogin: boolean;
    showActivity: boolean;
    allowTagging: boolean;
    allowMentions: boolean;
    hideReadReceipts: boolean;
    allowComments: boolean;
    allowDirectMessages: boolean;
    dataSharing: boolean;
    locationSharing: boolean;
    analyticsSharing: boolean;
    sensitiveContent: boolean;
    autoFilter: boolean;
    muteKeywords: boolean;
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
      required: true,
    },
    privacySettings: {
      isPrivateAccount: { type: Boolean, default: false },
      hideOnlineStatus: { type: Boolean, default: false },
      hideLastSeen: { type: Boolean, default: false },
      profileVisibility: { type: Boolean, default: true },
      postVisibility: { type: Boolean, default: true },
      twoFactorEnabled: { type: Boolean, default: false },
      loginAlerts: { type: Boolean, default: true },
      blockScreenshots: { type: Boolean, default: false },
      secureLogin: { type: Boolean, default: true },
      biometricLogin: { type: Boolean, default: false },
      showActivity: { type: Boolean, default: true },
      allowTagging: { type: Boolean, default: true },
      allowMentions: { type: Boolean, default: true },
      hideReadReceipts: { type: Boolean, default: false },
      allowComments: { type: Boolean, default: true },
      allowDirectMessages: { type: Boolean, default: true },
      dataSharing: { type: Boolean, default: true },
      locationSharing: { type: Boolean, default: false },
      analyticsSharing: { type: Boolean, default: true },
      sensitiveContent: { type: Boolean, default: false },
      autoFilter: { type: Boolean, default: true },
      muteKeywords: { type: Boolean, default: false },
    },
    name: {
      first: { type: String },
      last: { type: String },
    },
    avatar: { type: String },
    associated: {
      lists: { type: Number, default: 0 },
      feedgens: { type: Number, default: 0 },
      starterPacks: { type: Number, default: 0 },
      labeler: { type: Boolean, default: false },
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
      uri: { type: String },
    },
    _count: {
      followers: { type: Number, default: 0 },
      following: { type: Number, default: 0 },
      posts: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// Create an index on userID for faster lookups
ProfileSchema.index({ userID: 1 }, { unique: true });

export default mongoose.model<IProfile>("Profile", ProfileSchema);
