import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkResolvedStats() {
    const dbPath = path.resolve(__dirname, '../../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    const totalTrades = await db.get('SELECT COUNT(*) as count FROM trades');
    const resolvedMarkets = await db.all('SELECT condition_id, question, resolved FROM markets WHERE resolved = 1');
    const totalMarkets = await db.get('SELECT COUNT(*) as count FROM markets');

    console.log(`Total Trades in DB: ${totalTrades.count}`);
    console.log(`Total Markets in DB: ${totalMarkets.count}`);
    console.log(`Resolved Markets found: ${resolvedMarkets.length}`);
    
    if (resolvedMarkets.length > 0) {
        console.log("Sample Resolved Market:", resolvedMarkets[0].question);
    }

    const linkedTrades = await db.get('SELECT COUNT(*) as count FROM trades WHERE market_condition_id IN (SELECT condition_id FROM markets WHERE resolved = 1)');
    console.log(`Trades linked to resolved markets: ${linkedTrades.count}`);

    await db.close();
}

checkResolvedStats();
