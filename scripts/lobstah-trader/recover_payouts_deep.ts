import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { request, gql } from 'graphql-request';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = "3369f1dbac2b4c06640237f80f22c6ba";
const endpoint = `https://gateway.thegraph.com/api/subgraphs/id/Bx1W4S7kDVxs9gC3s2G6DS8kdNBJNVhMviCtin2DiBp`;

async function deepRecoverPayouts(address: string) {
    const dbPath = path.resolve(__dirname, '../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log(`🦞 LobstahDeepAudit: Syncing all historical redemptions for ${address}...`);

    let totalRedemptions = 0;
    let totalValue = 0;

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

    for (let skip = 0; skip < 5000; skip += 100) {
        console.log(`Fetching skip ${skip}...`);
        try {
            const data: any = await request(endpoint, query, { address: address.toLowerCase(), skip }, { Authorization: `Bearer ${apiKey}` });
            if (data.redemptions.length === 0) break;

            for (const r of data.redemptions) {
                await db.run("INSERT OR IGNORE INTO payouts (id, timestamp, amount, condition_id) VALUES (?, ?, ?, ?)",
                    [r.id, parseInt(r.timestamp), parseFloat(r.payout), r.condition]);
                totalValue += parseFloat(r.payout);
            }
            totalRedemptions += data.redemptions.length;
        } catch (e) {
            console.error("Error in sync loop:", e.message);
            break;
        }
    }

    const final = await db.get("SELECT SUM(amount) / 1000000.0 as total FROM payouts");
    console.log(`\n🎯 Redemptions Synced: ${totalRedemptions}`);
    console.log(`TOTAL REDEEMED PAYOUTS: $${final.total?.toLocaleString() || 0}`);

    await db.close();
}

deepRecoverPayouts("0x63ce342161250d705dc0b16df89036c8e5f9ba9a");
