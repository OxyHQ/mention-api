import mongoose, { Document, Schema } from 'mongoose';

interface IItem extends Document {
  name: string;
  description: string;
  createdAt: Date;
}

const itemSchema: Schema = new Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IItem>('Item', itemSchema);
