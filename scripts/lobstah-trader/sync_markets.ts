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

async function syncMarketsTokenFirst() {
    const dbPath = path.resolve(__dirname, '../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log("🦞 LobstahSync: Resolving Markets (Token-First Strategy)...");

    const orphanedAssets = await db.all(`
        SELECT DISTINCT maker_asset_id as asset_id FROM trades WHERE maker_asset_id != '0' AND market_condition_id IS NULL
        UNION
        SELECT DISTINCT taker_asset_id as asset_id FROM trades WHERE taker_asset_id != '0' AND market_condition_id IS NULL
    `);

    if (orphanedAssets.length === 0) {
        console.log("✅ All assets already resolved.");
        return;
    }

    for (const asset of orphanedAssets) {
        try {
            console.log(`Searching for Token ID: ${asset.asset_id}...`);
            
            // STEP A: Query Gamma API directly for this specific Token ID
            // Using the /markets endpoint with clob_token_ids filter
            const gammaUrl = `https://gamma-api.polymarket.com/markets?clob_token_ids=${asset.asset_id}`;
            const gammaResp = await axios.get(gammaUrl);
            
            if (gammaResp.data && gammaResp.data.length > 0) {
                // We found the EXACT market for this token
                const market = gammaResp.data[0];
                const conditionId = market.conditionId;

                console.log(`✅ MATCH: "${market.question}" (Condition: ${conditionId})`);

                // STEP B: Update Markets Table
                await db.run(`
                    INSERT INTO markets (condition_id, question, resolved, winning_outcome_index, last_updated)
                    VALUES (?, ?, ?, ?, DATETIME('now'))
                    ON CONFLICT(condition_id) DO UPDATE SET
                    question = excluded.question,
                    resolved = excluded.resolved,
                    winning_outcome_index = excluded.winning_outcome_index,
                    last_updated = DATETIME('now')
                `, [
                    conditionId,
                    market.question,
                    market.resolved ? 1 : 0,
                    market.winning_outcome_index || 0
                ]);

                // STEP C: Link Trade to this Market
                await db.run(`
                    UPDATE trades SET market_condition_id = ? 
                    WHERE maker_asset_id = ? OR taker_asset_id = ?
                `, [conditionId, asset.asset_id, asset.asset_id]);

            } else {
                console.log(`⚠️ Gamma API returned no results for Token ID: ${asset.asset_id}. Falling back to Subgraph mapping...`);
                
                // FALLBACK: Query Subgraph to get Condition ID, then query Gamma for that ID and look for the token in clobTokenIds array
                const subQuery = gql`query getPos($id: ID!) { position(id: $id) { condition } }`;
                const subData: any = await request(activitySubgraph, subQuery, { id: asset.asset_id }, { Authorization: `Bearer ${apiKey}` });

                if (subData.position) {
                    const cId = subData.position.condition;
                    const fallbackUrl = `https://gamma-api.polymarket.com/markets?condition_id=${cId}`;
                    const fallbackResp = await axios.get(fallbackUrl);
                    
                    // Filter the list of markets for the one that actually contains our specific token ID
                    const correctMarket = fallbackResp.data.find((m: any) => m.clobTokenIds && m.clobTokenIds.includes(asset.asset_id));

                    if (correctMarket) {
                        console.log(`✅ FALLBACK MATCH: "${correctMarket.question}"`);
                        await db.run(`INSERT INTO markets (condition_id, question, resolved, last_updated) VALUES (?, ?, ?, DATETIME('now')) ON CONFLICT(condition_id) DO NOTHING`, 
                            [cId, correctMarket.question, correctMarket.resolved ? 1 : 0]);
                        await db.run(`UPDATE trades SET market_condition_id = ? WHERE maker_asset_id = ? OR taker_asset_id = ?`, [cId, asset.asset_id, asset.asset_id]);
                    }
                }
            }

        } catch (error) {
            console.error(`❌ Error resolving ${asset.asset_id}:`, error.message);
        }
    }

    await db.close();
    console.log("🎯 Token-First synchronization complete.");
}

syncMarketsTokenFirst();
