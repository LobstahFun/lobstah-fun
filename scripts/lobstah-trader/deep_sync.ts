import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { request, gql } from 'graphql-request';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = "3369f1dbac2b4c06640237f80f22c6ba";
const graphEndpoint = `https://gateway.thegraph.com/api/subgraphs/id/EZCTgSzLPuBSqQcuR3ifeiKHKBnpjHSNbYpty8Mnjm9D`;

async function deepDeepSync(traderAddress: string, limit: number = 5000) {
    const dbPath = path.resolve(__dirname, '../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    const addr = traderAddress.toLowerCase();
    console.log(`🦞 LobstahDeepSync: Initiating deep crawl for ${addr} (Limit: ${limit})...`);

    let totalMaker = 0;
    let totalTaker = 0;

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

    // Paginate in chunks of 100, targeting 15000 skip to get into earlier this week
    for (let skip = 0; skip < 15000; skip += 100) {
        console.log(`Fetching skip ${skip}...`);
        try {
            const data: any = await request(graphEndpoint, query, { address: addr, skip }, { Authorization: `Bearer ${apiKey}` });
            
            if (data.maker.length === 0 && data.taker.length === 0) break;

            const processSide = async (trades: any[], side: string) => {
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
                }
                return trades.length;
            };

            totalMaker += await processSide(data.maker, 'MAKER');
            totalTaker += await processSide(data.taker, 'TAKER');

        } catch (e) {
            console.error("Deep Sync Loop Error:", e.message);
            break;
        }
    }

    console.log(`🎯 Deep Sync Complete. Maker: ${totalMaker}, Taker: ${totalTaker}.`);
    await db.close();
}

deepDeepSync("0x63ce342161250d705dc0b16df89036c8e5f9ba9a");
