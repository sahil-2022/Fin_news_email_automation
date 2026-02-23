const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// ===== SECTORAL INDICES =====
const SECTOR_INDICES = {
    'IT': '^CNXIT',
    'Banking': '^NSEBANK',
    'Pharma': '^CNXPHARMA',
    'Auto': '^CNXAUTO',
    'FMCG': '^CNXFMCG',
    'Metal': '^CNXMETAL',
    'Realty': '^CNXREALTY',
    'Energy': '^CNXENERGY',
    'Infra': '^CNXINFRA',
    'PSU Bank': '^CNXPSUBANK',
    'Media': '^CNXMEDIA',
    'Financial': '^CNXFIN',
};

// ===== GLOBAL MARKET INDICES =====
const GLOBAL_INDICES = {
    'S&P 500': '^GSPC',
    'NASDAQ': '^IXIC',
    'Dow Jones': '^DJI',
    'Nikkei 225': '^N225',
    'Hang Seng': '^HSI',
    'Shanghai': '000001.SS',
    'FTSE 100': '^FTSE',
    'DAX': '^GDAXI',
};

// ===== COMMODITY & FOREX =====
const COMMODITIES = {
    'Crude Oil (WTI)': 'CL=F',
    'Brent Crude': 'BZ=F',
    'Gold': 'GC=F',
    'Silver': 'SI=F',
    'Natural Gas': 'NG=F',
};

const FOREX = {
    'USD/INR': 'USDINR=X',
    'EUR/INR': 'EURINR=X',
    'GBP/INR': 'GBPINR=X',
};

// VIX
const INDIA_VIX_SYMBOL = '^INDIAVIX';

/**
 * Fetch a batch of quotes safely
 */
async function fetchQuoteBatch(symbolMap) {
    const results = {};
    const entries = Object.entries(symbolMap);

    const promises = entries.map(async ([name, symbol]) => {
        try {
            const quote = await yahooFinance.quote(symbol);
            results[name] = {
                name,
                symbol,
                price: quote.regularMarketPrice,
                change: quote.regularMarketChange,
                pChange: quote.regularMarketChangePercent,
                open: quote.regularMarketOpen,
                high: quote.regularMarketDayHigh,
                low: quote.regularMarketDayLow,
                prevClose: quote.regularMarketPreviousClose,
                volume: quote.regularMarketVolume,
                fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
                fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
            };
        } catch (err) {
            console.warn(`  ⚠️ Failed to fetch ${name} (${symbol}): ${err.message}`);
        }
    });

    await Promise.all(promises);
    return results;
}

// ============================
// FEATURE 1: Sector Performance
// ============================
async function getSectorPerformance() {
    console.log('📊 Fetching sector performance...');
    try {
        const data = await fetchQuoteBatch(SECTOR_INDICES);
        const sectors = Object.values(data)
            .filter(s => s.price)
            .sort((a, b) => (b.pChange || 0) - (a.pChange || 0));

        console.log(`✅ Sector data: ${sectors.length} sectors`);
        return sectors;
    } catch (error) {
        console.error('❌ Sector performance error:', error.message);
        return [];
    }
}

// ============================
// FEATURE 2: 52-Week High/Low
// ============================
async function get52WeekBreakers(niftyStockQuotes) {
    console.log('📊 Finding 52-week highs/lows...');
    try {
        if (!niftyStockQuotes || niftyStockQuotes.length === 0) return { highs: [], lows: [] };

        const highs = [];
        const lows = [];

        for (const stock of niftyStockQuotes) {
            if (!stock.price || !stock.fiftyTwoWeekHigh || !stock.fiftyTwoWeekLow) continue;

            const highProximity = ((stock.price / stock.fiftyTwoWeekHigh) * 100);
            const lowProximity = ((stock.price / stock.fiftyTwoWeekLow) * 100);

            if (highProximity >= 98) {
                highs.push({ ...stock, proximity: highProximity.toFixed(1) });
            }
            if (lowProximity <= 103) {
                lows.push({ ...stock, proximity: lowProximity.toFixed(1) });
            }
        }

        highs.sort((a, b) => b.proximity - a.proximity);
        lows.sort((a, b) => a.proximity - b.proximity);

        console.log(`✅ 52-week: ${highs.length} near highs, ${lows.length} near lows`);
        return { highs: highs.slice(0, 5), lows: lows.slice(0, 5) };
    } catch (error) {
        console.error('❌ 52-week error:', error.message);
        return { highs: [], lows: [] };
    }
}

