const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./db');
const AdmZip = require('adm-zip');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Use memory storage — files are saved into PostgreSQL as BYTEAs, NOT the disk.
// This ensures uploaded resources survive all Render deployments permanently.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Helper to extract thumbnail from PPTX buffer using adm-zip (in-memory, no disk)
function getPptxPreviewBuffer(pptxBuffer) {
  try {
    const zip = new AdmZip(pptxBuffer);
    const zipEntries = zip.getEntries();
    
    const thumbnailEntry = zipEntries.find(entry => 
      entry.entryName.toLowerCase() === 'docprops/thumbnail.jpeg' ||
      entry.entryName.toLowerCase() === 'docprops/thumbnail.jpg' ||
      entry.entryName.toLowerCase() === 'docprops/thumbnail.png'
    );
    
    if (thumbnailEntry) {
      const ext = path.extname(thumbnailEntry.entryName).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
      const thumbBuffer = thumbnailEntry.getData();
      return { buffer: thumbBuffer, mimeType };
    }
  } catch (err) {
    console.error('Error extracting PPTX thumbnail:', err.message);
  }
  return null;
}

// Serve static assets from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Serve uploaded files from PostgreSQL (database-stored, survives all Render deployments)
app.get('/api/files/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT filename, mimetype, data FROM file_blobs WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).send('File not found');
    const { filename, mimetype, data } = result.rows[0];
    res.set('Content-Type', mimetype);
    res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(data);
  } catch (err) {
    console.error('Error serving file from DB:', err);
    res.status(500).send('Error retrieving file');
  }
});

// Serve preview images from PostgreSQL
app.get('/api/previews/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT filename, mimetype, data FROM file_blobs WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).send('Preview not found');
    const { mimetype, data } = result.rows[0];
    res.set('Content-Type', mimetype || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(data);
  } catch (err) {
    console.error('Error serving preview from DB:', err);
    res.status(500).send('Error retrieving preview');
  }
});

// API Endpoint for User Authentication
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const trimmedPassword = password.trim();
  
  // Make password validation extremely lenient for the demo
  const pass = trimmedPassword.toLowerCase().replace('!', '');

  if (normalizedEmail.includes('admin') && pass.includes('admin')) {
    return res.json({
      success: true,
      user: {
        email: 'admin@slidelibrary.com',
        name: 'Admin User',
        initials: 'AU'
      }
    });
  } else if (normalizedEmail.includes('editor') && pass.includes('editor')) {
    return res.json({
      success: true,
      user: {
        email: 'editor@slidelibrary.com',
        name: 'Editor User',
        initials: 'EU'
      }
    });
  } else {
    return res.status(401).json({ error: 'Wrong email or password' });
  }
});

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

// API Endpoint for Global Search across ALL tables (slides, icons, scientific_images)
app.get('/api/search', async (req, res) => {
  const queryText = req.query.q;
  if (!queryText || queryText.trim() === '') {
    return res.json([]);
  }

  try {
    const q = queryText.trim();

    const searchSlidesSQL = `
      SELECT id, title, state, slide_type, keywords, description, preview_image_url, pptx_file_url, 'slides' AS _table,
        ts_rank(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(keywords,'') || ' ' || coalesce(description,'')),
          plainto_tsquery('english', $1)) AS rank
      FROM slides
      WHERE to_tsvector('english', coalesce(title,'') || ' ' || coalesce(keywords,'') || ' ' || coalesce(description,''))
        @@ plainto_tsquery('english', $1);
    `;

    const searchIconsSQL = `
      SELECT id, name AS title, '' AS state, 'icon' AS slide_type, keywords, description, file_url AS preview_image_url, file_url AS pptx_file_url, 'icons' AS _table,
        ts_rank(to_tsvector('english', coalesce(name,'') || ' ' || coalesce(keywords,'') || ' ' || coalesce(description,'')),
          plainto_tsquery('english', $1)) AS rank
      FROM icons
      WHERE to_tsvector('english', coalesce(name,'') || ' ' || coalesce(keywords,'') || ' ' || coalesce(description,''))
        @@ plainto_tsquery('english', $1);
    `;

    const searchSciSQL = `
      SELECT id, title, '' AS state, 'scientific' AS slide_type, keywords, description, preview_image_url, file_url AS pptx_file_url, 'scientific_images' AS _table,
        ts_rank(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(keywords,'') || ' ' || coalesce(description,'')),
          plainto_tsquery('english', $1)) AS rank
      FROM scientific_images
      WHERE to_tsvector('english', coalesce(title,'') || ' ' || coalesce(keywords,'') || ' ' || coalesce(description,''))
        @@ plainto_tsquery('english', $1);
    `;

    const [slidesRes, iconsRes, sciRes] = await Promise.all([
      db.query(searchSlidesSQL, [q]),
      db.query(searchIconsSQL, [q]),
      db.query(searchSciSQL, [q])
    ]);

    const combined = [
      ...slidesRes.rows,
      ...iconsRes.rows,
      ...sciRes.rows
    ].sort((a, b) => b.rank - a.rank);

    res.json(combined);
  } catch (err) {
    console.error('Error in global search:', err);
    res.status(500).json({ error: 'An error occurred during global search' });
  }
});

