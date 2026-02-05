import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function findPotentialResolutions() {
    const dbPath = path.resolve(__dirname, '../../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    const marketList = await db.all(`
        SELECT 
            m.condition_id, 
            m.question,
            t.timestamp,
            DATETIME(t.timestamp, 'unixepoch') as trade_time
        FROM markets m
        JOIN trades t ON m.condition_id = t.market_condition_id
        GROUP BY m.condition_id
        ORDER BY t.timestamp ASC
        LIMIT 20
    `);

    console.log("--- OLDEST MARKETS IN DB ---");
    console.table(marketList);

    await db.close();
}

findPotentialResolutions();
