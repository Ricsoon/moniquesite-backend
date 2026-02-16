
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'monique_db',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD,
});

async function run() {
    try {
        console.log('Connecting to database...');
        const client = await pool.connect();

        console.log('Checking for missing columns...');

        // Add asaas_customer_id if not exists
        await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='asaas_customer_id') THEN 
          ALTER TABLE users ADD COLUMN asaas_customer_id VARCHAR(255); 
          RAISE NOTICE 'Added asaas_customer_id column';
        ELSE
          RAISE NOTICE 'Column asaas_customer_id already exists';
        END IF;
      END $$;
    `);

        console.log('Migration completed successfully.');

        client.release();
    } catch (err) {
        console.error('Error running migration:', err);
    } finally {
        await pool.end();
    }
}

run();
