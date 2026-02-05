import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { request, gql } from 'graphql-request';
import axios from 'axios';
import { fileURLToPath } from 'url';

const apiKey = "3369f1dbac2b4c06640237f80f22c6ba";
const activitySubgraph = `https://gateway.thegraph.com/api/subgraphs/id/Bx1W4S7kDVxs9gC3s2G6DS8kdNBJNVhMviCtin2DiBp`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deepMarketSync() {
    const dbPath = path.resolve(__dirname, '../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log("🦞 LobstahSync: Resolving Deep Market Metadata...");

    const orphaned = await db.all(`
        SELECT DISTINCT asset_id FROM (
            SELECT maker_asset_id as asset_id FROM trades WHERE maker_asset_id != '0' AND market_condition_id IS NULL
            UNION
            SELECT taker_asset_id as asset_id FROM trades WHERE taker_asset_id != '0' AND market_condition_id IS NULL
        )
    `);

    console.log(`Found ${orphaned.length} unique tokens to resolve...`);

    for (const row of orphaned) {
        const tokenId = row.asset_id;
        try {
            // Check Gamma directly first (Fastest)
            const gammaUrl = `https://gamma-api.polymarket.com/markets?clob_token_ids=${tokenId}`;
            const gammaResp = await axios.get(gammaUrl);
            
            let market = gammaResp.data && gammaResp.data.length > 0 ? gammaResp.data[0] : null;

            if (!market) {
                // Fallback to Subgraph to get Condition ID
                const subQuery = gql`query getPos($id: ID!) { position(id: $id) { condition } }`;
                const subData: any = await request(activitySubgraph, subQuery, { id: tokenId }, { Authorization: `Bearer ${apiKey}` });

                if (subData.position) {
                    const cId = subData.position.condition;
                    const fallbackUrl = `https://gamma-api.polymarket.com/markets?condition_id=${cId}`;
                    const fallbackResp = await axios.get(fallbackUrl);
                    market = fallbackResp.data.find((m: any) => m.clobTokenIds && m.clobTokenIds.includes(tokenId));
                }
            }

            if (market) {
                await db.run(`
                    INSERT INTO markets (condition_id, question, resolved, winning_outcome_index, last_updated)
                    VALUES (?, ?, ?, ?, DATETIME('now'))
                    ON CONFLICT(condition_id) DO UPDATE SET
                    question = excluded.question, resolved = excluded.resolved, winning_outcome_index = excluded.winning_outcome_index
                `, [market.conditionId, market.question, market.resolved ? 1 : 0, market.winning_outcome_index || 0]);

                await db.run(`UPDATE trades SET market_condition_id = ? WHERE maker_asset_id = ? OR taker_asset_id = ?`, 
                    [market.conditionId, tokenId, tokenId]);
                
                console.log(`✅ Resolved: ${market.question.substring(0, 50)}...`);
            } else {
                console.log(`⚠️ Unresolved: ${tokenId}`);
            }
        } catch (e) {
            console.error(`Error on ${tokenId}: ${e.message}`);
        }
    }

    await db.close();
}

deepMarketSync();
