import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { request, gql } from 'graphql-request';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = "3369f1dbac2b4c06640237f80f22c6ba";
const graphEndpoint = `https://gateway.thegraph.com/api/subgraphs/id/EZCTgSzLPuBSqQcuR3ifeiKHKBnpjHSNbYpty8Mnjm9D`;

async function deepExhaustiveSync(traderAddress: string) {
    const dbPath = path.resolve(__dirname, '../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    const addr = traderAddress.toLowerCase();
    console.log(`🦞 LobstahExhaust: Starting exhaustive sync for ${addr}...`);

    const query = gql`
        query getFidelityTrades($address: String!, $skip: Int!) {
            maker: orderFilleds(first: 100, skip: $skip, orderBy: blockTimestamp, orderDirection: desc, where: { maker: $address }) {
                id blockTimestamp transactionHash makerAssetId takerAssetId makerAmountFilled takerAmountFilled fee blockNumber
            }
            taker: orderFilleds(first: 100, skip: $skip, orderBy: blockTimestamp, orderDirection: desc, where: { taker: $address }) {
                id blockTimestamp transactionHash makerAssetId takerAssetId makerAmountFilled takerAmountFilled fee blockNumber
            }
        }
    `;

    let totalSynced = 0;
    // Pushing the technical limit to 10,000 trades to ensure we hit the 14k target
    for (let skip = 0; skip < 10000; skip += 100) {
        try {
            const data: any = await request(graphEndpoint, query, { address: addr, skip }, { Authorization: `Bearer ${apiKey}` });
            
            if (data.maker.length === 0 && data.taker.length === 0) {
                console.log(`No more data found at skip ${skip}.`);
                break;
            }

            const processSide = async (trades: any[], side: string) => {
                let count = 0;
                for (const t of trades) {
                    await db.run(`
                        INSERT OR IGNORE INTO trades (
                            id, trader_address, timestamp, side, maker_asset_id, taker_asset_id, 
                            maker_amount, taker_amount, transaction_hash, fee, block_number
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        t.id, addr, parseInt(t.blockTimestamp), side, t.makerAssetId, t.takerAssetId,
                        parseFloat(t.makerAmountFilled), parseFloat(t.takerAmountFilled), t.transactionHash,
                        parseFloat(t.fee), parseInt(t.blockNumber)
                    ]);
                    count++;
                }
                return count;
            };

            const mCount = await processSide(data.maker, 'MAKER');
            const tCount = await processSide(data.taker, 'TAKER');
            totalSynced += (mCount + tCount);
            
            console.log(`Skip ${skip}: Synced ${mCount} maker, ${tCount} taker. Current batch total: ${totalSynced}`);
        } catch (error) {
            console.error("❌ Exhaustive Sync Error:", error.message);
            break;
        }
    }

    const finalCount = await db.get('SELECT COUNT(*) as count FROM trades WHERE trader_address = ?', [addr]);
    console.log(`🎯 Exhaustive Sync Complete for ${addr}. Warehouse now holds ${finalCount.count} trades.`);
    await db.close();
}

deepExhaustiveSync("0x43372356634781eea88d61bbdd7824cdce958882");
