import mongoose, { Document, Schema } from "mongoose";

const PostSchema: Schema = new Schema({
  userID: { type: mongoose.Schema.Types.ObjectId, required: true },
  created_at: { type: Date, required: true },
  text: { type: String, required: true },
  source: { type: String, required: false },
  possibly_sensitive: { type: Boolean, required: false },
  lang: { type: String, required: false },
  quoted_post_id: { type: String, required: false },
  in_reply_to_status_id: { type: String, required: false },
  media: { type: Schema.Types.Mixed, required: false },
  quoted_post: { type: Schema.Types.Mixed, required: false },
  location: { type: Schema.Types.Mixed, required: false },
  _count: {
    likes: { type: Number, default: 0 },
    quotes: { type: Number, default: 0 },
    reposts: { type: Number, default: 0 },
    bookmarks: { type: Number, default: 0 },
    replies: { type: Number, default: 0 },
  },
});

export default mongoose.model("Post", PostSchema);
