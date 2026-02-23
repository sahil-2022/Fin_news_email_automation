require('dotenv').config();
const { getMarketData } = require('./scrapers/marketData');
const { getFIIDIIData } = require('./scrapers/fiiDiiData');
const { getMarketNews } = require('./scrapers/newsData');
const {
    getSectorPerformance,
    get52WeekBreakers,
    getMostActiveByVolume,
    getIndiaVIX,
    calculateSentiment,
    getGlobalMarkets,
    getForexData,
    getCommodityPrices,
} = require('./scrapers/enhancedData');
const {
    getSupportResistance,
    getTrendingStocks,
    getIPOCalendar,
    getEarningsCalendar,
    getMutualFundNAV,
    generateAISummary,
} = require('./scrapers/advancedData');
const { generateEmailHTML } = require('./email/template');
const { sendEmail } = require('./email/sender');

async function runPipeline() {
    const startTime = Date.now();
    console.log(`
============================================================
🚀 FINews Pipeline Started (14 Features)
📅 ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
============================================================
`);

    try {
        // Phase 1: Core data (parallel)
        console.log('--- Phase 1: Core Data ---');
        const [marketResult, fiiDiiResult, newsResult] = await Promise.allSettled([
            getMarketData(),
            getFIIDIIData(),
            getMarketNews(),
        ]);

        const marketData = marketResult.status === 'fulfilled' ? marketResult.value : null;
        const fiiDiiData = fiiDiiResult.status === 'fulfilled' ? fiiDiiResult.value : null;
        const newsData = newsResult.status === 'fulfilled' ? newsResult.value : [];

        // Phase 2: Enhanced data (parallel)
        console.log('\n--- Phase 2: Enhanced Data ---');
        const [sectorResult, vixResult, globalResult, forexResult, commodityResult] = await Promise.allSettled([
            getSectorPerformance(),
            getIndiaVIX(),
            getGlobalMarkets(),
            getForexData(),
            getCommodityPrices(),
        ]);

        const sectorData = sectorResult.status === 'fulfilled' ? sectorResult.value : [];
        const vixData = vixResult.status === 'fulfilled' ? vixResult.value : null;
        const globalMarkets = globalResult.status === 'fulfilled' ? globalResult.value : [];
        const forexData = forexResult.status === 'fulfilled' ? forexResult.value : [];
        const commodityData = commodityResult.status === 'fulfilled' ? commodityResult.value : [];

        // Phase 3: Advanced data (parallel)
        console.log('\n--- Phase 3: Advanced Data ---');
        const [srResult, trendResult, ipoResult, earningsResult, mfResult] = await Promise.allSettled([
            getSupportResistance(),
            getTrendingStocks(),
            getIPOCalendar(),
            getEarningsCalendar(),
            getMutualFundNAV(),
        ]);

        const supportResistance = srResult.status === 'fulfilled' ? srResult.value : [];
        const trendingStocks = trendResult.status === 'fulfilled' ? trendResult.value : [];
        const ipoCalendar = ipoResult.status === 'fulfilled' ? ipoResult.value : [];
        const earningsCalendar = earningsResult.status === 'fulfilled' ? earningsResult.value : [];
        const mutualFunds = mfResult.status === 'fulfilled' ? mfResult.value : [];

        // Derived: 52-week and volume from ALL stock data
        const allStockQuotes = marketData?.allStocks || [];
        const fiftyTwoWeek = await get52WeekBreakers(allStockQuotes);
        const mostActive = getMostActiveByVolume(allStockQuotes);

        // Derived: Sentiment
        const niftyPChange = marketData?.nifty50?.summary?.pChange || 0;
        const sentiment = calculateSentiment(vixData, niftyPChange, null);

        // Phase 4: AI Summary
        console.log('\n--- Phase 4: AI Summary ---');
        const aiSummary = await generateAISummary({
            marketData, fiiDiiData, sectorData, globalMarkets, vixData,
        });

        // Compile all data
        const allData = {
            marketData,
            fiiDiiData,
            newsData,
            sectorData,
            vixData,
            sentiment,
            globalMarkets,
            forexData,
            commodityData,
            supportResistance,
            trendingStocks,
            ipoCalendar,
            earningsCalendar,
            mutualFunds,
            fiftyTwoWeek,
            mostActive,
            aiSummary,
        };

        // Status summary
        console.log('\n📋 Data Collection Summary:');
        console.log(`  • Market Data:     ${marketData ? '✅' : '❌'}`);
        console.log(`  • FII/DII:         ${fiiDiiData ? '✅' : '❌'}`);
        console.log(`  • News:            ✅ (${newsData.length} articles)`);
        console.log(`  • Sectors:         ✅ (${sectorData.length} sectors)`);
        console.log(`  • India VIX:       ${vixData ? `✅ (${vixData.value})` : '❌'}`);
        console.log(`  • Sentiment:       ✅ ${sentiment.emoji} ${sentiment.label} (${sentiment.score}/100)`);
        console.log(`  • Global Markets:  ✅ (${globalMarkets.length} indices)`);
        console.log(`  • Forex:           ✅ (${forexData.length} pairs)`);
        console.log(`  • Commodities:     ✅ (${commodityData.length} items)`);
        console.log(`  • Support/Resist:  ✅ (${supportResistance.length} indices)`);
        console.log(`  • Trending:        ✅ (${trendingStocks.length} stocks)`);
        console.log(`  • IPO Calendar:    ✅ (${ipoCalendar.length} IPOs)`);
        console.log(`  • Earnings:        ✅ (${earningsCalendar.length} companies)`);
        console.log(`  • MF NAVs:         ✅ (${mutualFunds.length} funds)`);
        console.log(`  • AI Summary:      ✅ (${aiSummary.source})`);
        console.log(`  • 52-Week H/L:     ✅ (${fiftyTwoWeek.highs.length}H / ${fiftyTwoWeek.lows.length}L)`);
        console.log(`  • Most Active:     ✅ (${mostActive.length} stocks)`);

        // Generate & send
        console.log('\n📝 Generating email...');
        const html = generateEmailHTML(allData);

        console.log('📧 Sending email...');
        await sendEmail(html);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n✅ Pipeline completed in ${elapsed}s`);
        console.log('============================================================\n');

    } catch (error) {
        console.error('\n❌ Pipeline failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// CLI support
if (process.argv.includes('--now')) {
    runPipeline();
}

module.exports = { runPipeline };
