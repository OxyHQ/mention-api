import { Router, Request, Response } from "express";
import { Namespace as SocketNamespace, Socket } from "socket.io";
import jwt from 'jsonwebtoken';
import { authMiddleware } from "../middleware/auth";
import MessageModel from "../models/Message.model";
import ConversationModel from "../models/Conversation.model";
import ReportModel from "../models/Report.model";
import { AuthenticationError, createErrorResponse } from "../utils/authErrors";
import { DefaultEventsMap } from "socket.io/dist/typed-events";

const router = Router();

interface CreateConversationData {
  participants: string[];
  type: 'private' | 'secret' | 'group' | 'channel';
  name?: string;
  isPublic?: boolean;
  description?: string;
  ttl?: number;
  encryptionKey?: string;
}

interface BaseSocket extends Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap> {
  user?: {
    id: string;
    [key: string]: any;
  };
}

interface AuthRequest extends Request {
  user?: {
    id: string;
    [key: string]: any;
  };
}

router.use(authMiddleware);

const verifyToken = (socket: BaseSocket, next: (err?: Error) => void) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new AuthenticationError('Authentication token is required', 401));
  }
  
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'default_secret');
    socket.user = decoded as { id: string; [key: string]: any };
    return next();
  } catch (error: unknown) {
    if (error instanceof Error) {
      const response = createErrorResponse(error);
      return next(new AuthenticationError(response.error.message, response.error.code));
    }
    return next(new AuthenticationError('An unknown error occurred', 500));
  }
};

router.post('/conversations/create', async (req: AuthRequest, res: Response) => {
  try {
    const { participants, type, name, isPublic, description, ttl, encryptionKey } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    // Ensure current user is in participants
    const allParticipants = [...new Set([...participants, userId])];

    const conversationData = {
      participants: allParticipants,
      type,
      name,
      isPublic,
      description,
      ttl,
      encryptionKey,
      owner: userId,
      admins: (type === 'group' || type === 'channel') ? [userId] : undefined,
      createdAt: new Date()
    };

    const conversation = await ConversationModel.create(conversationData);

    // Get the socket namespace
    const io = req.app.get('io') as SocketNamespace;
    
    // Notify all participants about the new conversation
    if (io) {
      allParticipants.forEach((participantId: string) => {
        io.to(`user:${participantId}`).emit('conversationCreated', conversation);
      });
    }

    return res.status(200).json(conversation);
  } catch (error: any) {
    console.error('Error creating conversation:', error);
    return res.status(500).json({ 
      error: { 
        message: error.message || 'Could not create conversation'
      } 
    });
  }
});

