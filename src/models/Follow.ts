import mongoose, { Document, Schema } from "mongoose";

export interface IFollow extends Document {
  followerId: mongoose.Types.ObjectId;  // User who follows
  followingId: mongoose.Types.ObjectId; // User being followed
  createdAt: Date;
}

const FollowSchema: Schema = new Schema({
  followerId: { 
    type: Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  followingId: { 
    type: Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

// Compound index to ensure unique follows and optimize queries
FollowSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
// Index for getting followers
FollowSchema.index({ followingId: 1 });
// Index for getting following
FollowSchema.index({ followerId: 1 });

export default mongoose.model<IFollow>("Follow", FollowSchema);