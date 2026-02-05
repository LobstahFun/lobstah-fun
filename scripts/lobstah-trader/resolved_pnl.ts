import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function calculateResolvedPnL() {
    const dbPath = path.resolve(__dirname, '../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log("📊 LobstahIntelligence: Analyzing Resolved P&L for 0x63ce...");

    // We calculate P&L for resolved markets only.
    // Winning shares = $1.00, Losing shares = $0.00.
    // maker_asset_id '0' means they were receiving USDC (Selling shares).
    // taker_asset_id '0' means they were spending USDC (Buying shares).
    // In this subgraph (Activity), '0' often represents the collateral.
    
    const resolvedPnL = await db.all(`
        WITH resolved_trades AS (
            SELECT 
                t.side,
                t.maker_asset_id,
                t.taker_asset_id,
                t.maker_amount,
                t.taker_amount,
                m.question,
                m.winning_outcome_index,
                -- We need to know which outcome (0 or 1) this trade was for.
                -- For now, we'll look at the aggregate USDC flow on resolved markets.
                CASE 
                    WHEN t.side = 'MAKER' AND t.maker_asset_id = '0' THEN t.maker_amount -- USDC Received
                    WHEN t.side = 'MAKER' AND t.maker_asset_id != '0' THEN -t.taker_amount -- USDC Spent
                    WHEN t.side = 'TAKER' AND t.taker_asset_id = '0' THEN t.taker_amount -- USDC Received
                    WHEN t.side = 'TAKER' AND t.taker_asset_id != '0' THEN -t.maker_amount -- USDC Spent
                    ELSE 0 
                END as usdc_flow
            FROM trades t
            JOIN markets m ON t.market_condition_id = m.condition_id
            WHERE m.resolved = 1
        )
        SELECT 
            question,
            COUNT(*) as trade_count,
            SUM(usdc_flow) / 1000000.0 as net_pnl_usdc, -- Assuming 6 decimals for USDC
            SUM(ABS(usdc_flow)) / 1000000.0 as volume_usdc
        FROM resolved_trades
        GROUP BY question
        ORDER BY net_pnl_usdc DESC
    `);

    console.log("--- RESOLVED P&L REPORT (USDC) ---");
    if (resolvedPnL.length === 0) {
        console.log("⚠️ No resolved markets found in the current dataset. Markets from today (Feb 5) are likely still pending resolution.");
    } else {
        console.log(JSON.stringify(resolvedPnL, null, 2));
        const total = resolvedPnL.reduce((acc, curr) => acc + curr.net_pnl_usdc, 0);
        console.log(`\nTOTAL RESOLVED P&L: $${total.toFixed(2)}`);
    }

    await db.close();
}

calculateResolvedPnL();
