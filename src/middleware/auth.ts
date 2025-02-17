import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { AuthenticationError, createErrorResponse } from '../utils/authErrors';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

export interface AuthRequest extends Request {
  user?: any;
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      console.warn('[Auth] Missing token for request:', req.path);
      throw new AuthenticationError('Authentication token is required', 401);
    }

    try {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!) as { id: string };
      const user = await User.findById(decoded.id).select('+refreshToken');
      if (!user) {
        console.warn('[Auth] User not found:', decoded.id);
        throw new AuthenticationError('User not found or deleted', 404);
      }
      if (!user.refreshToken) {
        console.warn('[Auth] No refresh token for user:', decoded.id);
        throw new AuthenticationError('Session invalidated', 401);
      }
      req.user = user;
      next();
    } catch (jwtError) {
      console.error('[Auth] JWT verification failed:', jwtError);
      if (jwtError instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Token has expired', 401);
      }
      if (jwtError instanceof jwt.JsonWebTokenError) {
        if (jwtError.message === 'invalid signature') {
          throw new AuthenticationError('Token signature is invalid', 401);
        }
        throw new AuthenticationError('Invalid token', 401);
      }
      throw jwtError;
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      const response = createErrorResponse(error);
      return res.status(response.error.code).json(response);
    }
    return res.status(500).json({ error: { message: 'An unknown error occurred', code: 500 } });
  }
};