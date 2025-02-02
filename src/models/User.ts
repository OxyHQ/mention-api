import mongoose, { Document, Schema } from "mongoose";

interface IUser extends Document {
  username: string;
  email: string;
  password: string;
}


const UserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  bookmarks: [{ type: Schema.Types.ObjectId, ref: "Post" }],
});

export default mongoose.model<IUser>("User", UserSchema);
