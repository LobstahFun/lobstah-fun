import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function refreshResolutions() {
    const dbPath = path.resolve(__dirname, '../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log("🦞 LobstahOps: Checking Gamma API for fresh resolutions...");

    const unresolved = await db.all("SELECT condition_id FROM markets WHERE resolved = 0");
    console.log(`Checking ${unresolved.length} unresolved markets...`);

    for (const m of unresolved) {
        try {
            const resp = await axios.get(`https://gamma-api.polymarket.com/markets?condition_id=${m.condition_id}`);
            if (resp.data && resp.data.length > 0) {
                const market = resp.data[0];
                if (market.resolved) {
                    console.log(`✅ Market Resolved: ${market.question}`);
                    await db.run(`
                        UPDATE markets 
                        SET resolved = 1, winning_outcome_index = ? 
                        WHERE condition_id = ?
                    `, [market.winning_outcome_index, m.condition_id]);
                }
            }
        } catch (e) {
            console.error(`Error checking ${m.condition_id}: ${e.message}`);
        }
    }

    await db.close();
    console.log("🎯 Resolution check finished.");
}

refreshResolutions();
