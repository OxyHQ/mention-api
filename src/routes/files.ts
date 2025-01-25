import { Router } from "express";
import { gfs, upload } from "../utils/gridfs";
import { ObjectId } from "mongodb"; // Import ObjectId

const router = Router();

router.post("/upload", upload.single("file"), (req, res) => {
  res.json({ file: req.file });
});

router.get("/:id", async (req, res) => {
  try {
    if (!gfs) {
      return res.status(500).json({ err: "GridFSBucket is not initialized" });
    }
    const file = await gfs.find({ _id: new ObjectId(req.params.id) }).toArray(); // Update file retrieval
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

export default router;
