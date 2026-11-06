/** Grant the admin role to an EXISTING account. There is no default admin and no default password. */
import { loadConfig } from '../config.ts';
import { openDatabase } from '../db.ts';
const email = process.argv[2];
if (!email) {
  console.error('Usage: npm run admin:grant -- someone@example.com');
  process.exit(1);
}
const config = loadConfig();
const db = openDatabase(config.dataDir, config.migrationsDir);
const r = db.prepare(`UPDATE users SET role = 'admin' WHERE email = ?`).run(email);
console.log(r.changes ? `Granted admin role to ${email}.` : `No account found for ${email}. Register it first.`);
db.close();
