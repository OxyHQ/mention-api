import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";
import { GridFsStorage } from "multer-gridfs-storage";
import multer from "multer";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const connPromise = mongoose.connect(process.env.MONGODB_URI || "");

let gfs: GridFSBucket;

connPromise.then((conn) => {
  if (conn.connection.db) {
    gfs = new GridFSBucket(conn.connection.db, { bucketName: "uploads" });
  } else {
    console.error("Database connection is undefined");
  }
});

// Create storage engine with detailed error handling
const storage = new GridFsStorage({
  url: process.env.MONGODB_URI || "",
  file: (req: any, file) => {
    console.log("GridFS Storage - Processing file:", {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      encoding: file.encoding,
      headers: req.headers
    });

    return new Promise((resolve, reject) => {
      try {
        if (!req.user?._id) {
          console.error("GridFS Storage - No user ID found in request");
          reject(new Error('User not authenticated'));
          return;
        }

        // Create a unique filename
        const originalName = file.originalname;
        const timestamp = Date.now();
        const ext = path.extname(originalName);
        const filename = `${timestamp}-${path.basename(originalName, ext)}${ext}`;

        const fileInfo = {
          filename: filename,
          bucketName: "uploads",
          metadata: { 
            userID: req.user._id.toString(),
            originalname: originalName,
            uploadDate: new Date(),
            mimetype: file.mimetype
          }
        };
        
        console.log("GridFS Storage - Created file info:", fileInfo);
        resolve(fileInfo);
      } catch (error) {
        console.error("GridFS Storage - Error processing file:", error);
        reject(error);
      }
    });
  }
});

// Configure multer with custom error handling
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    console.log("Multer fileFilter - Processing file:", {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      encoding: file.encoding
    });

    // Check if the fieldname is correct
    if (file.fieldname !== 'files') {
      cb(new Error('Invalid field name, expected "files"'));
      return;
    }

    cb(null, true);
  }
}).fields([{ 
  name: 'files',
  maxCount: 5
}]);

export { gfs, upload };