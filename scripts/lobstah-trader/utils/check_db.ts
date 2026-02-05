import { open } from 'sqlite';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';

async function checkDB() {
    const dbPath = path.resolve(__dirname, '../../data/lobstah.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    const count = await db.get('SELECT COUNT(*) as count FROM trades');
    console.log(`Current trade count in SQLite: ${count.count}`);

    const sample = await db.all('SELECT * FROM trades LIMIT 2');
    console.log("Sample Trades:", JSON.stringify(sample, null, 2));

    await db.close();
}

checkDB();
