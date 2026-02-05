import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { request, gql } from 'graphql-request';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = "3369f1dbac2b4c06640237f80f22c6ba";
const graphEndpoint = `https://gateway.thegraph.com/api/subgraphs/id/EZCTgSzLPuBSqQcuR3ifeiKHKBnpjHSNbYpty8Mnjm9D`;

async function fetchOlderTrades(traderAddress: string) {
    const dbPath = path.resolve(__dirname, '../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    const addr = traderAddress.toLowerCase();
    // Skipping massive amounts to find older days
    const skips = [50000, 100000, 150000];

    for (const skip of skips) {
        console.log(`🦞 LobstahAncientSync: Skipping ${skip} trades to find older history...`);

        const query = gql`
            query getAncientTrades($address: String!, $skip: Int!) {
                maker: orderFilleds(first: 100, skip: $skip, orderBy: blockTimestamp, orderDirection: desc, where: { maker: $address }) {
                    id blockTimestamp transactionHash makerAssetId takerAssetId makerAmountFilled takerAmountFilled fee blockNumber
                }
                taker: orderFilleds(first: 100, skip: $skip, orderBy: blockTimestamp, orderDirection: desc, where: { taker: $address }) {
                    id blockTimestamp transactionHash makerAssetId takerAssetId makerAmountFilled takerAmountFilled fee blockNumber
                }
            }
        `;

        try {
            const data: any = await request(graphEndpoint, query, { address: addr, skip }, { Authorization: `Bearer ${apiKey}` });
            
            for (const side of ['maker', 'taker']) {
                for (const t of data[side]) {
                    await db.run(`INSERT OR IGNORE INTO trades (id, trader_address, timestamp, side, maker_asset_id, taker_asset_id, maker_amount, taker_amount, transaction_hash, fee, block_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                        [t.id, addr, parseInt(t.blockTimestamp), side.toUpperCase(), t.makerAssetId, t.takerAssetId, parseFloat(t.makerAmountFilled), parseFloat(t.takerAmountFilled), t.transactionHash, parseFloat(t.fee), parseInt(t.blockNumber)]);
                }
            }
            
            const count = data.maker.length + data.taker.length;
            console.log(`🎯 Skip ${skip}: Pulled ${count} trades.`);
            if (count > 0) {
                const sampleTime = data.maker[0]?.blockTimestamp || data.taker[0]?.blockTimestamp;
                console.log(`Sample Trade Date: ${new Date(parseInt(sampleTime) * 1000).toISOString()}`);
            }

        } catch (e) {
            console.error("Ancient Sync Error:", e.message);
        }
    }
    await db.close();
}

fetchOlderTrades("0x63ce342161250d705dc0b16df89036c8e5f9ba9a");
