import { Router, Request } from "express";
import { gfs, upload } from "../utils/gridfs";
import { ObjectId } from "mongodb";
import { authMiddleware } from '../middleware/auth';

// Update interface with proper extension
interface AuthenticatedRequest extends Request {
  user?: {
    _id: ObjectId;
    [key: string]: any;
  };
}

interface GridFSFile {
  _id: ObjectId | { $oid: string };
  length: number;
  chunkSize: number;
  uploadDate: Date | { $date: string };
  filename: string;
  contentType?: string;
  metadata?: {
    userID: string;
    originalname?: string;
    uploadDate?: { $date: string };
  };
}

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Upload a file linked to a user
router.post("/upload", async (req: AuthenticatedRequest, res, next) => {
  console.log("Starting file upload handler");

  // Run multer upload middleware
  upload(req, res, (err) => {
    if (err) {
      console.error("Multer error:", err);
      return res.status(400).json({ 
        message: "File upload error", 
        error: err.message 
      });
    }

    // Continue with file processing
    (async () => {
      try {
        console.log("Upload request details:", {
          user: req?.user?._id,
          contentType: req.headers['content-type'],
          files: req.files,
          body: req.body
        });

        if (!req.user?._id) {
          return res.status(401).json({ message: "Authentication required" });
        }

        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        
        if (!files || !files["files"] || files["files"].length === 0) {
          return res.status(400).json({ 
            message: "No files were uploaded",
            debug: {
              contentType: req.headers['content-type'],
              hasFiles: !!req.files,
              body: req.body
            }
          });
        }

        const uploadedFiles = files["files"].map(file => ({
          _id: (file as any)._id,
          filename: file.filename,
          originalname: file.originalname,
          size: file.size,
          mimetype: file.mimetype
        }));

        console.log("Successfully uploaded files:", uploadedFiles);
        res.json({ files: uploadedFiles });
      } catch (error: any) {
        console.error('Upload error:', error);
        res.status(error.status || 500).json({ 
          message: error.message || "Error uploading files",
          error: error?.message || 'Unknown error occurred',
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    })();
  });
});

// Get all files for the authenticated user
router.get("/list/:userID", async (req: AuthenticatedRequest, res) => {
  try {
    if (!ObjectId.isValid(req.params.userID)) {
      return res.status(400).json({ message: "Invalid userID" });
    }

    // Check if the requesting user matches the userID parameter
    if (!req.user?._id || req.user._id.toString() !== req.params.userID) {
      return res.status(403).json({ message: "Unauthorized to access these files" });
    }

    const files = await gfs.find({ "metadata.userID": new ObjectId(req.params.userID) }).toArray();
    if (!files || files.length === 0) {
      return res.json([]); // Return empty array instead of 404
    }
    res.json(files);
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ message: "Error retrieving files", error });
  }
});

// Stream a file by ID
router.get("/:id", async (req: AuthenticatedRequest, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ err: "Invalid file ID" });
  }
  try {
    if (!gfs) {
      return res.status(500).json({ err: "GridFSBucket is not initialized" });
    }
    const files = await gfs.find({ _id: new ObjectId(req.params.id) }).toArray() as GridFSFile[];
    if (!files || files.length === 0) {
      return res.status(404).json({ err: "No file exists" });
    }

    const file = files[0];
    const fileId = file._id instanceof ObjectId ? file._id : new ObjectId(file._id.$oid);
    const readstream = gfs.openDownloadStream(fileId);
    readstream.pipe(res);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ err: `An error occurred while retrieving the file: ${err.message}` });
  }
});

// Get data of multiple files by IDs
router.get("/data/:ids", async (req: AuthenticatedRequest, res) => {
  try {
    if (!gfs) {
      return res.status(500).json({ err: "GridFSBucket is not initialized" });
    }
    const rawIds = req.params.ids.split(",");
    const ids = [];
    for (let id of rawIds) {
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ err: `Invalid file ID: ${id}` });
      }
      ids.push(new ObjectId(id));
    }
    const files = await gfs.find({ _id: { $in: ids } }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ err: "No files exist" });
    }

    const fileData = files.map(file => ({
      id: file._id,
      filename: file.filename,
      contentType: file.contentType,
      length: file.length,
      uploadDate: file.uploadDate,
      metadata: file.metadata,
    }));

    res.json(fileData);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ err: `An error occurred while retrieving the files: ${err.message}` });
  }
});

export default router;
