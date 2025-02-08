import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { AuthenticationError, createErrorResponse } from '../utils/authErrors';

export interface AuthRequest extends Request {
    user?: any;
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            throw new AuthenticationError('Authentication token is required', 401);
        }

        try {
            const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!) as { id: string };
            const user = await User.findById(decoded.id);

            if (!user) {
                throw new AuthenticationError('User not found or deleted', 404);
            }

            req.user = user;
            next();
        } catch (jwtError) {
            throw new AuthenticationError('Token signature is invalid', 401);
        }
    } catch (error: unknown) {
        if (error instanceof Error) {
            const response = createErrorResponse(error);
            return res.status(response.error.code).json(response);
        }
        return res.status(500).json({ error: { message: 'An unknown error occurred', code: 500 } });
    }
};