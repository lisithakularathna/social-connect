import pg from 'pg';
const { Client } = pg;

async function main() {
  const client = new Client({
    connectionString: 'postgresql://socialuser:socialpassword@localhost:5433/socialconnect'
  });
  await client.connect();
  const res = await client.query(`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_schema NOT IN ('information_schema', 'pg_catalog');
  `);
  console.log('Tables:', res.rows);
  await client.end();
}

main().catch(console.error);
