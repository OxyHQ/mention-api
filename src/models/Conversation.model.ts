import mongoose, { Schema, Document } from "mongoose"; 

export interface IConversation extends Document {
  participants: string[];
  topic?: string;
  lastMessage?: string;
  lastUpdated?: Date;
  type: "private" | "secret" | "group" | "channel";
  owner?: string;
  admins?: string[];
  isEncrypted?: boolean;
  encryptionKey?: string;
  ttl?: number; // Time-to-live in seconds for secret chats
  memberCount?: number;
  description?: string;
  isPublic?: boolean;
  permissions?: {
    canSendMessages?: boolean;
    canAddMembers?: boolean;
    canPinMessages?: boolean;
  };
  pinnedMessages?: string[];
  metadata?: {
    avatarUrl?: string;
    customEmojis?: string[];
    theme?: string;
  };
  expiresAt?: Date; // Field for TTL expiration
}

const ConversationSchema = new Schema<IConversation>({
  participants: [{ type: String, required: true }],
  topic: { type: String },
  lastMessage: { type: String },
  lastUpdated: { type: Date },
  type: { 
    type: String, 
    enum: ["private", "secret", "group", "channel"], 
    default: "private",
    required: true
  },
  owner: { type: String },
  admins: [{ type: String }],
  isEncrypted: { type: Boolean, default: false },
  encryptionKey: { type: String },
  ttl: { type: Number },
  memberCount: { type: Number, default: 0 },
  description: { type: String },
  isPublic: { type: Boolean, default: false },
  permissions: {
    canSendMessages: { type: Boolean, default: true },
    canAddMembers: { type: Boolean, default: false },
    canPinMessages: { type: Boolean, default: false }
  },
  pinnedMessages: [{ type: String }],
  metadata: {
    avatarUrl: { type: String },
    customEmojis: [{ type: String }],
    theme: { type: String }
  },
  expiresAt: { type: Date } // Field for TTL index
}, { 
  timestamps: true
});

// Indexes for efficient querying
ConversationSchema.index({ participants: 1 });
// TTL index for secret chats using the computed expiresAt field
ConversationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { type: 'secret' } });
ConversationSchema.index({ isPublic: 1 });
ConversationSchema.index({ "metadata.theme": 1 });

// Pre-save hook to update member count and compute expiresAt for secret chats
ConversationSchema.pre('save', function(next) {
  if (this.isModified('participants')) {
    this.memberCount = this.participants.length;
  }
  if (this.type === 'secret' && this.ttl) {
    this.expiresAt = new Date(Date.now() + this.ttl * 1000);
  }
  next();
});

export default mongoose.model<IConversation>("Conversation", ConversationSchema);
