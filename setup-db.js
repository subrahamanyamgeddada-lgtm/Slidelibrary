const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const baseUrl = dbUrl.substring(0, dbUrl.lastIndexOf('/'));
  const defaultDbUrl = `${baseUrl}/postgres`;

  // 1. Create database if it does not exist
  console.log('Connecting to default postgres database to verify/create database "slide_library"...');
  let client = new Client({ connectionString: defaultDbUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'slide_library'");
    if (res.rowCount === 0) {
      await client.query("CREATE DATABASE slide_library");
      console.log('Database "slide_library" created successfully.');
    } else {
      console.log('Database "slide_library" already exists.');
    }
  } catch (err) {
    console.error('Error during database check/creation:', err.message);
  } finally {
    await client.end();
  }

  // 2. Connect to slide_library database
  console.log('Connecting to "slide_library" database to build schema and seed...');
  client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();

    // Create slides table
    await client.query(`
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
    await client.query(`
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
    await client.query(`
      CREATE TABLE IF NOT EXISTS scientific_images (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        keywords TEXT NOT NULL,
        description TEXT NOT NULL,
        preview_image_url VARCHAR(255) NOT NULL,
        file_url VARCHAR(255) NOT NULL
      );
    `);

    console.log('Database tables verified/created successfully.');

    // Truncate tables to ensure fresh seeds
    await client.query('TRUNCATE TABLE slides RESTART IDENTITY CASCADE;');
    await client.query('TRUNCATE TABLE icons RESTART IDENTITY CASCADE;');
    await client.query('TRUNCATE TABLE scientific_images RESTART IDENTITY CASCADE;');
    console.log('Tables truncated.');

    // Seed slides
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
    await client.query(seedSlides);
    console.log('Seeded "slides" table.');

    // Seed icons
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
    await client.query(seedIcons);
    console.log('Seeded "icons" table.');

    // Seed scientific images
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
    await client.query(seedSciImages);
    console.log('Seeded "scientific_images" table.');

    console.log('All schema setup and seeding completed successfully!');
  } catch (err) {
    console.error('Error during schema building/seeding:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
