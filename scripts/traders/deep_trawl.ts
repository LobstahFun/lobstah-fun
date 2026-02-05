import fs from 'fs';
import path from 'path';
import { createPublicClient, http, parseAbiItem } from 'viem';
import { polygon } from 'viem/chains';

const RPC_URL = "https://polygon-mainnet.infura.io/v3/24pig8qLJQowk1fn8NJJdxVQ0qp";
const TRADER_ADDRESS = "0x63ce342161250d705dc0b16df89036c8e5f9ba9a";
const CTF_EXCHANGE = "0x4bFB41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";
const OUTPUT_DIR = path.join(process.cwd(), "web/content/docs/lobstah-trader/trader-spotlights", TRADER_ADDRESS);
const OUTPUT_FILE_TRAWL = path.join(OUTPUT_DIR, "polymarket-trades.ts");

const client = createPublicClient({
    chain: polygon,
    transport: http(RPC_URL),
});

const ORDER_FILLED_ABI = parseAbiItem('event OrderFilled(bytes32 indexed orderHash, address indexed maker, address indexed taker, uint256 makerAssetId, uint256 takerAssetId, uint256 makerAmountFilled, uint256 takerAmountFilled, uint256 fee)');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function deepTrawl() {
    console.log(`🦞 LobstahScout: INCREMENTAL TRAWL (V3.1) for ${TRADER_ADDRESS}...`);

    try {
        let existingTrades: any[] = [];
        let lastBlock = 82500000n; // Start closer to modern history if no checkpoint

        if (fs.existsSync(OUTPUT_FILE_TRAWL)) {
            const content = fs.readFileSync(OUTPUT_FILE_TRAWL, 'utf-8');
            const match = content.match(/"trades":\s*\[([\s\S]*)\]/);
            if (match) {
                existingTrades = JSON.parse("[" + match[1] + "]");
                if (existingTrades.length > 0) {
                    const maxBlock = Math.max(...existingTrades.map(t => parseInt(t.blockNumber)));
                    lastBlock = BigInt(maxBlock);
                    console.log(`📍 Checkpoint found: Resuming from block ${lastBlock}`);
                }
            }
        }

        const currentBlock = await client.getBlockNumber();
        let allNewTrades: any[] = [];
        let fromBlock = lastBlock + 1n;
        const step = 1000n; 
        
        while (fromBlock < currentBlock) {
            let toBlock = fromBlock + step;
            if (toBlock > currentBlock) toBlock = currentBlock;

            console.log(`📡 Scanning [${fromBlock.toString()} -> ${toBlock.toString()}]...`);

            try {
                // Parallel fetch for maker/taker roles
                const [mLogs, tLogs] = await Promise.all([
                    client.getLogs({ address: CTF_EXCHANGE, event: ORDER_FILLED_ABI, args: { maker: TRADER_ADDRESS as `0x${string}` }, fromBlock, toBlock }),
                    client.getLogs({ address: CTF_EXCHANGE, event: ORDER_FILLED_ABI, args: { taker: TRADER_ADDRESS as `0x${string}` }, fromBlock, toBlock })
                ]);

                const combined = [...mLogs, ...tLogs];

                if (combined.length > 0) {
                    const batch = combined.map(log => {
                        const isMaker = log.args.maker?.toLowerCase() === TRADER_ADDRESS.toLowerCase();
                        const mAsset = log.args.makerAssetId?.toString();
                        const tAsset = log.args.takerAssetId?.toString();
                        const mAmount = Number(log.args.makerAmountFilled);
                        const tAmount = Number(log.args.takerAmountFilled);

                        const isBuy = isMaker ? (mAsset === "0") : (tAsset === "0");
                        const assetId = isMaker ? (isBuy ? tAsset : mAsset) : (isBuy ? mAsset : tAsset);
                        const price = isMaker ? (isBuy ? mAmount/tAmount : tAmount/mAmount) : (isBuy ? tAmount/mAmount : mAmount/tAmount);
                        const size = isMaker ? (isBuy ? tAmount : mAmount)/1e6 : (isBuy ? mAmount : tAmount)/1e6;

                        return {
                            proxyWallet: TRADER_ADDRESS,
                            side: isBuy ? "BUY" : "SELL", 
                            asset: assetId,
                            size: parseFloat(size.toFixed(6)),
                            price: parseFloat(price.toFixed(4)),
                            transactionHash: log.transactionHash,
                            logIndex: log.logIndex,
                            blockNumber: log.blockNumber?.toString()
                        };
                    });
                    allNewTrades = [...allNewTrades, ...batch];
                }

                fromBlock = toBlock + 1n;
                await sleep(300); // Throttled to respect Infura limits
            } catch (err: any) {
                console.log(`⚠️ Block range failed: ${err.message}. Retrying in 5s...`);
                await sleep(5000);
            }
        }

        const masterMap = new Map();
        [...existingTrades, ...allNewTrades].forEach(t => {
            const key = `${t.transactionHash}-${t.logIndex}`;
            masterMap.set(key, t);
        });

        const merged = Array.from(masterMap.values()).sort((a, b) => parseInt(a.blockNumber) - parseInt(b.blockNumber));

        const fileContent = `export const trawlData = {
    address: "${TRADER_ADDRESS}",
    lastUpdated: "${new Date().toISOString()}",
    trades: ${JSON.stringify(merged, null, 4)}
};`;

        fs.writeFileSync(OUTPUT_FILE_TRAWL, fileContent);
        console.log(`✅ Success! Archive size: ${merged.length} unique trades.`);

    } catch (error) {
        console.error("❌ Trawl failed:", error);
    }
}

deepTrawl();
