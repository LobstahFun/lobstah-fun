import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function clearMapping() {
    const dbPath = path.resolve(__dirname, '../../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log("🧹 Clearing old market mappings for re-resolution...");
    await db.run("UPDATE trades SET market_condition_id = NULL");
    await db.run("DELETE FROM markets");
    
    await db.close();
    console.log("✅ Ready for fresh Token-First sync.");
}

clearMapping();
