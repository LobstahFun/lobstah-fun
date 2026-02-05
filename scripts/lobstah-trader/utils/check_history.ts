import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function findOldTrades(traderAddress: string) {
    const dbPath = path.resolve(__dirname, '../../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    // Check the oldest trade we have
    const oldest = await db.get('SELECT timestamp, DATETIME(timestamp, "unixepoch") as dt FROM trades ORDER BY timestamp ASC LIMIT 1');
    console.log(`Oldest trade in DB: ${oldest?.dt || "None"}`);

    // Count how many markets are currently in our DB
    const markets = await db.get('SELECT COUNT(*) as count FROM markets');
    const resolved = await db.get('SELECT COUNT(*) as count FROM markets WHERE resolved = 1');
    
    console.log(`Markets tracked: ${markets.count} (${resolved.count} resolved)`);

    await db.close();
}

findOldTrades("0x63ce342161250d705dc0b16df89036c8e5f9ba9a");
