import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { request, gql } from 'graphql-request';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = "3369f1dbac2b4c06640237f80f22c6ba";
const endpoint = `https://gateway.thegraph.com/api/subgraphs/id/Bx1W4S7kDVxs9gC3s2G6DS8kdNBJNVhMviCtin2DiBp`;

async function recoverPayouts() {
    const dbPath = path.resolve(__dirname, '../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log("🦞 LobstahAudit: Recovering Redemption Payouts...");

    const addr = "0x63ce342161250d705dc0b16df89036c8e5f9ba9a";

    const query = gql`
        query getRedemptions($address: String!) {
            redemptions(first: 1000, where: { redeemer: $address }) {
                id
                timestamp
                payout
                condition
            }
        }
    `;

    try {
        const data: any = await request(endpoint, query, { address: addr }, { Authorization: `Bearer ${apiKey}` });
        const redemptions = data.redemptions;

        console.log(`Found ${redemptions.length} redemption events.`);

        // Table for payouts
        await db.exec(`CREATE TABLE IF NOT EXISTS payouts (id TEXT PRIMARY KEY, timestamp INTEGER, amount REAL, condition_id TEXT)`);

        for (const r of redemptions) {
            await db.run("INSERT OR IGNORE INTO payouts (id, timestamp, amount, condition_id) VALUES (?, ?, ?, ?)",
                [r.id, parseInt(r.timestamp), parseFloat(r.payout), r.condition]);
        }

        const totalPayout = await db.get("SELECT SUM(amount) / 1000000.0 as total FROM payouts");
        console.log(`\nTOTAL REDEEMED PAYOUTS: $${totalPayout.total?.toFixed(2) || 0}`);

    } catch (e) {
        console.error(e.message);
    }

    await db.close();
}

recoverPayouts();
