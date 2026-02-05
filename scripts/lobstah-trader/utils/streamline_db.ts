import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function streamlineSchema() {
    const dbPath = path.resolve(__dirname, '../../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log("🦞 LobstahOps: Streamlining Intelligence Warehouse...");

    // Remove redundant tables
    await db.exec(`DROP TABLE IF EXISTS traders;`);
    await db.exec(`DROP TABLE IF EXISTS positions;`);

    // Ensure trades and markets exist with correct columns
    await db.exec(`
        CREATE TABLE IF NOT EXISTS markets (
            condition_id TEXT PRIMARY KEY,
            question TEXT,
            resolved INTEGER DEFAULT 0,
            winning_outcome_index INTEGER,
            last_updated DATETIME
        );
    `);

    // We don't drop trades here to keep the 100 we have, but ensure schema matches
    await db.exec(`
        CREATE TABLE IF NOT EXISTS trades (
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
            block_number INTEGER,
            market_condition_id TEXT,
            FOREIGN KEY(market_condition_id) REFERENCES markets(condition_id)
        );
    `);

    console.log("✅ Schema streamlined to 'trades' and 'markets'.");
    await db.close();
}

streamlineSchema();
