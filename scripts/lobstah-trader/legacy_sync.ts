import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { request, gql } from 'graphql-request';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = "3369f1dbac2b4c06640237f80f22c6ba";
const graphEndpoint = `https://gateway.thegraph.com/api/subgraphs/id/EZCTgSzLPuBSqQcuR3ifeiKHKBnpjHSNbYpty8Mnjm9D`;

async function syncOlderTrades(traderAddress: string, startSkip: number, limit: number) {
    const dbPath = path.resolve(__dirname, '../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    const addr = traderAddress.toLowerCase();
    console.log(`🦞 LobstahLegacySync: Syncing trades from skip ${startSkip} to ${startSkip + limit}...`);

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

    for (let skip = startSkip; skip < (startSkip + limit); skip += 100) {
        console.log(`Fetching skip ${skip}...`);
        try {
            const data: any = await request(graphEndpoint, query, { address: addr, skip }, { Authorization: `Bearer ${apiKey}` });
            if (data.maker.length === 0 && data.taker.length === 0) break;

            for (const t of data.maker) {
                await db.run(`INSERT OR IGNORE INTO trades (id, trader_address, timestamp, side, maker_asset_id, taker_asset_id, maker_amount, taker_amount, transaction_hash, fee, block_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                    [t.id, addr, parseInt(t.blockTimestamp), 'MAKER', t.makerAssetId, t.takerAssetId, parseFloat(t.makerAmountFilled), parseFloat(t.takerAmountFilled), t.transactionHash, parseFloat(t.fee), parseInt(t.blockNumber)]);
            }
            for (const t of data.taker) {
                await db.run(`INSERT OR IGNORE INTO trades (id, trader_address, timestamp, side, maker_asset_id, taker_asset_id, maker_amount, taker_amount, transaction_hash, fee, block_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                    [t.id, addr, parseInt(t.blockTimestamp), 'TAKER', t.makerAssetId, t.takerAssetId, parseFloat(t.makerAmountFilled), parseFloat(t.takerAmountFilled), t.transactionHash, parseFloat(t.fee), parseInt(t.blockNumber)]);
            }
        } catch (e) {
            console.error("Sync Error:", e.message);
            break;
        }
    }
    await db.close();
}

// Targeting much deeper to get into yesterday/this week
syncOlderTrades("0x63ce342161250d705dc0b16df89036c8e5f9ba9a", 5000, 5000);
