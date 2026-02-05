import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkRange() {
    const dbPath = path.resolve(__dirname, '../../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    const stats = await db.get(`
        SELECT 
            MIN(timestamp) as oldest_ts,
            MAX(timestamp) as newest_ts,
            DATETIME(MIN(timestamp), 'unixepoch') as oldest_date,
            DATETIME(MAX(timestamp), 'unixepoch') as newest_date,
            COUNT(*) as total_trades
        FROM trades
    `);

    console.log("--- WAREHOUSE RANGE AUDIT ---");
    console.log(JSON.stringify(stats, null, 2));

    await db.close();
}

checkRange();
