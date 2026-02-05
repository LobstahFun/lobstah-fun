import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function calculateWindowPnL() {
    const dbPath = path.resolve(__dirname, '../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log("📊 LobstahIntelligence: Calculating P&L per Market Question...");

    // This query looks at the cash flow for each specific market.
    const windowReport = await db.all(`
        WITH combined_flow AS (
            -- Flows from individual trades
            SELECT 
                market_condition_id,
                CASE 
                    WHEN side = 'MAKER' AND maker_asset_id = '0' THEN maker_amount 
                    WHEN side = 'MAKER' AND maker_asset_id != '0' THEN -taker_amount 
                    WHEN side = 'TAKER' AND taker_asset_id = '0' THEN taker_amount 
                    WHEN side = 'TAKER' AND taker_asset_id != '0' THEN -maker_amount 
                    ELSE 0 
                END as amount
            FROM trades
            
            UNION ALL
            
            -- Flows from redemptions
            SELECT 
                condition_id as market_condition_id,
                amount
            FROM payouts
        )
        SELECT 
            m.question,
            SUM(cf.amount) / 1000000.0 as net_pnl_usdc,
            COUNT(*) as activity_count
        FROM combined_flow cf
        LEFT JOIN markets m ON cf.market_condition_id = m.condition_id
        GROUP BY m.condition_id
        HAVING net_pnl_usdc != 0
        ORDER BY net_pnl_usdc DESC
    `);

    console.log("\n--- PROFIT BY MARKET ---");
    console.table(windowReport);

    const total = windowReport.reduce((acc, curr) => acc + curr.net_pnl_usdc, 0);
    console.log(`\nTOTAL ACCOUNT P&L: $${total.toLocaleString()}`);

    await db.close();
}

calculateWindowPnL();
