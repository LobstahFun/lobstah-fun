import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deepAuditPnl() {
    const dbPath = path.resolve(__dirname, '../../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log("🧐 LobstahAudit: Analyzing 0x63ce PnL Discrepancy...");

    // 1. Check aggregate flow
    const aggregate = await db.get(`
        SELECT 
            SUM(CASE WHEN side = 'MAKER' AND maker_asset_id = '0' THEN maker_amount ELSE 0 END) as maker_usdc_received,
            SUM(CASE WHEN side = 'MAKER' AND maker_asset_id != '0' THEN taker_amount ELSE 0 END) as maker_usdc_spent,
            SUM(CASE WHEN side = 'TAKER' AND taker_asset_id = '0' THEN taker_amount ELSE 0 END) as taker_usdc_received,
            SUM(CASE WHEN side = 'TAKER' AND taker_asset_id != '0' THEN maker_amount ELSE 0 END) as taker_usdc_spent
        FROM trades
    `);

    console.log("\n--- RAW FLOW (Units) ---");
    console.log(JSON.stringify(aggregate, null, 2));

    // 2. Check for missing outcomes
    const outcomeCheck = await db.all(`
        SELECT question, winning_outcome_index, COUNT(*) as trades
        FROM trades t
        JOIN markets m ON t.market_condition_id = m.condition_id
        GROUP BY question
        LIMIT 10
    `);

    console.log("\n--- MARKET MAPPING SAMPLE ---");
    console.table(outcomeCheck);

    await db.close();
}

deepAuditPnl();
