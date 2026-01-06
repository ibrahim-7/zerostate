import { Router } from 'express';
import multer from 'multer';
import { parsePostmanCollection } from '../services/postmanParser';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', upload.single('collection'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const json = JSON.parse(req.file.buffer.toString());
    const apis = parsePostmanCollection(json);
    res.json({ apis });
  } catch (err) {
    res.status(400).json({ error: 'Invalid Postman JSON' });
  }
});

export default router;
