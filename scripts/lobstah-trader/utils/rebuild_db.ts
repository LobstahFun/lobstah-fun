import { open } from 'sqlite';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';

async function rebuildDB() {
    const dbPath = path.resolve(__dirname, '../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log("🦞 Rebuilding Intelligence Warehouse for full fidelity...");

    // Drop and Recreate trades with the correct high-signal columns
    await db.exec(`DROP TABLE IF EXISTS trades;`);
    await db.exec(`
        CREATE TABLE trades (
            id TEXT PRIMARY KEY,
            trader_address TEXT,
            timestamp INTEGER,
            side TEXT,
            maker_asset_id TEXT,
            taker_asset_id TEXT,
            maker_amount REAL,
            taker_amount REAL,
            transaction_hash TEXT,
            fee REAL,
            block_number INTEGER
        );
    `);

    console.log("✅ Rebuild complete. Ready for full sync.");
    await db.close();
}

rebuildDB();
