import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkDuplicates() {
    const dbPath = path.resolve(__dirname, '../../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log("🦞 LobstahAudit: Checking for Intelligence Duplicates...");

    const tradeDupes = await db.get('SELECT COUNT(id) - COUNT(DISTINCT id) as dupes FROM trades');
    const payoutDupes = await db.get('SELECT COUNT(id) - COUNT(DISTINCT id) as dupes FROM payouts');

    console.log(`Trade Duplicates (by ID): ${tradeDupes.dupes}`);
    console.log(`Payout Duplicates (by ID): ${payoutDupes.dupes}`);

    if (tradeDupes.dupes > 0 || payoutDupes.dupes > 0) {
        console.log("⚠️ WARNING: Data redundancy detected.");
    } else {
        console.log("✅ WAREHOUSE INTEGRITY VERIFIED: No duplicate technical IDs found.");
    }

    await db.close();
}

checkDuplicates();
