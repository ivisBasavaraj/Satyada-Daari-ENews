import { Router, Request, Response, NextFunction } from 'express';
import { db } from './db';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import jwt from 'jsonwebtoken';

export const adminRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

// Configure Multer for secure file uploads
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOAD_ROOT = path.join(DATA_DIR, 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Check if newspaper_id is in body or query for subfolder organization
    const newspaperId = req.body.newspaper_id || req.query.newspaper_id;
    const uploadDir = newspaperId 
      ? path.join(UPLOAD_ROOT, String(newspaperId))
      : UPLOAD_ROOT;
      
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = {
    'application/pdf': ['.pdf'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif']
  };
  
  if (allowedTypes[file.mimetype as keyof typeof allowedTypes]) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const ensureUploadDir = () => {
  if (!fs.existsSync(UPLOAD_ROOT)) {
    fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  }
};

const toPublicUploadPath = (absoluteFilePath: string) => {
  const relativePath = path.relative(UPLOAD_ROOT, absoluteFilePath);
  const normalized = relativePath.split(path.sep).join('/');
  return `/uploads/${normalized}`;
};

const persistDataUrlImage = (imageDataUrl: string, subDir?: string) => {
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  const mimeType = match[1].toLowerCase();
  const base64Payload = match[2];
  const extensionByMime: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp'
  };

  const ext = extensionByMime[mimeType];
  if (!ext) return null;

  const targetDir = subDir ? path.join(UPLOAD_ROOT, subDir) : UPLOAD_ROOT;
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const absolutePath = path.join(targetDir, filename);
  fs.writeFileSync(absolutePath, Buffer.from(base64Payload, 'base64'));

  return toPublicUploadPath(absolutePath);
};

// Middleware to check admin role
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    (req as any).user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Input validation helpers
const validateArticle = (data: any) => {
  const { newspaper_id, page_number, title, content, x, y, width, height } = data;
  
  if (!newspaper_id || !title || !content) {
    throw new Error('Missing required fields');
  }
  
  const numFields = { page_number, x, y, width, height };
  for (const [key, value] of Object.entries(numFields)) {
    if (value !== undefined && (isNaN(Number(value)) || Number(value) < 0)) {
      throw new Error(`Invalid ${key}`);
    }
  }
};

// Upload Newspaper
adminRouter.post('/upload', requireAdmin, (req: Request, res: Response) => {
  // Generate ID first so we can use it for subfolder if needed
  const id = uuidv4();
  req.body.newspaper_id = id;

  upload.single('pdf')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer error:', err);
      return res.status(400).json({ error: 'File upload failed: ' + err.message });
    } else if (err) {
      console.error('Upload error:', err);
      return res.status(500).json({ error: 'Upload error occurred: ' + err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title, publication_date } = req.body;
    if (!title || !publication_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Use the real saved path instead of assuming a subfolder structure.
    const pdf_path = toPublicUploadPath(req.file.path);

    try {
      db.prepare('INSERT INTO newspapers (id, title, publication_date, pdf_path, status) VALUES (?, ?, ?, ?, ?)')
        .run(id, title, publication_date, pdf_path, 'draft');
      
      res.json({ id, title, pdf_path });
    } catch (e: any) {
      console.error('DB error:', e);
      res.status(500).json({ error: 'Database operation failed: ' + e.message });
    }
  });
});

// Get all newspapers (admin view)
adminRouter.get('/newspapers', requireAdmin, (req: Request, res: Response) => {
  try {
    const newspapers = db.prepare('SELECT * FROM newspapers ORDER BY publication_date DESC').all();
    res.json(newspapers);
  } catch {
    res.status(500).json({ error: 'Failed to fetch newspapers' });
  }
});

// Get specific newspaper details including articles
adminRouter.get('/newspaper/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    const newspaper = db.prepare('SELECT * FROM newspapers WHERE id = ?').get(id);
    if (!newspaper) return res.status(404).json({ error: 'Newspaper not found' });

    const articles = db.prepare('SELECT * FROM articles WHERE newspaper_id = ?').all(id);
    res.json({ newspaper, articles });
  } catch {
    res.status(500).json({ error: 'Failed to fetch newspaper details' });
  }
});

// Save Article/Region
adminRouter.post('/article', requireAdmin, (req: Request, res: Response) => {
  try {
    validateArticle(req.body);
    const { newspaper_id, page_number, title, content, x, y, width, height, image_path } = req.body;
    const id = uuidv4();
    const resolvedImagePath =
      typeof image_path === 'string' && image_path.startsWith('data:image/')
        ? persistDataUrlImage(image_path, newspaper_id)
        : image_path || null;

    db.prepare(`
      INSERT INTO articles (id, newspaper_id, page_number, title, content, x, y, width, height, image_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, newspaper_id, page_number || 1, title, content, x || 0, y || 0, width || 100, height || 100, resolvedImagePath);

    res.json({ id, status: 'success' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Invalid article data' });
  }
});

// Delete Article
adminRouter.delete('/article/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    const article = db.prepare('SELECT image_path FROM articles WHERE id = ?').get(id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    const result = db.prepare('DELETE FROM articles WHERE id = ?').run(id);
    
    // Clean up associated image file if exists
    if (article.image_path && result.changes > 0) {
      // image_path starts with /uploads/
      const parts = article.image_path.split('/uploads/');
      const relativePath = parts.length > 1 ? parts[1] : article.image_path;
      const fullPath = path.join(UPLOAD_ROOT, relativePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
    
    res.json({ status: 'success' });
  } catch (e: any) {
    console.error('Delete error:', e);
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

// Publish Newspaper
adminRouter.post('/publish/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    const result = db.prepare('UPDATE newspapers SET status = ? WHERE id = ?').run('published', id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Newspaper not found' });
    }
    res.json({ status: 'success' });
  } catch {
    res.status(500).json({ error: 'Failed to publish newspaper' });
  }
});

// Upload article image
adminRouter.post('/article-image', requireAdmin, (req: Request, res: Response) => {
  // newspaper_id should be in query or body
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'File upload failed' });
    } else if (err) {
      return res.status(500).json({ error: 'Upload error occurred' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const image_path = toPublicUploadPath(req.file.path);
    res.json({ image_path });
  });
});
