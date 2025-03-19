// js/api/external-news-api.js

// News API Configuration
const NEWS_API_KEY = 'your_api_key_here'; // Replace with your actual API key
const NEWS_API_URL = 'https://newsapi.org/v2';

// Simple caching mechanism to avoid hitting API limits
const cache = {
  data: {},
  timestamp: {},
  maxAge: 15 * 60 * 1000, // 15 minutes in milliseconds
  
  get(key) {
    const now = Date.now();
    if (this.timestamp[key] && (now - this.timestamp[key] < this.maxAge)) {
      return this.data[key];
    }
    return null;
  },
  
  set(key, data) {
    this.data[key] = data;
    this.timestamp[key] = Date.now();
  }
};

/**
 * Fetch news articles from the external API
 * @param {string} category - News category (optional)
 * @param {number} count - Number of articles to fetch (default: 10)
 * @returns {Promise<Array>} - Array of news articles
 */
export async function getExternalNews(category = null, count = 10) {
  const cacheKey = `news_${category || 'all'}_${count}`;
  
  // Check cache first
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    console.log('Using cached news data');
    return cachedData;
  }
  
  try {
    // Build URL with appropriate parameters
    let endpoint = '/top-headlines';
    let params = new URLSearchParams({
      apiKey: NEWS_API_KEY,
      pageSize: count,
      language: 'en'
    });
    
    // Add category if provided and not 'all'
    if (category && category !== 'all') {
      params.append('category', mapCategoryToAPI(category));
    } else {
      // Default to general news if no category specified
      params.append('category', 'general');
    }
    
    // Make the API request
    const response = await fetch(`${NEWS_API_URL}${endpoint}?${params.toString()}`);
    
    // Check if response is OK
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
    }
    
    // Parse the JSON response
    const data = await response.json();
    
    if (data.status !== 'ok') {
      throw new Error(`API returned error: ${data.message || 'Unknown error'}`);
    }
    
    // Transform the API data to match our application's format
    const articles = data.articles.map(article => ({
      id: generateIdFromUrl(article.url),
      title: article.title,
      content: article.content || article.description,
      excerpt: truncateText(article.description || '', 150),
      image: article.urlToImage || 'img/placeholder.jpg',
      publishDate: new Date(article.publishedAt),
      source: article.source.name,
      url: article.url,
      category: 'news',
      subcategory: mapAPIToCategory(article.source.name, category || 'general'),
      breaking: false
    }));
    
    // Cache the results before returning
    cache.set(cacheKey, articles);
    
    return articles;
  } catch (error) {
    console.error('Error fetching external news:', error);
    
    // Return fallback data in case of error
    return getFallbackNewsData(category, count);
  }
}

/**
 * Fetch breaking news from the external API
 * @param {number} count - Number of articles to fetch (default: 5)
 * @returns {Promise<Array>} - Array of breaking news articles
 */
