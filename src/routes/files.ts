import { Router, Request, Response, RequestHandler } from "express";
import { ObjectId } from "mongodb";
import { authMiddleware } from '../middleware/auth';
import { upload, writeFile, readFile, deleteFile, findFiles } from '../utils/mongoose-gridfs';

interface GridFSFile {
  _id: ObjectId;
  length: number;
  chunkSize: number;
  uploadDate: Date;
  filename: string;
  contentType?: string;
  metadata?: any;
  aliases?: string[];
}

// Update interface with proper extension
interface AuthenticatedRequest extends Request {
  user?: {
    _id: ObjectId;
    [key: string]: any;
  };
  files?: Express.Multer.File[];
}

const router = Router();

// Public route - Stream a file by ID (no auth required)
router.get("/:id", (async (req: Request, res: Response) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid file ID" });
  }

  try {
    const readStream = await readFile(req.params.id);
    if (!readStream) {
      return res.status(404).json({ message: "No file exists" });
    }
    readStream.pipe(res);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: `An error occurred while retrieving the file: ${err.message}` });
  }
}) as RequestHandler);

// Apply auth middleware to all protected routes below
router.use(authMiddleware);

// Upload a file linked to a user
router.post("/upload", ((req: AuthenticatedRequest, res: Response) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error("Multer error:", err);
      return res.status(400).json({ message: "File upload error", error: err.message });
    }

    try {
      if (!req.user?._id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ message: "No files were uploaded" });
      }

      const uploadedFiles = await Promise.all(req.files.map(async (file) => {
        // Validate file information
        if (!file.originalname || !file.mimetype || !file.size) {
          throw new Error(`Invalid file information: ${JSON.stringify(file)}`);
        }
        
        const fileData = await writeFile(file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype,
          metadata: {
            userID: req.user!._id,
            originalname: file.originalname,
            size: file.size,
            uploadDate: new Date()
          }
        }) as GridFSFile;

        return {
          _id: fileData._id,
          filename: fileData.metadata?.originalname || fileData.filename,
          originalname: file.originalname,
          size: file.size,
          mimetype: file.mimetype
        };
      }));

      res.json({ files: uploadedFiles });
    } catch (error: any) {
      console.error('Upload error:', error);
      res.status(500).json({ 
        message: "Error uploading files",
        error: error?.message || 'Unknown error occurred'
      });
    }
  });
}) as RequestHandler);

// Get all files for the authenticated user
router.get("/list/:userID", (async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!ObjectId.isValid(req.params.userID)) {
      return res.status(400).json({ message: "Invalid userID" });
    }

    if (!req.user?._id || req.user._id.toString() !== req.params.userID) {
      return res.status(403).json({ message: "Unauthorized to access these files" });
    }

    const files = await findFiles({ "metadata.userID": new ObjectId(req.params.userID) });
    res.json(files || []);
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ message: "Error retrieving files", error });
  }
}) as RequestHandler);

// Get data of multiple files by IDs
router.get("/data/:ids", (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawIds = req.params.ids.split(",");
    const ids = [];
    for (let id of rawIds) {
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: `Invalid file ID: ${id}` });
      }
      ids.push(new ObjectId(id));
    }

    const files = await findFiles({ _id: { $in: ids } });
    if (!files || files.length === 0) {
      return res.status(404).json({ message: "No files exist" });
    }

    const fileData = files.map((file: GridFSFile) => ({
      id: file._id,
      filename: file.metadata?.originalname || file.filename,
      contentType: file.contentType || 'application/octet-stream',
      length: file.length,
      uploadDate: file.uploadDate,
      metadata: file.metadata || {},
    }));

    res.json(fileData);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: `An error occurred while retrieving the files: ${err.message}` });
  }
}) as RequestHandler);

// Delete a file
router.delete("/:id", (async (req: AuthenticatedRequest, res: Response) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid file ID" });
  }

  try {
    await deleteFile(req.params.id);
    res.json({ message: "File deleted successfully" });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: `An error occurred while deleting the file: ${err.message}` });
  }
}) as RequestHandler);

export default router;
