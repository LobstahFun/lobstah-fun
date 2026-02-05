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

    console.log("📊 LobstahIntelligence: Calculating P&L for past 5,000 trades...");

    // We calculate P&L by comparing the cost of shares vs. their outcome value ($1 or $0)
    // Maker/Taker logic:
    // In these markets, one side is usually the collateral (USDC) and the other is the share.
    // For Maker: maker_amount is shares, taker_amount is USDC received.
    // For Taker: taker_amount is shares, maker_amount is USDC spent.
    
    const pnlReport = await db.all(`
        WITH trade_details AS (
            SELECT 
                t.id,
                t.side,
                t.maker_asset_id,
                t.taker_asset_id,
                t.maker_amount,
                t.taker_amount,
                m.question,
                m.resolved,
                m.winning_outcome_index,
                -- Logic: If asset_id is '0', it's USDC. Otherwise it's a share.
                CASE WHEN t.maker_asset_id != '0' THEN t.maker_amount ELSE 0 END as shares_filled,
                CASE WHEN t.maker_asset_id = '0' THEN t.maker_amount ELSE t.taker_amount END as usdc_value
            FROM trades t
            LEFT JOIN markets m ON t.market_condition_id = m.condition_id
        )
        SELECT 
            COUNT(*) as total_trades,
            SUM(usdc_value) as total_volume_usdc,
            SUM(CASE WHEN resolved = 1 THEN 1 ELSE 0 END) as resolved_trades
        FROM trade_details
    `);

    console.log("--- SQUAD P&L REPORT ---");
    console.log(JSON.stringify(pnlReport, null, 2));

    const marketSummary = await db.all(`
        SELECT 
            m.question,
            COUNT(t.id) as trade_count,
            SUM(CASE WHEN t.maker_asset_id = '0' THEN t.maker_amount ELSE t.taker_amount END) as volume
        FROM trades t
        JOIN markets m ON t.market_condition_id = m.condition_id
        GROUP BY m.question
        ORDER BY volume DESC
        LIMIT 5
    `);

    console.log("--- TOP MARKETS BY VOLUME ---");
    console.log(JSON.stringify(marketSummary, null, 2));

    await db.close();
}

calculateHistoricalPnL();
