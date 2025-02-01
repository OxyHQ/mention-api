import { Request, Response, NextFunction } from "express";
import { generateMfaCode, verifyMfaCode } from "../utils/mfa";

const mfaMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const { mfaCode } = req.body;

  if (!mfaCode) {
    return res.status(400).json({ message: "MFA code is required" });
  }

  const isValid = verifyMfaCode(mfaCode);
  if (!isValid) {
    return res.status(400).json({ message: "Invalid MFA code" });
  }

  next();
};

export { mfaMiddleware };
