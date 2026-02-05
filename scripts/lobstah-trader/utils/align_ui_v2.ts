import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function alignUIFidelity() {
    const dbPath = path.resolve(__dirname, '../../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log("🦞 Final Alignment Audit: Solving for $1,061,475...");

    // The UI says Gain is $1,132,795.
    // Our DB has total redemptions of $5.14M (at 6 decimals).
    // Factor = 5.14 / 1.13 ~= 4.5
    // This suggests that 'payout' in the subgraph might be shares * 1e6, but USDC is something else?
    // OR: Payout is not USDC, but technical shares that need to be multiplied by price.
    
    // Let's test the 'Redemption = Volume' hypothesis.
    // If Gain is $1.13M and Total PnL is $1.06M, the loss is tiny (~$71k).
    
    const flow = await db.get(`
        SELECT 
            SUM(CASE WHEN side = 'TAKER' AND taker_asset_id = '0' THEN taker_amount ELSE 0 END) / 1000000.0 as taker_recv,
            SUM(CASE WHEN side = 'TAKER' AND taker_asset_id != '0' THEN maker_amount ELSE 0 END) / 1000000.0 as taker_spent,
            SUM(CASE WHEN side = 'MAKER' AND maker_asset_id = '0' THEN maker_amount ELSE 0 END) / 1000000.0 as maker_recv,
            SUM(CASE WHEN side = 'MAKER' AND maker_asset_id != '0' THEN taker_amount ELSE 0 END) / 1000000.0 as maker_spent
        FROM trades
    `);

    console.log("\n--- TRADE FLOW BREAKDOWN ---");
    console.log(JSON.stringify(flow, null, 2));

    await db.close();
}

alignUIFidelity();
