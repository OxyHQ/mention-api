import express, { Request, Response } from 'express';
import Item from '../models/Item';

const router = express.Router();

// GET all items
router.get('/', async (req: Request, res: Response) => {
  try {
    const items = await Item.find();
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'An error occurred' });
  }
});

// POST a new item
router.post('/', async (req: Request, res: Response) => {
  const item = new Item({
    name: req.body.name,
    description: req.body.description,
  });

  try {
    const newItem = await item.save();
    res.status(201).json(newItem);
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : 'An error occurred' });
  }
});

export default router;
