import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  _id: string;
  username: string;
  bookmarks: string[];
  password: string;
  roles: string[];
  sessions: {
    device: string;
    ip: string;
    token: string;
    expiresAt: Date;
  }[];
  email: string;
}

const UserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  bookmarks: [{ type: Schema.Types.ObjectId, ref: "Post" }],
  password: { type: String, required: true },
  roles: [{ type: String, required: true }],
  sessions: [
    {
      device: { type: String, required: true },
      ip: { type: String, required: true },
      token: { type: String, required: true },
      expiresAt: { type: Date, required: true },
    },
  ],
  email: { type: String, required: true, unique: true },
});

export default mongoose.model<IUser>("User", UserSchema);
