import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function inspectRedemptions() {
    const dbPath = path.resolve(__dirname, '../../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log("🧐 Deep Inspection of Redemptions...");

    const sample = await db.all(`
        SELECT amount, condition_id, DATETIME(timestamp, 'unixepoch') as date
        FROM payouts 
        ORDER BY amount DESC 
        LIMIT 10
    `);

    console.table(sample);

    const breakdown = await db.get(`
        SELECT 
            COUNT(*) as total_count,
            SUM(amount) / 1000000.0 as total_usdc_6_dec,
            SUM(amount) / 1e18 as total_usdc_18_dec
        FROM payouts
    `);
    
    console.log("\n--- SCALING POSSIBILITIES ---");
    console.log(JSON.stringify(breakdown, null, 2));

    await db.close();
}

inspectRedemptions();
