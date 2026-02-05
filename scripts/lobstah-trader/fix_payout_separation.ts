import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { request, gql } from 'graphql-request';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = "3369f1dbac2b4c06640237f80f22c6ba";
const endpoint = `https://gateway.thegraph.com/api/subgraphs/id/Bx1W4S7kDVxs9gC3s2G6DS8kdNBJNVhMviCtin2DiBp`;

const TARGET_TRADERS = [
    "0x63ce342161250d705dc0b16df89036c8e5f9ba9a",
    "0x43372356634781eea88d61bbdd7824cdce958882"
];

async function recoverPayoutsByTrader(address: string) {
    const dbPath = path.resolve(__dirname, '../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    const addr = address.toLowerCase();
    console.log(`🦞 LobstahFidelity: Syncing redemptions for ${addr}...`);

    const query = gql`
        query getRedemptions($address: String!, $skip: Int!) {
            redemptions(first: 100, skip: $skip, orderBy: timestamp, orderDirection: desc, where: { redeemer: $address }) {
                id
                timestamp
                payout
                condition
            }
        }
    `;

    // Drop and Recreate payouts with trader_address for perfect separation
    await db.exec(`CREATE TABLE IF NOT EXISTS payouts_new (
        id TEXT PRIMARY KEY, 
        trader_address TEXT,
        timestamp INTEGER, 
        amount REAL, 
        condition_id TEXT
    )`);

    let totalSynced = 0;
    for (let skip = 0; skip < 5000; skip += 100) {
        try {
            const data: any = await request(endpoint, query, { address: addr, skip }, { Authorization: `Bearer ${apiKey}` });
            if (data.redemptions.length === 0) break;

            for (const r of data.redemptions) {
                await db.run("INSERT OR IGNORE INTO payouts_new (id, trader_address, timestamp, amount, condition_id) VALUES (?, ?, ?, ?, ?)",
                    [r.id, addr, parseInt(r.timestamp), parseFloat(r.payout), r.condition]);
            }
            totalSynced += data.redemptions.length;
        } catch (e) { break; }
    }

    console.log(`🎯 Sync Complete for ${addr}. Redemptions: ${totalSynced}`);
    await db.close();
}

async function fixPayouts() {
    for (const t of TARGET_TRADERS) {
        await recoverPayoutsByTrader(t);
    }
    
    // Switch to the new segmented table
    const dbPath = path.resolve(__dirname, '../../data/lobstah.db');
    const db = await open({ filename: dbPath, driver: sqlite3.Database });
    await db.exec(`DROP TABLE IF EXISTS payouts;`);
    await db.exec(`ALTER TABLE payouts_new RENAME TO payouts;`);
    await db.close();
    console.log("✅ Payout Separation Verified.");
}

fixPayouts();
