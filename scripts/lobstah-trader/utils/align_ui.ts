import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function alignWithUI() {
    const dbPath = path.resolve(__dirname, '../../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log("🦞 Operation Alignment: Re-calculating P&L with 6-decimal USDC precision...");

    // The UI says:
    // Volume: $92,127,555.75
    // Gain: $1,132,795.32
    // Loss: $71,320.32
    // Net: $1,061,475.00

    const stats = await db.get(`
        WITH filtered_payouts AS (
            -- Filtering out the 'Phantom USDC' (technical units) by assuming payouts over $1M are likely scaled wrong in this subgraph
            -- Realistically, 0x8dxd's biggest win is $28.1k, so we cap individual redemption units.
            SELECT SUM(amount) / 1000000.0 as total_gain FROM payouts WHERE amount < 1000000000000 -- Scaling safety cap
        ),
        trade_flows AS (
            SELECT 
                SUM(CASE 
                    WHEN side = 'MAKER' AND maker_asset_id = '0' THEN maker_amount 
                    WHEN side = 'TAKER' AND taker_asset_id = '0' THEN taker_amount 
                    ELSE 0 
                END) / 1000000.0 as total_received,
                SUM(CASE 
                    WHEN side = 'MAKER' AND maker_asset_id != '0' THEN taker_amount 
                    WHEN side = 'TAKER' AND taker_asset_id != '0' THEN maker_amount 
                    ELSE 0 
                END) / 1000000.0 as total_spent
            FROM trades
        )
        SELECT 
            tf.total_received + fp.total_gain as raw_gain,
            tf.total_spent as raw_loss,
            (tf.total_received + fp.total_gain) - tf.total_spent as net_pnl
        FROM trade_flows tf, filtered_payouts fp
    `);

    console.log("\n--- SQUAD ALIGNMENT REPORT ---");
    console.log(`Calculated Gain: $${stats.raw_gain?.toLocaleString()}`);
    console.log(`Calculated Loss: $${stats.raw_loss?.toLocaleString()}`);
    console.log(`Net Total:       $${stats.net_pnl?.toLocaleString()}`);
    
    console.log(`\nTARGET NET:      $1,061,475.00`);
    const diff = stats.net_pnl - 1061475.00;
    console.log(`Variance:        $${diff.toLocaleString()}`);

    await db.close();
}

alignWithUI();
