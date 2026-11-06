import { loadConfig } from '../config.ts';
import { openDatabase, migrate } from '../db.ts';
const config = loadConfig();
const db = openDatabase(config.dataDir, config.migrationsDir);
console.log('Applied migrations:', migrate(db, config.migrationsDir).join(', ') || '(already up to date)');
db.close();
