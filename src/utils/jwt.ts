import jwt from "jsonwebtoken";
import { IUser } from "../models/User";

const generateAccessToken = (user: IUser) => {
  return jwt.sign({ _id: user._id, roles: user.roles }, process.env.ACCESS_TOKEN_SECRET as string, { expiresIn: "15m" });
};

const generateRefreshToken = (user: IUser) => {
  return jwt.sign({ _id: user._id }, process.env.REFRESH_TOKEN_SECRET as string, { expiresIn: "7d" });
};

const verifyToken = (token: string, secret: string) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
};

export { generateAccessToken, generateRefreshToken, verifyToken };
