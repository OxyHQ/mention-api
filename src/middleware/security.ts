import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import csrf from "csurf";
import { Request, Response, NextFunction } from "express";

// Rate limiting middleware
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});

// Brute force protection middleware
const bruteForceProtection = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 100, // allow 100 requests per 15 minutes, then...
  delayMs: 500, // begin adding 500ms of delay per request above 100
});

// CSRF protection middleware
const csrfProtection = csrf({ cookie: true });

export { rateLimiter, bruteForceProtection, csrfProtection };
