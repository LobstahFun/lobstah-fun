import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deepMarketAuditFix() {
    const dbPath = path.resolve(__dirname, '../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log("🦞 LobstahAudit: Force-resolving markets from Gamma...");

    const markets = await db.all("SELECT condition_id, question FROM markets");
    console.log(`Checking ${markets.length} markets for resolution...`);
    
    let newlyResolved = 0;

    for (const m of markets) {
        try {
            // Polymarket markets often list resolution under 'closed' or have a 'winningOutcomeIndex'
            // We use the /markets endpoint with the condition_id
            const resp = await axios.get(`https://gamma-api.polymarket.com/markets?condition_id=${m.condition_id}`);
            
            if (resp.data && resp.data.length > 0) {
                // Find the specific market object
                const market = resp.data[0];
                
                // If it's closed and has a result, it's resolved.
                // In Gamma, 'resolved' is the boolean, and 'winningOutcomeIndex' is the value.
                if (market.resolved === true || market.closed === true) {
                    const winner = market.winningOutcomeIndex !== undefined ? market.winningOutcomeIndex : null;
                    
                    // console.log(`Attempting to mark: "${market.question}" as Resolved. Winner: ${winner}`);
                    
                    await db.run(`
                        UPDATE markets 
                        SET resolved = 1, winning_outcome_index = ? 
                        WHERE condition_id = ?
                    `, [winner, m.condition_id]);
                    newlyResolved++;
                }
            }
        } catch (e) {
            // console.error(`Error on ${m.condition_id}: ${e.message}`);
        }
    }

    console.log(`\nAudit Complete. Total Markets marked as Resolved: ${newlyResolved}`);
    
    const countResolved = await db.get("SELECT COUNT(*) as count FROM markets WHERE resolved = 1");
    console.log(`Current Resolved Count in DB: ${countResolved.count}`);

    await db.close();
}

deepMarketAuditFix();
