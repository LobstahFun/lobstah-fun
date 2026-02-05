import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deepMarketAudit() {
    const dbPath = path.resolve(__dirname, '../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log("🦞 LobstahAudit: Auditing Resolution Status for all markets...");

    const markets = await db.all("SELECT condition_id, question FROM markets");
    console.log(`Checking ${markets.length} markets...`);
    
    let newlyResolved = 0;

    for (const m of markets) {
        try {
            const resp = await axios.get(`https://gamma-api.polymarket.com/markets?condition_id=${m.condition_id}`);
            if (resp.data && resp.data.length > 0) {
                const market = resp.data[0];
                if (market.resolved) {
                    console.log(`✅ Market is RESOLVED: "${market.question}"`);
                    await db.run(`UPDATE markets SET resolved = 1, winning_outcome_index = ? WHERE condition_id = ?`, 
                        [market.winning_outcome_index, m.condition_id]);
                    newlyResolved++;
                }
            }
        } catch (e) {
            // skip errors
        }
    }

    console.log(`\nAudit Complete. Newly Resolved: ${newlyResolved}`);
    await db.close();
}

deepMarketAudit();
