import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { request, gql } from 'graphql-request';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = "3369f1dbac2b4c06640237f80f22c6ba";
// Using the Activity Subgraph which tracks market resolutions via FixedProductMarketMaker
const endpoint = `https://gateway.thegraph.com/api/subgraphs/id/Bx1W4S7kDVxs9gC3s2G6DS8kdNBJNVhMviCtin2DiBp`;

async function repairWinningIndices() {
    const dbPath = path.resolve(__dirname, '../../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log("🦞 Operation Index-Fix: Recovering Winning Outcomes...");

    const markets = await db.all("SELECT condition_id FROM markets");
    console.log(`Auditing ${markets.length} conditions...`);

    for (const market of markets) {
        try {
            // Note: In Polymarket subgraphs, resolution is often tracked on the FPMM entity 
            // or the Redemption entity. We'll probe the Redemption entity to see what actually paid out.
            const query = gql`
                query getResolution($condition: String!) {
                    redemptions(first: 1, where: { condition: $condition }) {
                        indexSets
                    }
                }
            `;

            const data: any = await request(endpoint, query, { condition: market.condition_id }, { Authorization: `Bearer ${apiKey}` });
            
            if (data.redemptions && data.redemptions.length > 0) {
                // indexSets is an array. If outcome 0 won, it's [1]. If outcome 1 won, it's [2]. 
                // This is bitmask logic: 1 << index.
                const mask = parseInt(data.redemptions[0].indexSets[0]);
                const winner = mask === 1 ? 0 : (mask === 2 ? 1 : null);

                if (winner !== null) {
                    await db.run("UPDATE markets SET winning_outcome_index = ?, resolved = 1 WHERE condition_id = ?", [winner, market.condition_id]);
                    console.log(`✅ Fixed Condition ${market.condition_id.substring(0,10)}: Winner Index ${winner}`);
                }
            }
        } catch (e) {
            // console.error(e.message);
        }
    }

    const check = await db.get("SELECT COUNT(*) as count FROM markets WHERE winning_outcome_index IS NOT NULL");
    console.log(`\nOperation Complete. Markets with Winners: ${check.count}`);

    await db.close();
}

repairWinningIndices();
