import mongoose from "mongoose";
import { GridFSBucket } from "mongodb"; // Update import
import { GridFsStorage } from "multer-gridfs-storage";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

const connPromise = mongoose.connect(process.env.MONGODB_URI || "");

let gfs: GridFSBucket; // Update type

connPromise.then((conn) => {
  if (conn.connection.db) {
    gfs = new GridFSBucket(conn.connection.db, { bucketName: "uploads" }); // Update initialization
  } else {
    console.error("Database connection is undefined");
  }
});

const storage = new GridFsStorage({
  url: process.env.MONGODB_URI || "",
  file: (req, file) => {
    return {
      bucketName: "uploads",
      filename: `${Date.now()}-${file.originalname}`,
    };
  },
});

const upload = multer({ storage });

export { gfs, upload };
