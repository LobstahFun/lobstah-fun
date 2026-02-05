import { ClobClient } from '@polymarket/clob-client';
import { open } from 'sqlite';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';

async function verifyWithSDK() {
    const dbPath = path.resolve(__dirname, '../../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    // 1. Get a sample hash from our SQLite (populated via The Graph)
    const dbTrade = await db.get('SELECT transaction_hash FROM trades LIMIT 1');
    if (!dbTrade) {
        console.log("No trades in DB to verify.");
        return;
    }
    console.log(`Checking Graph transaction in SDK: ${dbTrade.transaction_hash}`);

    // 2. Query SDK for recent market data to see if we can find this fill
    const client = new ClobClient("https://clob.polymarket.com", 137);
    
    try {
        // We use getTrades from the SDK (Public endpoint for recent fills)
        const sdkTrades = await client.getTrades({
            maker_address: "0x63ce342161250d705dc0b16df89036c8e5f9ba9a"
        });

        console.log(`SDK returned ${sdkTrades.length} recent trades.`);
        
        // Check if our DB trade hash exists in the SDK response
        const match = sdkTrades.find(t => t.transaction_hash === dbTrade.transaction_hash);
        
        if (match) {
            console.log("✅ MATCH FOUND: The Graph data aligns with the Polymarket SDK.");
            console.log("SDK Detail:", JSON.stringify(match, null, 2));
        } else {
            console.log("❓ NO DIRECT MATCH in current SDK window. The SDK only shows the most recent ~100 fills, while The Graph is the full archive.");
            console.log("Latest SDK Hash:", sdkTrades[0]?.transaction_hash);
        }

    } catch (error) {
        console.error("SDK Verification Error:", error);
    } finally {
        await db.close();
    }
}

verifyWithSDK();
