import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function calculateFinalPnL() {
    const dbPath = path.resolve(__dirname, '../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log("📊 LobstahIntelligence: Finalizing Global P&L...");

    // 1. Calculate the USDC flow from trades (Buys/Sells)
    const trades = await db.get(`
        SELECT 
            SUM(CASE 
                WHEN side = 'MAKER' AND maker_asset_id = '0' THEN maker_amount 
                WHEN side = 'MAKER' AND maker_asset_id != '0' THEN -taker_amount 
                WHEN side = 'TAKER' AND taker_asset_id = '0' THEN taker_amount 
                WHEN side = 'TAKER' AND taker_asset_id != '0' THEN -maker_amount 
                ELSE 0 
            END) as flow
        FROM trades
    `);

    // 2. Add the redeemed payouts
    const payouts = await db.get("SELECT SUM(amount) as flow FROM payouts");

    const tradeFlow = (trades.flow || 0) / 1000000.0;
    const payoutFlow = (payouts.flow || 0) / 1000000.0;
    const totalPnL = tradeFlow + payoutFlow;

    console.log(`\n--- FINAL FINANCIAL REPORT ---`);
    console.log(`Trade Cash Flow (Net spent on shares): $${tradeFlow.toLocaleString()}`);
    console.log(`Redemption Cash Flow (Prizes claimed): $${payoutFlow.toLocaleString()}`);
    console.log(`-------------------------------------------`);
    console.log(`TOTAL ESTIMATED P&L: $${totalPnL.toLocaleString()}`);

    await db.close();
}

calculateFinalPnL();