// API Endpoint to setup the database internally
app.get('/api/setup', async (req, res) => {
  const forceReseed = req.query.force === 'true';
  try {
    // Create file_blobs table — stores all uploaded files as binary data in PostgreSQL
    // This is the key to making uploads survive all Render deployments permanently
    await db.query(`
      CREATE TABLE IF NOT EXISTS file_blobs (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(512) NOT NULL,
        mimetype VARCHAR(128) NOT NULL,
        data BYTEA NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

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

    if (forceReseed) {
      await db.query('TRUNCATE TABLE slides RESTART IDENTITY CASCADE;');
      await db.query('TRUNCATE TABLE icons RESTART IDENTITY CASCADE;');
      await db.query('TRUNCATE TABLE scientific_images RESTART IDENTITY CASCADE;');
      console.log('Tables truncated due to force reseed.');
    }

    // Seed slides if empty
    const slideCount = await db.query('SELECT COUNT(*) FROM slides;');
    if (parseInt(slideCount.rows[0].count) === 0) {
      const seedSlides = `
        INSERT INTO slides (title, state, slide_type, keywords, description, preview_image_url, pptx_file_url)
        VALUES 
        (
          'California Geographic Market Segmentation Map', 
          'California', 
          'map', 
          'california, map, geography, market, segmentation, west-coast', 
          'A detailed geographical map of California showing key market segments, regional demographics, and growth hubs for Q3 strategy planning.',
          '/storage/previews/california_map_preview.png',
          '/storage/slides/california_map.pptx'
        ),
        (
          'Q3 Financial Performance Summary', 
          'Texas', 
          '3-pointer', 
          'texas, metrics, finance, quarterly, revenue, 3-pointer', 
          'Three key takeaways highlighting Texas region revenue growth, operational cost reductions, and profit margins for the third quarter.',
          '/storage/previews/financial_performance_preview.png',
          '/storage/slides/q3_financial_summary.pptx'
        ),
        (
          'Strategic Multi-State Expansion Guidelines', 
          'National', 
          'guidelines', 
          'guidelines, strategy, expansion, national, policy, execution', 
          'Step-by-step guidelines for deploying operations across new state borders, focusing on compliance, logistics, and regional leadership onboarding.',
          '/storage/previews/expansion_guidelines_preview.png',
          '/storage/slides/expansion_guidelines.pptx'
        ),
        (
          'Modern Corporate Pitch Deck Template', 
          'National', 
          'title', 
          'template, pitch deck, corporate, presentation, business', 
          'A clean, modern corporate pitch deck slide template with customizable text boxes, grids, and premium formatting.',
          '/storage/previews/california_map_preview.png',
          '/storage/slides/california_map.pptx'
        );
      `;
      await db.query(seedSlides);
      console.log('Seeded "slides" table.');
    }

    // Seed icons if empty
    const iconCount = await db.query('SELECT COUNT(*) FROM icons;');
    if (parseInt(iconCount.rows[0].count) === 0) {
      const seedIcons = `
        INSERT INTO icons (name, keywords, icon_class, description, file_url)
        VALUES
        (
          'Growth Chart Icon',
          'growth, chart, bar, metrics, business, trend',
          'fa-solid fa-chart-column',
          'Jira styled professional growth chart vector icon representing positive trends and business metrics.',
          '/storage/icons/growth_chart.svg'
        ),
        (
          'DNA Helix Icon',
          'dna, biology, science, medical, helix, health',
          'fa-solid fa-dna',
          'Medical and biological vector icon illustrating the double-helix DNA sequence for medical diagnostics.',
          '/storage/icons/dna.svg'
        ),
        (
          'Global Network Icon',
          'global, network, world, cloud, tech, internet',
          'fa-solid fa-earth-americas',
          'Corporate global network mapping vector icon representing servers, tech connectivity, and international routing.',
          '/storage/icons/global_network.svg'
        );
      `;
      await db.query(seedIcons);
      console.log('Seeded "icons" table.');
    }

    // Seed scientific images if empty
    const sciCount = await db.query('SELECT COUNT(*) FROM scientific_images;');
    if (parseInt(sciCount.rows[0].count) === 0) {
      const seedSciImages = `
        INSERT INTO scientific_images (title, keywords, description, preview_image_url, file_url)
        VALUES
        (
          'Anatomy of a Human Cell',
          'cell, biology, anatomy, human, science, nucleus, mitochondria',
          'Detailed high-resolution educational scientific diagram mapping human cell structures, organelles, membranes, and golgi bodies.',
          '/storage/scientific/human_cell.png',
          '/storage/scientific/human_cell.png'
        ),
        (
          'Planetary Orbits of Our Solar System',
          'solar system, planet, space, astronomy, science, orbits, sun',
          'Educational planetary orbit diagram tracing paths, astronomical distances, planetary sizing, and the main asteroid belt.',
          '/storage/scientific/solar_system.png',
          '/storage/scientific/solar_system.png'
        ),
        (
          'Brain Neural Networks & Synaptic Connections',
          'brain, neuron, synapse, neuroscience, science, cognition, pathways',
          'Neuroscience infographic detailing the structure of synaptic gaps, axonal neurotransmitters, action potentials, and cerebral network pathways.',
          '/storage/scientific/brain_neural.png',
          '/storage/scientific/brain_neural.png'
        );
      `;
      await db.query(seedSciImages);
      console.log('Seeded "scientific_images" table.');
    }

    res.send('Database setup and seeding completed successfully! You can now use the app.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error setting up database: ' + err.message);
  }
});

// API Endpoint to add new resources — files stored in PostgreSQL, not on disk
app.post('/api/resources', upload.array('files', 50), async (req, res) => {
  const { type, title, keywords } = req.body;
  const files = req.files;

  if (!type || !title || !keywords || !files || files.length === 0) {
    return res.status(400).json({ error: 'Missing required parameters (type, title, keywords, or files)' });
  }

  const insertedResources = [];

  try {
    for (const file of files) {
      const fileExt = path.extname(file.originalname).toLowerCase();
      const mimeType = file.mimetype || 'application/octet-stream';

      if (type === 'templates' || type === 'charts' || type === 'maps') {
        // Block image uploads to slide groups
        if (['.png', '.jpg', '.jpeg', '.svg'].includes(fileExt)) {
          return res.status(400).json({ error: 'You cannot upload images in this group. Please change the format to PPTX and then upload.' });
        }

        // Save the main PPTX file into file_blobs
        const blobResult = await db.query(
          'INSERT INTO file_blobs (filename, mimetype, data) VALUES ($1, $2, $3) RETURNING id',
          [file.originalname, mimeType, file.buffer]
        );
        const fileId = blobResult.rows[0].id;
        const fileUrl = `/api/files/${fileId}`;

        // Try to extract thumbnail from PPTX buffer and store it too
        let previewUrl = 'https://placehold.co/600x338/1e293b/94a3b8?text=Slide+Preview';
        if (fileExt === '.pptx') {
          const preview = getPptxPreviewBuffer(file.buffer);
          if (preview) {
            const previewBlob = await db.query(
              'INSERT INTO file_blobs (filename, mimetype, data) VALUES ($1, $2, $3) RETURNING id',
              [`preview-${file.originalname}.jpg`, preview.mimeType, preview.buffer]
            );
            previewUrl = `/api/previews/${previewBlob.rows[0].id}`;
          }
        }

        let slideType = 'title';
        if (type === 'charts') slideType = '3-pointer';
        else if (type === 'maps') slideType = 'map';

        const result = await db.query(
          `INSERT INTO slides (title, state, slide_type, keywords, description, preview_image_url, pptx_file_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;`,
          [title, 'National', slideType, keywords, 'Custom uploaded PowerPoint presentation slide template.', previewUrl, fileUrl]
        );
        console.log('Successfully inserted slide resource:', result.rows[0].title);
        insertedResources.push(result.rows[0]);

      } else if (type === 'icons') {
        const blobResult = await db.query(
          'INSERT INTO file_blobs (filename, mimetype, data) VALUES ($1, $2, $3) RETURNING id',
          [file.originalname, mimeType, file.buffer]
        );
        const fileId = blobResult.rows[0].id;
        const fileUrl = `/api/files/${fileId}`;

        const result = await db.query(
          `INSERT INTO icons (name, keywords, icon_class, description, file_url)
           VALUES ($1, $2, $3, $4, $5) RETURNING *;`,
          [title, keywords, 'fa-solid fa-shapes', 'Custom uploaded vector icon.', fileUrl]
        );
        console.log('Successfully inserted icon resource:', result.rows[0].name);
        insertedResources.push(result.rows[0]);

      } else if (type === 'scientific') {
        // Store the image file in file_blobs
        const blobResult = await db.query(
          'INSERT INTO file_blobs (filename, mimetype, data) VALUES ($1, $2, $3) RETURNING id',
          [file.originalname, mimeType, file.buffer]
        );
        const fileId = blobResult.rows[0].id;
        const fileUrl = `/api/files/${fileId}`;
        const previewUrl = `/api/previews/${fileId}`;

        const result = await db.query(
          `INSERT INTO scientific_images (title, keywords, description, preview_image_url, file_url)
           VALUES ($1, $2, $3, $4, $5) RETURNING *;`,
          [title, keywords, 'Custom uploaded scientific diagram.', previewUrl, fileUrl]
        );
        console.log('Successfully inserted scientific resource:', result.rows[0].title);
        insertedResources.push(result.rows[0]);
      }
    }

    return res.status(201).json({ success: true, data: insertedResources });
  } catch (err) {
    console.error('Error adding new resource to database:', err);
    res.status(500).json({ error: 'Database write operation failed' });
  }
});


// DELETE /api/resources/:type/:id
app.delete('/api/resources/:type/:id', async (req, res) => {
  const { type, id } = req.params;

  let tableName = '';
  if (type === 'templates' || type === 'charts' || type === 'maps') {
    tableName = 'slides';
  } else if (type === 'icons') {
    tableName = 'icons';
  } else if (type === 'scientific') {
    tableName = 'scientific_images';
  } else {
    return res.status(400).json({ error: 'Invalid resource type' });
  }

  try {
    const query = `DELETE FROM ${tableName} WHERE id = $1 RETURNING *;`;
    const result = await db.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    console.log(`Successfully deleted resource ID ${id} from table ${tableName}`);
    res.json({ success: true, message: 'Resource deleted successfully' });
  } catch (err) {
    console.error('Error deleting resource from database:', err);
    res.status(500).json({ error: 'Database delete operation failed' });
  }
});

// PUT /api/resources/:type/:id
app.put('/api/resources/:type/:id', async (req, res) => {
  const { type: oldType, id } = req.params;
  const { type: newType, title, keywords } = req.body;

  if (!newType || !title || !keywords) {
    return res.status(400).json({ error: 'Missing required update parameters' });
  }

  const oldIsSlide = (oldType === 'templates' || oldType === 'charts' || oldType === 'maps');
  const newIsSlide = (newType === 'templates' || newType === 'charts' || newType === 'maps');

  const oldTable = oldIsSlide ? 'slides' : (oldType === 'icons' ? 'icons' : 'scientific_images');
  const newTable = newIsSlide ? 'slides' : (newType === 'icons' ? 'icons' : 'scientific_images');

  try {
    if (oldTable === newTable) {
      // 1. Same table update
      let result;
      if (oldTable === 'slides') {
        const slideType = newType === 'charts' ? '3-pointer' : (newType === 'maps' ? 'map' : 'title');
        const query = `
          UPDATE slides 
          SET title = $1, keywords = $2, slide_type = $3
          WHERE id = $4
          RETURNING *;
        `;
        result = await db.query(query, [title, keywords, slideType, id]);
      } else if (oldTable === 'icons') {
        const query = `
          UPDATE icons 
          SET name = $1, keywords = $2
          WHERE id = $3
          RETURNING *;
        `;
        result = await db.query(query, [title, keywords, id]);
      } else {
        const query = `
          UPDATE scientific_images 
          SET title = $1, keywords = $2
          WHERE id = $3
          RETURNING *;
        `;
        result = await db.query(query, [title, keywords, id]);
      }

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Resource not found' });
      }

      console.log(`Successfully updated resource ID ${id} in table ${oldTable}`);
      return res.json({ success: true, data: result.rows[0] });

    } else {
      // 2. Different table update (Migration required)
      // First, fetch the old record to extract URLs
      const oldSelectQuery = `SELECT * FROM ${oldTable} WHERE id = $1;`;
      const oldRecordRes = await db.query(oldSelectQuery, [id]);

      if (oldRecordRes.rowCount === 0) {
        return res.status(404).json({ error: 'Resource not found' });
      }

      const oldRecord = oldRecordRes.rows[0];
      
      // Determine source file URLs
      let fileUrl = '';
      if (oldTable === 'slides') {
        fileUrl = oldRecord.pptx_file_url;
      } else if (oldTable === 'icons') {
        fileUrl = oldRecord.file_url;
      } else {
        fileUrl = oldRecord.file_url;
      }

      let insertedRecord;

      if (newTable === 'slides') {
        const slideType = newType === 'charts' ? '3-pointer' : (newType === 'maps' ? 'map' : 'title');
        let previewUrl = '/storage/previews/california_map_preview.png';
        if (newType === 'charts') {
          previewUrl = '/storage/previews/financial_performance_preview.png';
        }

        // Try extracting preview from PPTX or use file directly if it is an image
        const fileExt = path.extname(fileUrl).toLowerCase();
        if (fileExt === '.pptx') {
          const physicalPath = path.join(__dirname, 'public', fileUrl);
          const extractedPreview = getPptxPreview(physicalPath);
          if (extractedPreview) {
            previewUrl = extractedPreview;
          }
        } else if (['.png', '.jpg', '.jpeg', '.svg'].includes(fileExt)) {
          previewUrl = fileUrl;
        }

        const insertQuery = `
          INSERT INTO slides (title, state, slide_type, keywords, description, preview_image_url, pptx_file_url)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *;
        `;
        const values = [
          title,
          'National',
          slideType,
          keywords,
          'Custom migrated PowerPoint presentation slide template.',
          previewUrl,
          fileUrl
        ];
        const insertRes = await db.query(insertQuery, values);
        insertedRecord = insertRes.rows[0];

      } else if (newTable === 'icons') {
        const insertQuery = `
          INSERT INTO icons (name, keywords, icon_class, description, file_url)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *;
        `;
        const values = [
          title,
          keywords,
          'fa-solid fa-shapes',
          'Custom migrated vector icon.',
          fileUrl
        ];
        const insertRes = await db.query(insertQuery, values);
        insertedRecord = insertRes.rows[0];

      } else if (newTable === 'scientific_images') {
        const insertQuery = `
          INSERT INTO scientific_images (title, keywords, description, preview_image_url, file_url)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *;
        `;
        const values = [
          title,
          keywords,
          'Custom migrated scientific diagram.',
          fileUrl, // Use the same file URL for preview
          fileUrl
        ];
        const insertRes = await db.query(insertQuery, values);
        insertedRecord = insertRes.rows[0];
      }

      // After successful insertion into new table, delete from the old table
      const deleteQuery = `DELETE FROM ${oldTable} WHERE id = $1;`;
      await db.query(deleteQuery, [id]);

      console.log(`Successfully migrated resource ID ${id} from ${oldTable} to ${newTable}`);
      return res.json({ success: true, data: insertedRecord });
    }
  } catch (err) {
    console.error('Error during resource update/migration:', err);
    res.status(500).json({ error: 'Database write operation failed' });
  }
});

// POST /api/resources/bulk-delete
app.post('/api/resources/bulk-delete', async (req, res) => {
  const { resources } = req.body;
  if (!resources || !Array.isArray(resources) || resources.length === 0) {
    return res.status(400).json({ error: 'No resources provided for deletion' });
  }

  try {
    await db.query('BEGIN');
    for (const item of resources) {
      let tableName = '';
      if (item.type === 'templates' || item.type === 'charts' || item.type === 'maps') {
        tableName = 'slides';
      } else if (item.type === 'icons') {
        tableName = 'icons';
      } else if (item.type === 'scientific') {
        tableName = 'scientific_images';
      } else {
        throw new Error(`Invalid resource type: ${item.type}`);
      }
      await db.query(`DELETE FROM ${tableName} WHERE id = $1`, [item.id]);
    }
    await db.query('COMMIT');
    res.json({ success: true, message: `Successfully deleted ${resources.length} resources.` });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Error during bulk delete:', err);
    res.status(500).json({ error: 'Database bulk delete operation failed' });
  }
});

// POST /api/resources/bulk-move
app.post('/api/resources/bulk-move', async (req, res) => {
  const { targetType, resources } = req.body;
  if (!targetType || !resources || !Array.isArray(resources) || resources.length === 0) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const newIsSlide = (targetType === 'templates' || targetType === 'charts' || targetType === 'maps');
  const newTable = newIsSlide ? 'slides' : (targetType === 'icons' ? 'icons' : 'scientific_images');

  try {
    await db.query('BEGIN');

    for (const item of resources) {
      const oldIsSlide = (item.type === 'templates' || item.type === 'charts' || item.type === 'maps');
      const oldTable = oldIsSlide ? 'slides' : (item.type === 'icons' ? 'icons' : 'scientific_images');

      if (oldTable === newTable) {
        // Simple update
        if (oldTable === 'slides') {
          const slideType = targetType === 'charts' ? '3-pointer' : (targetType === 'maps' ? 'map' : 'title');
          await db.query('UPDATE slides SET slide_type = $1 WHERE id = $2', [slideType, item.id]);
        }
        // If moving icons to icons or scientific to scientific, nothing changes
      } else {
        // Migration required
        const oldSelect = await db.query(`SELECT * FROM ${oldTable} WHERE id = $1`, [item.id]);
        if (oldSelect.rowCount > 0) {
          const record = oldSelect.rows[0];
          let fileUrl = '';
          if (oldTable === 'slides') {
            fileUrl = record.pptx_file_url;
          } else {
            fileUrl = record.file_url;
          }

          if (newTable === 'slides') {
            const slideType = targetType === 'charts' ? '3-pointer' : (targetType === 'maps' ? 'map' : 'title');
            let previewUrl = '/storage/previews/california_map_preview.png';
            if (targetType === 'charts') {
              previewUrl = '/storage/previews/financial_performance_preview.png';
            }
            const fileExt = path.extname(fileUrl).toLowerCase();
            if (['.png', '.jpg', '.jpeg', '.svg'].includes(fileExt)) {
              previewUrl = fileUrl;
            } else if (fileExt === '.pptx') {
              const physicalPath = path.join(__dirname, 'public', fileUrl);
              const extractedPreview = getPptxPreview(physicalPath);
              if (extractedPreview) {
                previewUrl = extractedPreview;
              }
            }

            await db.query(
              `INSERT INTO slides (title, state, slide_type, keywords, description, preview_image_url, pptx_file_url)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [record.title || record.name, 'National', slideType, record.keywords, record.description || 'Custom migrated slide.', previewUrl, fileUrl]
            );
          } else if (newTable === 'icons') {
            await db.query(
              `INSERT INTO icons (name, keywords, icon_class, description, file_url)
               VALUES ($1, $2, $3, $4, $5)`,
              [record.title || record.name, record.keywords, 'fa-solid fa-shapes', record.description || 'Custom migrated icon.', fileUrl]
            );
          } else if (newTable === 'scientific_images') {
            await db.query(
              `INSERT INTO scientific_images (title, keywords, description, preview_image_url, file_url)
               VALUES ($1, $2, $3, $4, $5)`,
              [record.title || record.name, record.keywords, record.description || 'Custom migrated scientific diagram.', fileUrl, fileUrl]
            );
          }

          // Delete from old table
          await db.query(`DELETE FROM ${oldTable} WHERE id = $1`, [item.id]);
        }
      }
    }

    await db.query('COMMIT');
    res.json({ success: true, message: `Successfully moved ${resources.length} resources to ${targetType}.` });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Error during bulk move:', err);
    res.status(500).json({ error: 'Database bulk move operation failed' });
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