export async function getExternalBreakingNews(count = 5) {
  const cacheKey = `breaking_news_${count}`;
  
  // Check cache first
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    console.log('Using cached breaking news data');
    return cachedData;
  }
  
  try {
    // Breaking news typically uses top headlines with appropriate parameters
    const params = new URLSearchParams({
      apiKey: NEWS_API_KEY,
      pageSize: count,
      language: 'en',
      category: 'general' // General news for breaking
    });
    
    const response = await fetch(`${NEWS_API_URL}/top-headlines?${params.toString()}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    
    if (data.status !== 'ok') {
      throw new Error(`API returned error: ${data.message || 'Unknown error'}`);
    }
    
    // Mark these as breaking news
    const breakingNews = data.articles.map(article => ({
      id: generateIdFromUrl(article.url),
      title: article.title,
      content: article.content || article.description,
      excerpt: truncateText(article.description || '', 100),
      image: article.urlToImage || 'img/placeholder.jpg',
      publishDate: new Date(article.publishedAt),
      source: article.source.name,
      url: article.url,
      category: 'news',
      subcategory: mapAPIToCategory(article.source.name, 'general'),
      breaking: true
    }));
    
    // Cache the results
    cache.set(cacheKey, breakingNews);
    
    return breakingNews;
  } catch (error) {
    console.error('Error fetching breaking news:', error);
    
    // Return fallback breaking news in case of error
    return getFallbackBreakingNews(count);
  }
}

/**
 * Search for news articles
 * @param {string} query - Search query
 * @param {number} count - Number of articles to fetch (default: 20)
 * @returns {Promise<Array>} - Array of news articles matching the search
 */
export async function searchNews(query, count = 20) {
  if (!query || query.trim() === '') {
    return [];
  }
  
  const cacheKey = `search_${query.trim().toLowerCase()}_${count}`;
  
  // Check cache first
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    console.log('Using cached search results');
    return cachedData;
  }
  
  try {
    const params = new URLSearchParams({
      apiKey: NEWS_API_KEY,
      q: query.trim(),
      pageSize: count,
      language: 'en',
      sortBy: 'relevancy'
    });
    
    const response = await fetch(`${NEWS_API_URL}/everything?${params.toString()}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    
    if (data.status !== 'ok') {
      throw new Error(`API returned error: ${data.message || 'Unknown error'}`);
    }
    
    const searchResults = data.articles.map(article => ({
      id: generateIdFromUrl(article.url),
      title: article.title,
      content: article.content || article.description,
      excerpt: truncateText(article.description || '', 150),
      image: article.urlToImage || 'img/placeholder.jpg',
      publishDate: new Date(article.publishedAt),
      source: article.source.name,
      url: article.url,
      category: 'news',
      subcategory: mapAPIToCategory(article.source.name, 'general'),
      breaking: false
    }));
    
    // Cache the results
    cache.set(cacheKey, searchResults);
    
    return searchResults;
  } catch (error) {
    console.error('Error searching news:', error);
    return [];
  }
}

/**
 * Generate a unique ID from a URL
 * @param {string} url - The URL to generate an ID from
 * @returns {string} - A unique ID
 */
function generateIdFromUrl(url) {
  // Create a simple hash from the URL
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash) + url.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return 'news_' + Math.abs(hash).toString(16);
}

/**
 * Map our category to the API's category
 * @param {string} category - Our internal category
 * @returns {string} - API category
 */
function mapCategoryToAPI(category) {
  const categoryMap = {
    'world': 'general',
    'politics': 'politics',
    'business': 'business',
    'technology': 'technology',
    'science': 'science',
    'health': 'health',
    'sports': 'sports',
    'entertainment': 'entertainment',
    'environment': 'science' // Map environment to science as it's closest
  };
  
  return categoryMap[category] || 'general';
}

/**
 * Map API source to our subcategory format
 * @param {string} source - Source name from API
 * @param {string} defaultCategory - Default category if mapping fails
 * @returns {string} - Our subcategory
 */
function mapAPIToCategory(source, defaultCategory) {
  // This is a simple guess based on the source name
  // In a real app, you might have a more sophisticated mapping
  const sourceMap = {
    'CNN': 'politics',
    'BBC': 'world',
    'The Wall Street Journal': 'business',
    'Wired': 'technology',
    'National Geographic': 'science',
    'ESPN': 'sports',
    'The New York Times': 'world',
    'TechCrunch': 'technology',
    'Financial Times': 'business',
    'Medical News Today': 'health',
    'Entertainment Weekly': 'entertainment'
  };
  
  // Check for keywords in the source name for better matching
  const sourceLower = source.toLowerCase();
  if (sourceLower.includes('tech')) return 'technology';
  if (sourceLower.includes('health') || sourceLower.includes('medical')) return 'health';
  if (sourceLower.includes('business') || sourceLower.includes('finance') || sourceLower.includes('economic')) return 'business';
  if (sourceLower.includes('sport')) return 'sports';
  if (sourceLower.includes('entertainment') || sourceLower.includes('hollywood')) return 'entertainment';
  if (sourceLower.includes('science') || sourceLower.includes('nature')) return 'science';
  if (sourceLower.includes('politic')) return 'politics';
  
  return sourceMap[source] || defaultCategory;
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  // Truncate at the last space before maxLength to avoid cutting words
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > 0) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

