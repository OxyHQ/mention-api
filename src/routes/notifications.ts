import express, { Request, Response } from "express";
import Notification from "../models/Notification";
import User from "../models/User";
import { authMiddleware } from '../middleware/auth';
import { io } from '../server';

const router = express.Router();

router.use(authMiddleware);

// Helper function to emit notification event
const emitNotification = async (notification: any) => {
  const populated = await notification.populate('actorId', 'username name avatar');
  io.to(`user:${notification.recipientId}`).emit('notification', populated);
};

// Get notifications for current user
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.body.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    // Join user's notification room on connection
    const socket = (req as any).socket;
    if (socket) {
      socket.join(`user:${userId}`);
    }

    const notifications = await Notification.find({ recipientId: userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('actorId', 'username name avatar')
      .populate('entityId');

    const unreadCount = await Notification.countDocuments({
      recipientId: userId,
      read: false
    });

    res.json({
      notifications,
      unreadCount,
      hasMore: notifications.length === limit
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching notifications", error });
  }
});

// Create a notification
router.post("/", async (req: Request, res: Response) => {
  try {
    const notification = new Notification(req.body);
    await notification.save();
    await emitNotification(notification);
    res.status(201).json(notification);
  } catch (error) {
    res.status(500).json({ message: "Error creating notification", error });
  }
});

// Mark notification as read
router.put("/:id/read", async (req: Request, res: Response) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.body.userId },
      { read: true },
      { new: true }
    ).populate('actorId', 'username name avatar');

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    // Emit updated notification
    io.to(`user:${notification.recipientId}`).emit('notificationUpdate', notification);

    res.json({ message: "Notification marked as read", notification });
  } catch (error) {
    res.status(500).json({ message: "Error updating notification", error });
  }
});

// Mark all notifications as read
router.put("/read-all", async (req: Request, res: Response) => {
  try {
    await Notification.updateMany(
      { recipientId: req.body.userId },
      { read: true }
    );

    // Emit bulk update event
    io.to(`user:${req.body.userId}`).emit('allNotificationsRead');

    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Error updating notifications", error });
  }
});

// Delete a notification
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipientId: req.body.userId
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    // Emit deletion event
    io.to(`user:${req.body.userId}`).emit('notificationDeleted', notification._id);

    res.json({ message: "Notification deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting notification", error });
  }
});

export default router;