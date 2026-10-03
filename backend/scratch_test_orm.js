import { db } from './dist/prisma/db.js';

async function main() {
  const users = await db.orm.public.User.all();
  console.log('All Users:', users.map(u => ({ id: u.id, username: u.username, email: u.email })));
  const msgs = await db.orm.public.Message.all();
  console.log('Total messages:', msgs.length);
}

main().catch(console.error);
