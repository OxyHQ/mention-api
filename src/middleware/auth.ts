import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

// Interface for authenticated requests
export interface AuthRequest extends Request {
    user?: {
        id: string;
    };
}

// Extract user ID from JWT token
const extractUserIdFromToken = (token: string): string | null => {
    try {
        // Using OxyHQ's ACCESS_TOKEN_SECRET for token verification
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!) as { id: string };
        return decoded.id || null;
    } catch (error) {
        logger.error('Error extracting user ID from token:', error);
        return null;
    }
};

// Authentication middleware that relies on OxyHQ authentication
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'Invalid or missing authorization header'
            });
        }

        const token = authHeader.split(' ')[1];
        
        // OxyHQ's token secret must be configured
        if (!process.env.ACCESS_TOKEN_SECRET) {
            logger.error('ACCESS_TOKEN_SECRET not configured');
            return res.status(500).json({ 
                success: false,
                message: 'Server configuration error'
            });
        }

        try {
            // Just verify the token and extract user ID
            const userId = extractUserIdFromToken(token);
            if (!userId) {
                return res.status(401).json({
                    error: 'Invalid token',
                    message: 'User ID not found in token'
                });
            }

            // Set just the user ID in request
            req.user = { id: userId };
            next();
        } catch (error) {
            logger.error('Token verification error:', error);
            
            if (error instanceof jwt.TokenExpiredError) {
                return res.status(401).json({
                    error: 'Token expired',
                    message: 'Your session has expired. Please log in again.'
                });
            }
            
            if (error instanceof jwt.JsonWebTokenError) {
                return res.status(401).json({
                    error: 'Invalid token',
                    message: 'The provided authentication token is invalid'
                });
            }
            
            return res.status(401).json({
                error: 'Authentication error',
                message: 'An error occurred while authenticating your request'
            });
        }
    } catch (error) {
        logger.error('Auth middleware error:', error);
        return res.status(500).json({
            error: 'Server error',
            message: 'An unexpected error occurred'
        });
    }
};