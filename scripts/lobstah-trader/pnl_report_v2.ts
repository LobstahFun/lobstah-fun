import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function calculateHistoricalPnL() {
    const dbPath = path.resolve(__dirname, '../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log("📊 LobstahIntelligence: Calculating Accurate Historical P&L...");

    // 1. We need to map each asset ID to its outcome index (0 or 1)
    // We already know that for these binary markets:
    // One technical asset ID is outcome 0, and the other is outcome 1.
    // I will build a mapping of our synced tokens to their indices.

    const report = await db.all(`
        WITH token_mapping AS (
            -- This is the critical step: identifying if the trader held the WINNING token.
            -- We join the trade to the market winner.
            SELECT 
                t.*,
                m.question,
                m.winning_outcome_index,
                CASE 
                    -- Here we need to determine if maker_asset_id or taker_asset_id represents the winning index
                    -- Since we resolved conditionId via token ID earlier, we can match them.
                    WHEN t.maker_asset_id != '0' AND (t.maker_asset_id LIKE '%' || m.winning_outcome_index) THEN 1 -- Held winning asset
                    WHEN t.taker_asset_id != '0' AND (t.taker_asset_id LIKE '%' || m.winning_outcome_index) THEN 1
                    ELSE 0
                END as is_winner
            FROM trades t
            JOIN markets m ON t.market_condition_id = m.condition_id
            WHERE m.resolved = 1
        ),
        pnl_calc AS (
            SELECT 
                id,
                side,
                question,
                -- USDC spent/received
                CASE 
                    WHEN side = 'MAKER' AND maker_asset_id = '0' THEN maker_amount -- Sold shares for USDC
                    WHEN side = 'MAKER' AND maker_asset_id != '0' THEN -taker_amount -- Bought shares with USDC
                    WHEN side = 'TAKER' AND taker_asset_id = '0' THEN taker_amount -- Sold shares for USDC
                    WHEN side = 'TAKER' AND taker_asset_id != '0' THEN -maker_amount -- Bought shares with USDC
                    ELSE 0
                END as cash_flow
            FROM trades t
            JOIN markets m ON t.market_condition_id = m.condition_id
            WHERE m.resolved = 1
        )
        SELECT 
            SUM(cash_flow) / 1000000.0 as net_cash_pnl,
            COUNT(*) as trade_count
        FROM pnl_calc
    `);

    console.log("--- HISTORICAL P&L SUMMARY ---");
    console.log(JSON.stringify(report, null, 2));

    await db.close();
}

calculateHistoricalPnL();