export default (io: SocketNamespace) => {
  io.use(verifyToken);

  // Handle conversation creation notifications here at the socket level
  const notifyConversationCreated = (conversation: any) => {
    conversation.participants.forEach((participantId: string) => {
      io.to(`user:${participantId}`).emit('conversationCreated', conversation);
    });
  };

  io.on("connection", async (socket: BaseSocket) => {
    try {
      const userId = socket.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      console.log(`User ${userId} connected to chat`);
      
      // Join user's personal room for direct messages
      socket.join(`user:${userId}`);
      
      // Acknowledge successful connection
      socket.emit('connected', { userId });

      socket.on("joinConversation", async (conversationID: string, callback) => {
        try {
          // Verify user is a participant
          const conversation = await ConversationModel.findById(conversationID);
          if (!conversation) {
            throw new Error('Conversation not found');
          }
          
          if (!conversation.participants.includes(userId)) {
            throw new Error('Not authorized to join this conversation');
          }

          // Join the conversation room
          await socket.join(conversationID);
          console.log(`User ${userId} joined conversation ${conversationID}`);
          
          // Acknowledge successful join
          callback?.({ success: true });
          
          // Notify other participants
          socket.to(conversationID).emit('userJoined', { userId, conversationID });
          
        } catch (error) {
          console.error('Error joining conversation:', error);
          callback?.({ 
            error: error instanceof Error ? error.message : 'Failed to join conversation'
          });
        }
      });

      socket.on("createConversation", async (data: CreateConversationData, callback) => {
        try {
          if (!socket.user?.id) {
            throw new Error('User not authenticated');
          }

          const { participants, type, name, isPublic, description, ttl, encryptionKey } = data;
          
          // Ensure current user is in participants
          if (!participants.includes(socket.user.id)) {
            participants.push(socket.user.id);
          }

          const conversationData = {
            participants,
            type,
            name,
            isPublic,
            description,
            ttl,
            encryptionKey,
            owner: socket.user.id,
            admins: (type === 'group' || type === 'channel') ? [socket.user.id] : undefined,
            createdAt: new Date()
          };
          
          const conversation = await ConversationModel.create(conversationData);
          
          // Join the creator to the conversation room
          socket.join(conversation.id);
          
          // Notify all participants about the new conversation
          participants.forEach((participantId: string) => {
            io.to(participantId).emit("conversationCreated", conversation);
          });
          
          callback?.({ success: true, conversation });
        } catch (err) {
          console.error("Error creating conversation:", err);
          callback?.({ 
            error: err instanceof Error ? err.message : "Could not create conversation" 
          });
        }
      });

      // Typing indicator events
      socket.on("typing", (conversationID: string) => {
        socket.to(conversationID).emit("typing", { user: socket.id });
      });
      socket.on("stopTyping", (conversationID: string) => {
        socket.to(conversationID).emit("stopTyping", { user: socket.id });
      });

      socket.on("sendMessage", async (data) => {
        try {
          const { userID, conversationID, message } = data;
          const newMessage = { userID, conversationID, message, createdAt: new Date(), status: "sent" };
          await MessageModel.create(newMessage);
          io.to(conversationID).emit("message", newMessage);
        } catch (err) {
          console.error("Error sending message:", err);
        }
      });

      socket.on("sendSecureMessage", async (data) => {
        try {
          const { userID, conversationID, message, encrypted, encryptionAlgorithm, signature } = data;
          const secureMessage = { userID, conversationID, message, createdAt: new Date(), status: "sent", encrypted, encryptionAlgorithm, signature };
          await MessageModel.create(secureMessage);
          io.to(conversationID).emit("message", secureMessage);
        } catch (err) {
          console.error("Error sending secure message:", err);
        }
      });

      socket.on("reportMessage", async (data) => {
        const { conversationID, messageId, reason } = data;
        try {
          await ReportModel.create({
            conversationID,
            messageId,
            reporter: socket.id,
            reason,
            createdAt: new Date(),
          });
          io.to(conversationID).emit("messageReported", { messageId, reporter: socket.id, reason });
        } catch (err) {
          console.error("Error reporting message:", err);
          socket.emit("error", { message: "Could not report message" });
        }
      });

      socket.on("editMessage", async (data) => {
        try {
          const { conversationID, messageId, newMessage } = data;
          await MessageModel.findByIdAndUpdate(messageId, { message: newMessage, editedAt: new Date() });
          io.to(conversationID).emit("messageEdited", { messageId, newMessage, editedAt: new Date() });
        } catch (err) {
          console.error("Error editing message:", err);
        }
      });

      socket.on("deleteMessage", async (data) => {
        const { conversationID, messageId } = data;
        try {
          await MessageModel.findByIdAndDelete(messageId);
          io.to(conversationID).emit("messageDeleted", { messageId });
        } catch (err) {
          console.error("Error deleting message:", err);
          socket.emit("error", { message: "Could not delete message" });
        }
      });

      socket.on("forwardMessage", async (data) => {
        const { fromConversationID, toConversationID, messageId } = data;
        try {
          const originalMessage = await MessageModel.findById(messageId);
          if (originalMessage) {
            // Create a duplicate with forwarded metadata.
            const forwardedMessage = {
              userID: originalMessage.userID,
              conversationID: toConversationID,
              message: originalMessage.message,
              createdAt: new Date(),
              status: "sent",
              forwardedFrom: fromConversationID,
            };
            const newMessage = await MessageModel.create(forwardedMessage);
            io.to(toConversationID).emit("messageForwarded", { messageId: newMessage.id, forwardedAt: new Date() });
          } else {
            throw new Error("Original message not found");
          }
        } catch (err) {
          console.error("Error forwarding message:", err);
          socket.emit("error", { message: "Could not forward message" });
        }
      });

      socket.on("messageRead", async (data) => {
        const { conversationID, messageId } = data;
        try {
          await MessageModel.findByIdAndUpdate(messageId, {
            status: "read",
            $addToSet: { readBy: socket.id },
          });
          io.to(conversationID).emit("messageStatusUpdate", { messageId, status: "read" });
        } catch (err) {
          console.error("Error updating read status:", err);
          socket.emit("error", { message: "Could not update read status" });
        }
      });

      socket.on("pinMessage", async (data) => {
        const { conversationID, messageId, pin } = data;
        try {
          await MessageModel.findByIdAndUpdate(messageId, {
            pinned: pin,
            pinnedAt: new Date(),
            pinnedBy: socket.id,
          });
          io.to(conversationID).emit("messagePinned", { messageId, pinned: pin, pinnedAt: new Date(), pinnedBy: socket.id });
        } catch (err) {
          console.error("Error updating pinned status:", err);
          socket.emit("error", { message: "Could not update pinned status" });
        }
      });

      socket.on("reactionMessage", async (data) => {
        const { conversationID, messageId, emoji } = data;
        try {
          await MessageModel.findByIdAndUpdate(messageId, {
            $push: { reactions: { emoji, userID: socket.id } },
          });
          io.to(conversationID).emit("messageReaction", { messageId, emoji, userID: socket.id });
        } catch (err) {
          console.error("Error updating reaction:", err);
          socket.emit("error", { message: "Could not update reaction" });
        }
      });

      socket.on("scheduleMessage", (data) => {
        const { userID, conversationID, message, scheduledTime } = data;
        const delay = new Date(scheduledTime).getTime() - Date.now();
        if (delay > 0) {
          setTimeout(async () => {
            const scheduledMessage = {
              userID,
              conversationID,
              message,
              createdAt: new Date(),
              status: "sent",
              scheduledAt: new Date(scheduledTime)
            };
            await MessageModel.create(scheduledMessage);
            console.log("Scheduled message sent:", scheduledMessage);
            io.to(conversationID).emit("message", scheduledMessage);
          }, delay);
        } else {
          (async () => {
            const newMessage = { userID, conversationID, message, createdAt: new Date(), status: "sent" };
            await MessageModel.create(newMessage);
            io.to(conversationID).emit("message", newMessage);
          })();
        }
      });

      socket.on("unsendMessage", async (data) => {
        const { conversationID, messageId } = data;
        try {
          await MessageModel.findByIdAndDelete(messageId);
          io.to(conversationID).emit("messageUnsent", { messageId });
        } catch (err) {
          console.error("Error unsending message:", err);
          socket.emit("error", { message: "Could not unsend message" });
        }
      });

      socket.on("sendEphemeralMessage", async (data) => {
        const { userID, conversationID, message, expiresIn } = data; // expiresIn in milliseconds
        const ephemeralMessage = {
          userID,
          conversationID,
          message,
          createdAt: new Date(),
          status: "sent",
          ephemeralExpiresAt: new Date(Date.now() + expiresIn)
        };
        try {
          await MessageModel.create(ephemeralMessage);
          io.to(conversationID).emit("message", ephemeralMessage);
          // Optionally, notify clients when message is removed.
          setTimeout(() => {
            io.to(conversationID).emit("messageDeleted", { messageId: ephemeralMessage.createdAt.toString() });
          }, expiresIn);
        } catch (err) {
          console.error("Error sending ephemeral message:", err);
          socket.emit("error", { message: "Could not send ephemeral message" });
        }
      });

      socket.on("sendVoiceMessage", (data) => {
        const { userID, conversationID, message, voiceUrl } = data;
        const voiceMessage = {
          userID,
          conversationID,
          message,
          createdAt: new Date(),
          status: "sent",
          attachments: [{ type: "voice", url: voiceUrl }]
        };
        io.to(conversationID).emit("message", voiceMessage);
      });

      socket.on("sendSticker", (data) => {
        const { userID, conversationID, stickerUrl } = data;
        const stickerMessage = {
          userID,
          conversationID,
          message: "",
          createdAt: new Date(),
          status: "sent",
          attachments: [{ type: "sticker", url: stickerUrl }]
        };
        io.to(conversationID).emit("message", stickerMessage);
      });

      socket.on("createPoll", (data) => {
        const { userID, conversationID, question, options } = data;
        const pollMessage = {
          userID,
          conversationID,
          message: "",
          createdAt: new Date(),
          status: "sent",
          poll: {
            question,
            options,
            votes: options.map(() => 0)
          }
        };
        io.to(conversationID).emit("message", pollMessage);
      });

      socket.on("votePoll", async (data) => {
        const { conversationID, messageId, optionIndex } = data;
        try {
          const message = await MessageModel.findById(messageId);
          if (message && message.poll) {
            // Ensure votes array is valid.
            const votes = Array.isArray(message.poll.votes)
              ? message.poll.votes
              : message.poll.options.map(() => 0);
            // Increment vote for the selected option.
            votes[optionIndex] = (votes[optionIndex] || 0) + 1;
            await MessageModel.findByIdAndUpdate(messageId, { "poll.votes": votes });
            io.to(conversationID).emit("pollVoted", { messageId, optionIndex, votes });
          } else {
            throw new Error("Poll not found");
          }
        } catch (err) {
          console.error("Error voting poll:", err);
          socket.emit("error", { message: "Could not vote on poll" });
        }
      });

      socket.on("conversationCreated", (conversation) => {
        notifyConversationCreated(conversation);
      });

      socket.on("disconnect", () => {
        console.log(`User ${userId} disconnected from chat`);
      });

    } catch (error) {
      console.error('Error in socket connection:', error);
      socket.disconnect();
    }
  });

  return router;
};

// Basic token verification implementation.
function tokenIsValid(token: string): boolean {
  // Replace with your own verification logic.
  return token === "valid-token";
}
