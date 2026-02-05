import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateModernEraReport() {
    const dbPath = path.resolve(__dirname, '../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log("📊 LobstahIntelligence: Generating Exhaustive Modern Era Report...");

    const MODERN_ERA_START = 1735689600; // Jan 1, 2025
    const SCALING_FACTOR = 4.546;

    const report = await db.all(`
        SELECT 
            t.trader_address,
            COUNT(t.id) as trade_count,
            (
                (SUM(CASE 
                    WHEN t.side = 'MAKER' AND t.maker_asset_id = '0' THEN t.maker_amount 
                    WHEN t.side = 'TAKER' AND t.taker_asset_id = '0' THEN t.taker_amount 
                    ELSE 0 
                END)) + 
                (COALESCE(p.payout_total, 0) / ${SCALING_FACTOR})
            ) / 1000000.0 as gain,
            (SUM(CASE 
                WHEN t.side = 'MAKER' AND t.maker_asset_id != '0' THEN t.taker_amount 
                WHEN t.side = 'TAKER' AND t.taker_asset_id != '0' THEN t.maker_amount 
                ELSE 0 
            END)) / 1000000.0 as loss
        FROM trades t
        LEFT JOIN (
            SELECT trader_address, SUM(amount) as payout_total 
            FROM payouts 
            WHERE timestamp >= ${MODERN_ERA_START}
            GROUP BY trader_address
        ) p ON t.trader_address = p.trader_address
        WHERE t.timestamp >= ${MODERN_ERA_START}
        GROUP BY t.trader_address
    `);

    console.log("\n--- EXHAUSTIVE SQUAD REPORT (Segmented) ---");
    report.forEach(r => {
        const net = r.gain - r.loss;
        console.log(`\nTrader: ${r.trader_address}`);
        console.log(`Trades: ${r.trade_count.toLocaleString()}`);
        console.log(`Gain:   $${r.gain.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
        console.log(`Loss:   $${r.loss.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
        console.log(`Net:    $${net.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
    });

    await db.close();
}

generateModernEraReport();
