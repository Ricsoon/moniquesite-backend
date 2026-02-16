
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

        // Add cpf_cnpj if not exists
        await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='cpf_cnpj') THEN 
          ALTER TABLE users ADD COLUMN cpf_cnpj VARCHAR(20); 
          RAISE NOTICE 'Added cpf_cnpj column';
        ELSE
          RAISE NOTICE 'Column cpf_cnpj already exists';
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
