require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL is not set in .env file');
  console.error('Please create a .env file with: DATABASE_URL=postgresql://username:password@localhost:5432/inventory_db');
  process.exit(1);
}

module.exports = {
  schema: './db/schema.js',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL,
  },
};

