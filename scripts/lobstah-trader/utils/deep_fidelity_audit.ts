import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deepFidelityAudit() {
    const dbPath = path.resolve(__dirname, '../../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log("🕵️ LobstahAudit: Deep Flow Analysis...");

    // 1. Analyze Redemptions - are we overcounting payouts?
    // Some Technical markets might emit multiple redemptions for one event
    const redemptionStats = await db.get(`
        SELECT 
            COUNT(*) as count, 
            SUM(amount)/1000000.0 as total_usdc,
            AVG(amount)/1000000.0 as avg_payout,
            MAX(amount)/1000000.0 as max_payout
        FROM payouts
    `);

    // 2. Check for "Redemption Swaps"
    // In some subgraphs, 'amount' might be in technical units (like shares) not USDC.
    // If the UI says Volume is $92M and Payout is $1.1M, our $5M is definitely suspicious.
    
    console.log("\n--- REDEMPTION FIDELITY ---");
    console.log(JSON.stringify(redemptionStats, null, 2));

    // 3. Sample the largest payouts to see if they make sense
    const bigPayouts = await db.all(`
        SELECT p.*, m.question 
        FROM payouts p
        LEFT JOIN markets m ON p.condition_id = m.condition_id
        ORDER BY amount DESC 
        LIMIT 5
    `);
    
    console.log("\n--- TOP PAYOUTS ---");
    console.table(bigPayouts);

    await db.close();
}

deepFidelityAudit();
