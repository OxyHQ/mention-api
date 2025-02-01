import mongoose, { Document, Schema } from "mongoose";

export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;
  device: string;
  ip: string;
  token: string;
  expiresAt: Date;
}

const SessionSchema: Schema = new Schema(
  {
    userId: { type: mongoose.Types.ObjectId, ref: "User", required: true },
    device: { type: String, required: true },
    ip: { type: String, required: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<ISession>("Session", SessionSchema);
