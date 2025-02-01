import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import User from "../models/User";
import Session from "../models/Session";

const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const authorizeRoles = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.sendStatus(403);
    }
    next();
  };
};

const revokeToken = async (req: Request, res: Response, next: NextFunction) => {
  const { token } = req.body;

  try {
    const session = await Session.findOne({ token });
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    await session.remove();
    res.json({ message: "Token revoked" });
  } catch (error) {
    res.status(500).json({ message: "Error revoking token", error });
  }
};

const checkSessionExpiration = async (req: Request, res: Response, next: NextFunction) => {
  const { token } = req.body;

  try {
    const session = await Session.findOne({ token });
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (session.expiresAt < new Date()) {
      await session.remove();
      return res.status(401).json({ message: "Session expired" });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: "Error checking session expiration", error });
  }
};

export { authenticateToken, authorizeRoles, revokeToken, checkSessionExpiration };
