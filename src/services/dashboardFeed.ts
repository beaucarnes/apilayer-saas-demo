import { ApiClient, safeError } from '../apiClient.js';
import { endpoints } from '../config.js';
import { marketSchema, newsSchema } from '../schemas.js';

export async function getDashboardFeeds(client: ApiClient, ticker: string, newsCategory = 'technology,business') {
  const symbol = ticker.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9.^-]{0,19}$/.test(symbol)) throw new Error('Provide one valid ticker symbol.');
  const categories = newsCategory.split(',');
  if (!categories.every((value) => ['general', 'business', 'entertainment', 'health', 'science', 'sports', 'technology'].includes(value))) {
    throw new Error('Provide supported news categories.');
  }

  // Both requests start together. An optional widget outage does not lose the other result.
  const [marketResult, newsResult] = await Promise.allSettled([
    client.get('marketstack', endpoints.marketstack, { symbols: symbol, limit: '1' }, marketSchema),
    client.get('mediastack', endpoints.mediastack, {
      categories: newsCategory, languages: 'en', limit: '5', sort: 'published_desc',
    }, newsSchema),
  ]);
  const quote = marketResult.status === 'fulfilled'
    ? marketResult.value.data.find((item) => item.symbol.toUpperCase() === symbol) ?? null : null;
  const articles = newsResult.status === 'fulfilled' ? newsResult.value.data.slice(0, 5) : [];
  const warnings: string[] = [];
  if (marketResult.status === 'rejected') warnings.push(safeError(marketResult.reason));
  if (newsResult.status === 'rejected') warnings.push(safeError(newsResult.reason));
  return {
    market: {
      status: marketResult.status === 'rejected' ? 'unavailable' : quote ? 'available' : 'empty',
      kind: 'end_of_day',
      quote,
    },
    news: {
      status: newsResult.status === 'rejected' ? 'unavailable' : articles.length ? 'available' : 'empty',
      freshness: 'Plan-dependent; inspect published_at', articles,
    },
    warnings,
  };
}
