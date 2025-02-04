import { Router } from "express";
import { gfs, upload } from "../utils/gridfs";
import { ObjectId } from "mongodb"; // Import ObjectId

const router = Router();

// Upload a file linked to a user
router.post("/upload", upload.fields([{ name: 'files', maxCount: 5 }]), (req, res) => {
  if (!req.body.userId || !ObjectId.isValid(req.body.userId)) {
    return res.status(400).json({ message: "A valid User ID is required" });
  }
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  if (!files || !files["files"] || files["files"].length === 0) {
    return res.status(400).json({ message: "Files are required" });
  }
  res.json({ files: req.files });
});

// Get all files
router.get("/list/:userId", async (req, res) => {
  if (!ObjectId.isValid(req.params.userId)) {
    return res.status(400).json({ message: "Invalid userId" });
  }
  try {
    const files = await gfs.find({ "metadata.userId": new ObjectId(req.params.userId) }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ message: "No files found for this user" });
    }
    res.json(files);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving files", error });
  }
});

// Stream a file by ID
router.get("/:id", async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ err: "Invalid file ID" });
  }
  try {
    if (!gfs) {
      return res.status(500).json({ err: "GridFSBucket is not initialized" });
    }
    const file = await gfs.find({ _id: new ObjectId(req.params.id) }).toArray();
    if (!file || file.length === 0) {
      return res.status(404).json({ err: "No file exists" });
    }

    const readstream = gfs.openDownloadStream(file[0]._id); // Update readstream
    readstream.pipe(res);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ err: `An error occurred while retrieving the file: ${err.message}` });
  }
});

// Get data of multiple files by IDs
router.get("/data/:ids", async (req, res) => {
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
