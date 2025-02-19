import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  refreshToken?: string | null;
  bookmarks: mongoose.Types.ObjectId[];
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
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
}

const UserSchema: Schema = new Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    select: true // Explicitly include in queries
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    select: true // Explicitly include in queries
  },
  password: { 
    type: String, 
    required: true,
    select: false, // Only exclude in queries, still saves to DB
    set: (v: string) => v // Ensure value is passed through
  },
  refreshToken: { 
    type: String, 
    default: null,
    select: false
  },
  bookmarks: [{ 
    type: Schema.Types.ObjectId, 
    ref: "Post",
    default: [],
    select: true
  }],
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
    muteKeywords: { type: Boolean, default: false }
  }
}, {
  timestamps: true,
  strict: true, // Ensure only schema fields are saved
  validateBeforeSave: true
});

// Remove transforms and rely on select options
UserSchema.set('toJSON', {
  transform: function(doc, ret) {
    return ret; // Return as-is, let select handle field visibility
  },
  versionKey: false
});

// Add a save middleware to ensure password is included
UserSchema.pre('save', function(next) {
  // Log document state before save
  console.log('Saving user document:', {
    hasUsername: !!this.username,
    hasEmail: !!this.email,
    hasPassword: !!this.password,
    fields: Object.keys(this.toObject())
  });
  next();
});

export default mongoose.model<IUser>("User", UserSchema);

