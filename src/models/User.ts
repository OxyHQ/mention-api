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
}

const UserSchema: Schema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      select: true, // Explicitly include in queries
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      select: true, // Explicitly include in queries
    },
    password: {
      type: String,
      required: true,
      select: false, // Only exclude in queries, still saves to DB
      set: (v: string) => v, // Ensure value is passed through
    },
    refreshToken: {
      type: String,
      default: null,
      select: false,
    },
    bookmarks: [
      {
        type: Schema.Types.ObjectId,
        ref: "Post",
        default: [],
        select: true,
      },
    ],
  },
  {
    timestamps: true,
    strict: true, // Ensure only schema fields are saved
    validateBeforeSave: true,
  }
);

// Remove transforms and rely on select options
UserSchema.set("toJSON", {
  transform: function (doc, ret) {
    return ret; // Return as-is, let select handle field visibility
  },
  versionKey: false,
});

// Add a save middleware to ensure password is included
UserSchema.pre("save", function (next) {
  // Log document state before save
  console.log("Saving user document:", {
    hasUsername: !!this.username,
    hasEmail: !!this.email,
    hasPassword: !!this.password,
    fields: Object.keys(this.toObject()),
  });
  next();
});

export default mongoose.model<IUser>("User", UserSchema);
