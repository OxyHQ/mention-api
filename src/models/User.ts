import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  _id: string;
  username: string;
  bookmarks: string[];
}

const UserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  bookmarks: [{ type: Schema.Types.ObjectId, ref: "Post" }],
});

export default mongoose.model<IUser>("User", UserSchema);
