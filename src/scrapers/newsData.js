const axios = require('axios');
const cheerio = require('cheerio');

const NEWS_SOURCES = [
    {
        name: 'Economic Times',
        url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
        type: 'rss',
        icon: '📰',
    },
    {
        name: 'Google News',
        url: 'https://news.google.com/rss/search?q=indian+stock+market+nifty+sensex+when:1d&hl=en-IN&gl=IN&ceid=IN:en',
        type: 'rss',
        icon: '🔍',
    },
    {
        name: 'Livemint Markets',
        url: 'https://www.livemint.com/rss/markets',
        type: 'rss',
        icon: '📊',
    },
];

async function fetchRSSFeed(source) {
    try {
        const response = await axios.get(source.url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; FINews Bot/1.0)',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*',
            },
            timeout: 10000,
        });

        const $ = cheerio.load(response.data, { xmlMode: true });
        const items = [];

        $('item').each((i, el) => {
            if (i >= 8) return false;
            const title = $(el).find('title').text().trim();
            let link = $(el).find('link').text().trim();

            // For Google News RSS, the link is often wrapped in CDATA or is in the next sibling
            if (!link) {
                link = $(el).find('link').next().text().trim();
            }
            if (!link) {
                // Try getting it from guid
                link = $(el).find('guid').text().trim();
            }

            const pubDate = $(el).find('pubDate').text().trim();
            const description = $(el).find('description').text().trim();

            if (title) {
                items.push({
                    title: cleanText(title),
                    description: cleanText(description).substring(0, 150),
                    link: link || '#',
                    pubDate,
                    sourceName: source.name,
                    sourceIcon: source.icon,
                });
            }
        });

        return items;
    } catch (error) {
        console.error(`❌ Error fetching RSS from ${source.name}:`, error.message);
        return [];
    }
}

function cleanText(text) {
    return text
        .replace(/<!\[CDATA\[/g, '')
        .replace(/\]\]>/g, '')
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

function deduplicateNews(allNews) {
    const seen = new Set();
    return allNews.filter(item => {
        const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 60);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

async function getMarketNews() {
    console.log('📰 Fetching market news with links...');

    try {
        const allResults = await Promise.all(NEWS_SOURCES.map(fetchRSSFeed));
        const allNews = allResults.flat();
        const uniqueNews = deduplicateNews(allNews).slice(0, 10);

        console.log(`✅ Fetched ${uniqueNews.length} news articles with hyperlinks`);
        return uniqueNews;
    } catch (error) {
        console.error('❌ Error fetching market news:', error.message);
        return [];
    }
}

module.exports = { getMarketNews };
