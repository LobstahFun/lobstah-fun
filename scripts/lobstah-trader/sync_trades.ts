import { open } from 'sqlite';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import { request, gql } from 'graphql-request';

const apiKey = "3369f1dbac2b4c06640237f80f22c6ba";
const graphEndpoint = `https://gateway.thegraph.com/api/subgraphs/id/EZCTgSzLPuBSqQcuR3ifeiKHKBnpjHSNbYpty8Mnjm9D`;

async function syncTrader(traderAddress: string) {
    const dbPath = path.resolve(__dirname, '../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    const addr = traderAddress.toLowerCase();
    console.log(`🦞 LobstahSync: Starting high-fidelity sync for ${addr}...`);

    const query = gql`
        query getFidelityTrades($address: String!) {
            maker: orderFilleds(first: 50, orderBy: blockTimestamp, orderDirection: desc, where: { maker: $address }) {
                id blockTimestamp transactionHash makerAssetId takerAssetId makerAmountFilled takerAmountFilled fee blockNumber
            }
            taker: orderFilleds(first: 50, orderBy: blockTimestamp, orderDirection: desc, where: { taker: $address }) {
                id blockTimestamp transactionHash makerAssetId takerAssetId makerAmountFilled takerAmountFilled fee blockNumber
            }
        }
    `;

    try {
        const data = await request<any>(graphEndpoint, query, { address: addr }, { Authorization: `Bearer ${apiKey}` });
        
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
        };

        await processSide(data.maker, 'MAKER');
        await processSide(data.taker, 'TAKER');

        console.log(`🎯 Sync Complete. Maker: ${data.maker.length}, Taker: ${data.taker.length}`);

    } catch (error) {
        console.error("❌ Fidelity Sync Error:", error);
    } finally {
        await db.close();
    }
}

syncTrader("0x63ce342161250d705dc0b16df89036c8e5f9ba9a");
