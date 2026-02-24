const express = require('express');
const path = require('path');
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

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/market-data', async (req, res) => {
    try {
        console.log('🔄 Fetching all 14-feature data for dashboard...');

        // Phase 1
        const [marketResult, fiiDiiResult, newsResult] = await Promise.allSettled([
            getMarketData(), getFIIDIIData(), getMarketNews(),
        ]);
        const marketData = marketResult.status === 'fulfilled' ? marketResult.value : null;
        const fiiDiiData = fiiDiiResult.status === 'fulfilled' ? fiiDiiResult.value : null;
        const newsData = newsResult.status === 'fulfilled' ? newsResult.value : [];

        // Phase 2
        const [sectorResult, vixResult, globalResult, forexResult, commodityResult] = await Promise.allSettled([
            getSectorPerformance(), getIndiaVIX(), getGlobalMarkets(), getForexData(), getCommodityPrices(),
        ]);
        const sectorData = sectorResult.status === 'fulfilled' ? sectorResult.value : [];
        const vixData = vixResult.status === 'fulfilled' ? vixResult.value : null;
        const globalMarkets = globalResult.status === 'fulfilled' ? globalResult.value : [];
        const forexData = forexResult.status === 'fulfilled' ? forexResult.value : [];
        const commodityData = commodityResult.status === 'fulfilled' ? commodityResult.value : [];

        // Phase 3
        const [srResult, trendResult, ipoResult, earningsResult, mfResult] = await Promise.allSettled([
            getSupportResistance(), getTrendingStocks(marketData?.allStocks), getIPOCalendar(), getEarningsCalendar(), getMutualFundNAV(),
        ]);
        const supportResistance = srResult.status === 'fulfilled' ? srResult.value : [];
        const trendingStocks = trendResult.status === 'fulfilled' ? trendResult.value : [];
        const ipoCalendar = ipoResult.status === 'fulfilled' ? ipoResult.value : [];
        const earningsCalendar = earningsResult.status === 'fulfilled' ? earningsResult.value : [];
        const mutualFunds = mfResult.status === 'fulfilled' ? mfResult.value : [];

        // Derived
        const allStockQuotes = marketData?.allStocks || [];
        const fiftyTwoWeek = await get52WeekBreakers(allStockQuotes);
        const mostActive = getMostActiveByVolume(allStockQuotes);
        const niftyPChange = marketData?.nifty50?.summary?.pChange || 0;
        const sentiment = calculateSentiment(vixData, niftyPChange, null);
        const aiSummary = await generateAISummary({ marketData, fiiDiiData, sectorData, globalMarkets, vixData });

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            marketData, fiiDiiData, newsData,
            sectorData, vixData, sentiment,
            globalMarkets, forexData, commodityData,
            supportResistance, trendingStocks, ipoCalendar,
            earningsCalendar, mutualFunds, fiftyTwoWeek,
            mostActive, aiSummary,
        });
    } catch (error) {
        console.error('API error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`\n🚀 FINews Dashboard (14 Features) at http://localhost:${PORT}\n`);
});