/**
 * Get fallback news data when API fails
 * @param {string} category - Category for filtering
 * @param {number} count - Number of articles to return
 * @returns {Array} - Fallback news articles
 */
function getFallbackNewsData(category = null, count = 10) {
  const fallbackArticles = [
    {
      id: 'fallback_1',
      title: 'Global Economic Conference Sets New Trade Guidelines',
      content: 'Leaders from major economies have agreed on a framework to address trade imbalances and promote sustainable growth amid ongoing global challenges.',
      excerpt: 'Leaders from major economies have agreed on a framework to address trade imbalances and promote sustainable growth.',
      image: 'img/placeholder.jpg',
      publishDate: new Date(),
      source: 'International News Network',
      url: '#',
      category: 'news',
      subcategory: 'world',
      breaking: false
    },
    {
      id: 'fallback_2',
      title: 'New Breakthrough in Renewable Energy Storage',
      content: 'Scientists announce development of high-capacity battery technology that could revolutionize renewable energy adoption.',
      excerpt: 'Scientists announce development of high-capacity battery technology that could revolutionize renewable energy adoption.',
      image: 'img/placeholder.jpg',
      publishDate: new Date(Date.now() - 3600000), // 1 hour ago
      source: 'Science Today',
      url: '#',
      category: 'news',
      subcategory: 'technology',
      breaking: false
    },
    {
      id: 'fallback_3',
      title: 'Major Policy Reform Passes Legislative Vote',
      content: 'After months of debate, lawmakers have passed a comprehensive reform package aimed at addressing key social and economic issues.',
      excerpt: 'After months of debate, lawmakers have passed a comprehensive reform package.',
      image: 'img/placeholder.jpg',
      publishDate: new Date(Date.now() - 7200000), // 2 hours ago
      source: 'Politics Daily',
      url: '#',
      category: 'news',
      subcategory: 'politics',
      breaking: false
    },
    {
      id: 'fallback_4',
      title: 'Market Report: Tech Stocks Rise on Positive Earnings',
      content: 'Technology sector shows strong performance following better-than-expected quarterly results from major companies.',
      excerpt: 'Technology sector shows strong performance following better-than-expected quarterly results.',
      image: 'img/placeholder.jpg',
      publishDate: new Date(Date.now() - 10800000), // 3 hours ago
      source: 'Financial Review',
      url: '#',
      category: 'news',
      subcategory: 'business',
      breaking: false
    },
    {
      id: 'fallback_5',
      title: 'Health Researchers Announce Promising Clinical Trial Results',
      content: 'New treatment approach shows significant improvement in patient outcomes during phase 3 clinical trials.',
      excerpt: 'New treatment approach shows significant improvement in patient outcomes during phase 3 clinical trials.',
      image: 'img/placeholder.jpg',
      publishDate: new Date(Date.now() - 14400000), // 4 hours ago
      source: 'Health Journal',
      url: '#',
      category: 'news',
      subcategory: 'health',
      breaking: false
    },
    {
      id: 'fallback_6',
      title: 'Environmental Study Reveals Concerning Climate Trends',
      content: 'Research team publishes comprehensive data analysis showing accelerating environmental changes in key regions.',
      excerpt: 'Research team publishes comprehensive data analysis showing accelerating environmental changes.',
      image: 'img/placeholder.jpg',
      publishDate: new Date(Date.now() - 18000000), // 5 hours ago
      source: 'Environment Report',
      url: '#',
      category: 'news',
      subcategory: 'environment',
      breaking: false
    },
    {
      id: 'fallback_7',
      title: 'Championship Finals Set After Dramatic Semifinal Matches',
      content: 'The stage is set for an epic showdown between the top two teams following intense semifinal competition.',
      excerpt: 'The stage is set for an epic showdown between the top two teams following intense semifinal competition.',
      image: 'img/placeholder.jpg',
      publishDate: new Date(Date.now() - 21600000), // 6 hours ago
      source: 'Sports Center',
      url: '#',
      category: 'news',
      subcategory: 'sports',
      breaking: false
    },
    {
      id: 'fallback_8',
      title: 'Award-Winning Film Director Announces New Project',
      content: 'Acclaimed filmmaker reveals details about upcoming production featuring an all-star cast.',
      excerpt: 'Acclaimed filmmaker reveals details about upcoming production featuring an all-star cast.',
      image: 'img/placeholder.jpg',
      publishDate: new Date(Date.now() - 25200000), // 7 hours ago
      source: 'Entertainment Weekly',
      url: '#',
      category: 'news',
      subcategory: 'entertainment',
      breaking: false
    },
    {
      id: 'fallback_9',
      title: 'Tech Giant Unveils Revolutionary New Product Line',
      content: 'Leading technology company introduces innovative devices expected to set new industry standards.',
      excerpt: 'Leading technology company introduces innovative devices expected to set new industry standards.',
      image: 'img/placeholder.jpg',
      publishDate: new Date(Date.now() - 28800000), // 8 hours ago
      source: 'Tech Observer',
      url: '#',
      category: 'news',
      subcategory: 'technology',
      breaking: false
    },
    {
      id: 'fallback_10',
      title: 'International Summit Addresses Global Challenges',
      content: 'World leaders gather to discuss collaborative approaches to pressing international issues.',
      excerpt: 'World leaders gather to discuss collaborative approaches to pressing international issues.',
      image: 'img/placeholder.jpg',
      publishDate: new Date(Date.now() - 32400000), // 9 hours ago
      source: 'Global Affairs',
      url: '#',
      category: 'news',
      subcategory: 'world',
      breaking: false
    }
  ];
  
  // Filter by category if specified
  let filteredArticles = fallbackArticles;
  if (category && category !== 'all') {
    filteredArticles = fallbackArticles.filter(article => article.subcategory === category);
  }
  
  // Return limited number
  return filteredArticles.slice(0, count);
}

