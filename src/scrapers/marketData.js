const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// Nifty 50 constituent symbols on Yahoo Finance (top stocks by weight)
const NIFTY_50_SYMBOLS = [
  'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS',
  'HINDUNILVR.NS', 'ITC.NS', 'SBIN.NS', 'BHARTIARTL.NS', 'KOTAKBANK.NS',
  'LT.NS', 'AXISBANK.NS', 'ASIANPAINT.NS', 'MARUTI.NS', 'HCLTECH.NS',
  'SUNPHARMA.NS', 'TITAN.NS', 'BAJFINANCE.NS', 'ULTRACEMCO.NS', 'WIPRO.NS',
  'NESTLEIND.NS', 'ONGC.NS', 'NTPC.NS', 'POWERGRID.NS', 'M&M.NS',
  'TATAMOTORS.NS', 'ADANIENT.NS', 'ADANIPORTS.NS', 'TATASTEEL.NS', 'JSWSTEEL.NS',
  'DIVISLAB.NS', 'DRREDDY.NS', 'CIPLA.NS', 'APOLLOHOSP.NS', 'EICHERMOT.NS',
  'BAJAJFINSV.NS', 'TECHM.NS', 'INDUSINDBK.NS', 'HINDALCO.NS', 'GRASIM.NS',
  'TATACONSUM.NS', 'COALINDIA.NS', 'BPCL.NS', 'HEROMOTOCO.NS', 'BRITANNIA.NS',
  'SBILIFE.NS', 'HDFCLIFE.NS', 'BAJAJ-AUTO.NS', 'TRENT.NS', 'BEL.NS',
];

// Bank Nifty constituent symbols
const BANKNIFTY_SYMBOLS = [
  'HDFCBANK.NS', 'ICICIBANK.NS', 'SBIN.NS', 'KOTAKBANK.NS', 'AXISBANK.NS',
  'INDUSINDBK.NS', 'BANDHANBNK.NS', 'FEDERALBNK.NS', 'IDFCFIRSTB.NS',
  'PNB.NS', 'BANKBARODA.NS', 'AUBANK.NS',
];

// Index ticker symbols on Yahoo Finance
const INDEX_SYMBOLS = {
  nifty50: '^NSEI',      // Nifty 50 index
  bankNifty: '^NSEBANK',  // Bank Nifty index
};

async function fetchIndexSummary(symbol, name) {
  try {
    const quote = await yahooFinance.quote(symbol);

    return {
      name: name,
      last: quote.regularMarketPrice,
      change: quote.regularMarketChange,
      pChange: quote.regularMarketChangePercent,
      open: quote.regularMarketOpen,
      high: quote.regularMarketDayHigh,
      low: quote.regularMarketDayLow,
      previousClose: quote.regularMarketPreviousClose,
      advances: undefined, // Yahoo doesn't provide advance/decline
      declines: undefined,
      unchanged: undefined,
    };
  } catch (error) {
    console.error(`❌ Error fetching index ${name}:`, error.message);
    return null;
  }
}

async function fetchStockQuotes(symbols) {
  const results = [];

  // Fetch in batches of 10 to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const promises = batch.map(async (symbol) => {
      try {
        const quote = await yahooFinance.quote(symbol);
        return {
          symbol: symbol.replace('.NS', ''),
          name: quote.shortName || quote.longName || symbol.replace('.NS', ''),
          price: quote.regularMarketPrice,
          change: quote.regularMarketChange,
          pChange: quote.regularMarketChangePercent,
          open: quote.regularMarketOpen,
          high: quote.regularMarketDayHigh,
          low: quote.regularMarketDayLow,
          previousClose: quote.regularMarketPreviousClose,
          volume: quote.regularMarketVolume,
          fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
        };
      } catch (error) {
        console.warn(`⚠️ Skipping ${symbol}: ${error.message}`);
        return null;
      }
    });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter(r => r !== null));
  }

  return results;
}

function getTopGainersLosers(stocks, count = 5) {
  const sorted = [...stocks].sort((a, b) => (b.pChange || 0) - (a.pChange || 0));

  const gainers = sorted
    .filter(s => (s.pChange || 0) > 0)
    .slice(0, count);

  const losers = sorted
    .filter(s => (s.pChange || 0) < 0)
    .reverse()
    .slice(0, count);

  return { gainers, losers };
}

async function getMarketData() {
  console.log('📊 Fetching market data from Yahoo Finance...');

  try {
    // Fetch index summaries
    const [niftySummary, bankNiftySummary] = await Promise.all([
      fetchIndexSummary(INDEX_SYMBOLS.nifty50, 'NIFTY 50'),
      fetchIndexSummary(INDEX_SYMBOLS.bankNifty, 'NIFTY BANK'),
    ]);

    console.log('  ✅ Index data fetched');

    // Fetch constituent stock quotes
    const [niftyStocks, bankNiftyStocks] = await Promise.all([
      fetchStockQuotes(NIFTY_50_SYMBOLS),
      fetchStockQuotes(BANKNIFTY_SYMBOLS),
    ]);

    console.log(`  ✅ Stock quotes fetched: ${niftyStocks.length} Nifty + ${bankNiftyStocks.length} BankNifty`);

    const nifty50 = {
      summary: niftySummary,
      ...getTopGainersLosers(niftyStocks, 5),
    };

    const bankNifty = {
      summary: bankNiftySummary,
      ...getTopGainersLosers(bankNiftyStocks, 5),
    };

    // Deduplicated all stocks for 52-week and volume analysis
    const seenSymbols = new Set();
    const allStocks = [...niftyStocks, ...bankNiftyStocks].filter(s => {
      if (seenSymbols.has(s.symbol)) return false;
      seenSymbols.add(s.symbol);
      return true;
    });

    console.log('✅ Market data fetched successfully');
    return { nifty50, bankNifty, allStocks };
  } catch (error) {
    console.error('❌ Error fetching market data:', error.message);
    return {
      nifty50: { summary: null, gainers: [], losers: [] },
      bankNifty: { summary: null, gainers: [], losers: [] },
    };
  }
}

module.exports = { getMarketData };
