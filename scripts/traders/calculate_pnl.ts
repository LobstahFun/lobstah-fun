import fs from 'fs';
import path from 'path';

const TRADER_ADDRESS = "0x63ce342161250d705dc0b16df89036c8e5f9ba9a";
const OUTPUT_DIR = path.join(process.cwd(), "web/content/docs/lobstah-trader/trader-spotlights", TRADER_ADDRESS);
const RESOLVED_FILE = path.join(OUTPUT_DIR, "resolved-trades.ts");

async function calculateLifetimePnL() {
    console.log("🦞 LobstahScout: Calculating Forensic Lifetime PnL...");

    try {
        const content = fs.readFileSync(RESOLVED_FILE, 'utf-8');
        const arrayStart = content.indexOf('[');
        const arrayEnd = content.lastIndexOf(']') + 1;
        const trades = JSON.parse(content.substring(arrayStart, arrayEnd));

        console.log(`📊 Processing ${trades.length} trades for life-to-date calculation...`);

        let totalBuyVolume = 0;
        let totalSellVolume = 0;
        let totalCASH_OUT = 0; // Money received from sells
        let totalCASH_IN = 0;  // Money spent on buys

        trades.forEach((t: any) => {
            const amount = t.size * t.price;
            if (t.side === "BUY") {
                totalCASH_IN += amount;
                totalBuyVolume += t.size;
            } else if (t.side === "SELL") {
                totalCASH_OUT += amount;
                totalSellVolume += t.size;
            }
        });

        const lifetimePnL = totalCASH_OUT - totalCASH_IN;

        console.log(`--- LIFETIME STATS ---`);
        console.log(`Total Spent (In):  $${totalCASH_IN.toFixed(2)}`);
        console.log(`Total Recv (Out):  $${totalCASH_OUT.toFixed(2)}`);
        console.log(`----------------------`);
        console.log(`FORENSIC PNL:     $${lifetimePnL.toFixed(2)}`);

        // Update the file with the new stats header
        const updatedContent = content.replace(
            /export const resolvedData = \{/,
            `export const resolvedData = {
    lifetimeStats: {
        totalSpent: ${totalCASH_IN.toFixed(2)},
        totalReceived: ${totalCASH_OUT.toFixed(2)},
        forensicPnL: ${lifetimePnL.toFixed(2)}
    },`
        );

        fs.writeFileSync(RESOLVED_FILE, updatedContent);
        console.log(`✅ Success! Forensic PnL saved to: ${RESOLVED_FILE}`);

    } catch (error) {
        console.error("❌ Forensic calculation failed:", error);
    }
}

calculateLifetimePnL();