/**
 * Get fallback breaking news when API fails
 * @param {number} count - Number of articles to return
 * @returns {Array} - Fallback breaking news articles
 */
function getFallbackBreakingNews(count = 5) {
  const fallbackBreaking = [
    {
      id: 'breaking_1',
      title: 'Major Economic Policy Changes Announced by Central Bank',
      excerpt: 'Central bank introduces significant policy adjustments to address inflation concerns.',
      image: 'img/placeholder.jpg',
      publishDate: new Date(),
      source: 'Financial News',
      url: '#',
      category: 'news',
      subcategory: 'business',
      breaking: true
    },
    {
      id: 'breaking_2',
      title: 'Tech Giant Unveils Revolutionary New Product Line',
      excerpt: 'Leading technology company introduces innovative devices expected to set new industry standards.',
      image: 'img/placeholder.jpg',
      publishDate: new Date(Date.now() - 1800000), // 30 minutes ago
      source: 'Tech Observer',
      url: '#',
      category: 'news',
      subcategory: 'technology',
      breaking: true
    },
    {
      id: 'breaking_3',
      title: 'International Summit Concludes with Landmark Agreement',
      excerpt: 'Global leaders reach consensus on major international cooperation framework.',
      image: 'img/placeholder.jpg',
      publishDate: new Date(Date.now() - 3600000), // 1 hour ago
      source: 'World Affairs',
      url: '#',
      category: 'news',
      subcategory: 'world',
      breaking: true
    },
    {
      id: 'breaking_4',
      title: 'Breaking: Earthquake Reported in Coastal Region',
      excerpt: 'Authorities respond to seismic event, assessing damage and organizing relief efforts.',
      image: 'img/placeholder.jpg',
      publishDate: new Date(Date.now() - 5400000), // 1.5 hours ago
      source: 'Emergency News',
      url: '#',
      category: 'news',
      subcategory: 'environment',
      breaking: true
    },
    {
      id: 'breaking_5',
      title: 'Major Legislative Bill Passes in Surprise Vote',
      excerpt: 'Lawmakers approve significant legislation after intense debate and last-minute negotiations.',
      image: 'img/placeholder.jpg',
      publishDate: new Date(Date.now() - 7200000), // 2 hours ago
      source: 'Political Times',
      url: '#',
      category: 'news',
      subcategory: 'politics',
      breaking: true
    }
  ];
  
  return fallbackBreaking.slice(0, count);
}