// ============================
// FEATURE 3: Most Active by Volume
// ============================
function getMostActiveByVolume(niftyStockQuotes) {
    console.log('📊 Finding most active stocks...');
    try {
        if (!niftyStockQuotes || niftyStockQuotes.length === 0) return [];

        const sorted = [...niftyStockQuotes]
            .filter(s => s.volume && s.volume > 0)
            .sort((a, b) => (b.volume || 0) - (a.volume || 0))
            .slice(0, 5);

        console.log(`✅ Most active: ${sorted.length} stocks`);
        return sorted;
    } catch (error) {
        console.error('❌ Volume error:', error.message);
        return [];
    }
}

// ============================
// FEATURE 4 & 5: India VIX + Sentiment
// ============================
async function getIndiaVIX() {
    console.log('📊 Fetching India VIX...');
    try {
        const quote = await yahooFinance.quote(INDIA_VIX_SYMBOL);
        const vix = {
            value: quote.regularMarketPrice,
            change: quote.regularMarketChange,
            pChange: quote.regularMarketChangePercent,
            high: quote.regularMarketDayHigh,
            low: quote.regularMarketDayLow,
        };
        console.log(`✅ India VIX: ${vix.value}`);
        return vix;
    } catch (error) {
        console.error('❌ VIX error:', error.message);
        return null;
    }
}

function calculateSentiment(vix, niftyChange, advanceDeclineRatio) {
    // Score from 0 (extreme fear) to 100 (extreme greed)
    let score = 50;
    let label = 'Neutral';

    if (vix) {
        if (vix.value < 12) score += 20;
        else if (vix.value < 15) score += 10;
        else if (vix.value > 25) score -= 20;
        else if (vix.value > 20) score -= 10;

        if (vix.pChange < -5) score += 5;
        if (vix.pChange > 5) score -= 5;
    }

    if (niftyChange) {
        if (niftyChange > 1.5) score += 15;
        else if (niftyChange > 0.5) score += 8;
        else if (niftyChange < -1.5) score -= 15;
        else if (niftyChange < -0.5) score -= 8;
    }

    if (advanceDeclineRatio) {
        if (advanceDeclineRatio > 2) score += 10;
        else if (advanceDeclineRatio > 1.2) score += 5;
        else if (advanceDeclineRatio < 0.5) score -= 10;
        else if (advanceDeclineRatio < 0.8) score -= 5;
    }

    score = Math.max(0, Math.min(100, score));

    if (score >= 80) label = 'Extreme Greed';
    else if (score >= 60) label = 'Greed';
    else if (score >= 45) label = 'Neutral';
    else if (score >= 25) label = 'Fear';
    else label = 'Extreme Fear';

    const emoji = score >= 60 ? '🐂' : score >= 45 ? '😐' : '🐻';

    return { score, label, emoji };
}

// ============================
// FEATURE 7: Global Markets
// ============================
async function getGlobalMarkets() {
    console.log('🌍 Fetching global markets...');
    try {
        const data = await fetchQuoteBatch(GLOBAL_INDICES);
        console.log(`✅ Global markets: ${Object.keys(data).length} indices`);
        return Object.values(data).filter(d => d.price);
    } catch (error) {
        console.error('❌ Global markets error:', error.message);
        return [];
    }
}

// ============================
// FEATURE 8: USD/INR & Forex
// ============================
async function getForexData() {
    console.log('💱 Fetching forex rates...');
    try {
        const data = await fetchQuoteBatch(FOREX);
        console.log(`✅ Forex: ${Object.keys(data).length} pairs`);
        return Object.values(data).filter(d => d.price);
    } catch (error) {
        console.error('❌ Forex error:', error.message);
        return [];
    }
}

// ============================
// FEATURE 9: Commodities
// ============================
async function getCommodityPrices() {
    console.log('🛢️ Fetching commodity prices...');
    try {
        const data = await fetchQuoteBatch(COMMODITIES);
        console.log(`✅ Commodities: ${Object.keys(data).length} items`);
        return Object.values(data).filter(d => d.price);
    } catch (error) {
        console.error('❌ Commodity error:', error.message);
        return [];
    }
}

module.exports = {
    getSectorPerformance,
    get52WeekBreakers,
    getMostActiveByVolume,
    getIndiaVIX,
    calculateSentiment,
    getGlobalMarkets,
    getForexData,
    getCommodityPrices,
};
