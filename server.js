const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./db');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Setup directories for uploads
const storageDir = path.join(__dirname, 'public', 'storage', 'uploads');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

// Multer Disk Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, storageDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Serve static assets from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API Endpoint to get Slides
app.get('/api/slides', async (req, res) => {
  const queryText = req.query.q;
  try {
    if (!queryText || queryText.trim() === '') {
      const result = await db.query('SELECT * FROM slides ORDER BY id ASC');
      return res.json(result.rows);
    }
    const searchSQL = `
      SELECT *, 
        ts_rank(
          to_tsvector('english', coalesce(title, '') || ' ' || coalesce(keywords, '') || ' ' || coalesce(description, '')), 
          plainto_tsquery('english', $1)
        ) as rank
      FROM slides
      WHERE to_tsvector('english', coalesce(title, '') || ' ' || coalesce(keywords, '') || ' ' || coalesce(description, '')) @@ plainto_tsquery('english', $1)
      ORDER BY rank DESC, id ASC;
    `;
    const result = await db.query(searchSQL, [queryText.trim()]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching slides:', err);
    res.status(500).json({ error: 'An error occurred while querying slides' });
  }
});

// API Endpoint to get Icons
app.get('/api/icons', async (req, res) => {
  const queryText = req.query.q;
  try {
    if (!queryText || queryText.trim() === '') {
      const result = await db.query('SELECT * FROM icons ORDER BY id ASC');
      return res.json(result.rows);
    }
    const searchSQL = `
      SELECT *, 
        ts_rank(
          to_tsvector('english', coalesce(name, '') || ' ' || coalesce(keywords, '') || ' ' || coalesce(description, '')), 
          plainto_tsquery('english', $1)
        ) as rank
      FROM icons
      WHERE to_tsvector('english', coalesce(name, '') || ' ' || coalesce(keywords, '') || ' ' || coalesce(description, '')) @@ plainto_tsquery('english', $1)
      ORDER BY rank DESC, id ASC;
    `;
    const result = await db.query(searchSQL, [queryText.trim()]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching icons:', err);
    res.status(500).json({ error: 'An error occurred while querying icons' });
  }
});

// API Endpoint to get Scientific Images
app.get('/api/scientific_images', async (req, res) => {
  const queryText = req.query.q;
  try {
    if (!queryText || queryText.trim() === '') {
      const result = await db.query('SELECT * FROM scientific_images ORDER BY id ASC');
      return res.json(result.rows);
    }
    const searchSQL = `
      SELECT *, 
        ts_rank(
          to_tsvector('english', coalesce(title, '') || ' ' || coalesce(keywords, '') || ' ' || coalesce(description, '')), 
          plainto_tsquery('english', $1)
        ) as rank
      FROM scientific_images
      WHERE to_tsvector('english', coalesce(title, '') || ' ' || coalesce(keywords, '') || ' ' || coalesce(description, '')) @@ plainto_tsquery('english', $1)
      ORDER BY rank DESC, id ASC;
    `;
    const result = await db.query(searchSQL, [queryText.trim()]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching scientific images:', err);
    res.status(500).json({ error: 'An error occurred while querying scientific images' });
  }
});

// API Endpoint to setup the database internally
app.get('/api/setup', async (req, res) => {
  try {
    // Create slides table
    await db.query(`
      CREATE TABLE IF NOT EXISTS slides (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        state VARCHAR(100) NOT NULL,
        slide_type VARCHAR(100) NOT NULL,
        keywords TEXT NOT NULL,
        description TEXT NOT NULL,
        preview_image_url VARCHAR(255) NOT NULL,
        pptx_file_url VARCHAR(255) NOT NULL
      );
    `);
    
    // Create icons table
    await db.query(`
      CREATE TABLE IF NOT EXISTS icons (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        keywords TEXT NOT NULL,
        icon_class VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        file_url VARCHAR(255) NOT NULL
      );
    `);

    // Create scientific_images table
    await db.query(`
      CREATE TABLE IF NOT EXISTS scientific_images (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        keywords TEXT NOT NULL,
        description TEXT NOT NULL,
        preview_image_url VARCHAR(255) NOT NULL,
        file_url VARCHAR(255) NOT NULL
      );
    `);

    res.send('Database setup completed successfully! You can now use the app.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error setting up database: ' + err.message);
  }
});

// API Endpoint to add new resources to tables dynamically with Multer file upload support
app.post('/api/resources', upload.single('file'), async (req, res) => {
  const { type, title, keywords } = req.body;
  const file = req.file;
  
  if (!type || !title || !keywords || !file) {
    return res.status(400).json({ error: 'Missing required parameters (type, title, keywords, or file)' });
  }

  // Set file URL path relative to server public root
  const relativeFileUrl = `/storage/uploads/${file.filename}`;

  try {
    if (type === 'templates' || type === 'charts' || type === 'maps') {
      let slideType = 'title';
      let previewUrl = '/storage/previews/california_map_preview.png'; // Default slide preview

      if (type === 'charts') {
        slideType = '3-pointer';
        previewUrl = '/storage/previews/financial_performance_preview.png';
      } else if (type === 'maps') {
        slideType = 'map';
        previewUrl = '/storage/previews/california_map_preview.png';
      }

      const query = `
        INSERT INTO slides (title, state, slide_type, keywords, description, preview_image_url, pptx_file_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `;
      const values = [
        title,
        'National', // Default State since removed from form
        slideType,
        keywords,
        'Custom uploaded PowerPoint presentation slide template.', // Default description text
        previewUrl,
        relativeFileUrl // Local path of uploaded slide file
      ];

      const result = await db.query(query, values);
      console.log('Successfully inserted slide resource:', result.rows[0].title);
      return res.status(201).json({ success: true, data: result.rows[0] });

    } else if (type === 'icons') {
      const query = `
        INSERT INTO icons (name, keywords, icon_class, description, file_url)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;
      const values = [
        title,
        keywords,
        'fa-solid fa-shapes',
        'Custom uploaded vector icon.',
        relativeFileUrl // Local path of uploaded SVG icon file
      ];

      const result = await db.query(query, values);
      console.log('Successfully inserted icon resource:', result.rows[0].name);
      return res.status(201).json({ success: true, data: result.rows[0] });

    } else if (type === 'scientific') {
      const query = `
        INSERT INTO scientific_images (title, keywords, description, preview_image_url, file_url)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;
      const values = [
        title,
        keywords,
        'Custom uploaded scientific diagram.',
        relativeFileUrl, // Uploaded PNG/JPG image file is used for both preview
        relativeFileUrl  // and download URLs
      ];

      const result = await db.query(query, values);
      console.log('Successfully inserted scientific resource:', result.rows[0].title);
      return res.status(201).json({ success: true, data: result.rows[0] });

    } else {
      return res.status(400).json({ error: 'Invalid resource type' });
    }
  } catch (err) {
    console.error('Error adding new resource to database:', err);
    res.status(500).json({ error: 'Database write operation failed' });
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
