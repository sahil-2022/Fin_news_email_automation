/**
 * Railway Entry Point
 * Runs both the Express dashboard server AND the cron scheduler
 * in a single process — required for Railway's single-service model.
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const cron = require('node-cron');

// --- Import scrapers ---
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
const { runPipeline } = require('./index');

// --- Express Server (Dashboard + Health Check) ---
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint — Railway uses this to verify the service is alive
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        scheduler: 'active',
        nextRun: '7:00 PM IST (Mon-Sat)',
        timestamp: new Date().toISOString(),
    });
});

// Dashboard API (same as server.js)
app.get('/api/market-data', async (req, res) => {
    try {
        console.log('🔄 Fetching all 14-feature data for dashboard...');

        const [marketResult, fiiDiiResult, newsResult] = await Promise.allSettled([
            getMarketData(), getFIIDIIData(), getMarketNews(),
        ]);
        const marketData = marketResult.status === 'fulfilled' ? marketResult.value : null;
        const fiiDiiData = fiiDiiResult.status === 'fulfilled' ? fiiDiiResult.value : null;
        const newsData = newsResult.status === 'fulfilled' ? newsResult.value : [];

        const [sectorResult, vixResult, globalResult, forexResult, commodityResult] = await Promise.allSettled([
            getSectorPerformance(), getIndiaVIX(), getGlobalMarkets(), getForexData(), getCommodityPrices(),
        ]);
        const sectorData = sectorResult.status === 'fulfilled' ? sectorResult.value : [];
        const vixData = vixResult.status === 'fulfilled' ? vixResult.value : null;
        const globalMarkets = globalResult.status === 'fulfilled' ? globalResult.value : [];
        const forexData = forexResult.status === 'fulfilled' ? forexResult.value : [];
        const commodityData = commodityResult.status === 'fulfilled' ? commodityResult.value : [];

        const [srResult, trendResult, ipoResult, earningsResult, mfResult] = await Promise.allSettled([
            getSupportResistance(), getTrendingStocks(), getIPOCalendar(), getEarningsCalendar(), getMutualFundNAV(),
        ]);
        const supportResistance = srResult.status === 'fulfilled' ? srResult.value : [];
        const trendingStocks = trendResult.status === 'fulfilled' ? trendResult.value : [];
        const ipoCalendar = ipoResult.status === 'fulfilled' ? ipoResult.value : [];
        const earningsCalendar = earningsResult.status === 'fulfilled' ? earningsResult.value : [];
        const mutualFunds = mfResult.status === 'fulfilled' ? mfResult.value : [];

        const allStockQuotes = marketData?.allStocks || [];
        const fiftyTwoWeek = await get52WeekBreakers(allStockQuotes);
        const mostActive = getMostActiveByVolume(allStockQuotes);
        const niftyPChange = marketData?.nifty50?.summary?.pChange || 0;
        const sentiment = calculateSentiment(vixData, niftyPChange, null);
        const aiSummary = await generateAISummary({ marketData, fiiDiiData, sectorData, globalMarkets, vixData });

        res.json({
            success: true, timestamp: new Date().toISOString(),
            marketData, fiiDiiData, newsData, sectorData, vixData, sentiment,
            globalMarkets, forexData, commodityData, supportResistance,
            trendingStocks, ipoCalendar, earningsCalendar, mutualFunds,
            fiftyTwoWeek, mostActive, aiSummary,
        });
    } catch (error) {
        console.error('API error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`\n🚀 FINews Server running on port ${PORT}`);
    console.log(`   Dashboard: http://localhost:${PORT}`);
    console.log(`   Health:    http://localhost:${PORT}/health\n`);
});

// --- Cron Scheduler ---
const CRON_SCHEDULE = '0 19 * * 1-6'; // 7:00 PM IST, Mon-Sat

console.log('='.repeat(60));
console.log('📈 FINews Railway Service Started');
console.log(`⏰ Email scheduled at 7:00 PM IST (Mon-Sat)`);
console.log(`📧 Sending to: ${process.env.EMAIL_TO}`);
console.log('='.repeat(60));

const task = cron.schedule(CRON_SCHEDULE, () => {
    console.log(`\n⏰ Cron triggered at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    runPipeline().catch(err => {
        console.error('Pipeline error:', err.message);
    });
}, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    task.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down...');
    task.stop();
    process.exit(0);
});

console.log('✅ Server + Scheduler both running');
console.log('⏳ Next email trigger: 7:00 PM IST\n');
