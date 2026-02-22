/**
 * Web scraper module for Vistaprint product pages
 * Uses Puppeteer to handle JavaScript-rendered content
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import type { ProductImage, ScrapedProduct } from './types.js';

const CAROUSEL_SELECTORS = [
  // Common carousel/gallery selectors for product images
  '[data-testid="product-preview-carousel"] img',
  '[data-testid="gallery-carousel"] img',
  '.product-carousel img',
  '.product-gallery img',
  '.product-preview img',
  '[class*="carousel"] [class*="product"] img',
  '[class*="gallery"] img',
  '[class*="ProductImage"] img',
  '[class*="product-image"] img',
  // Vistaprint specific selectors
  '[data-automation="product-image"] img',
  '[class*="swiper"] img',
  '.swiper-slide img',
  // Generic fallbacks
  'main img[src*="scene7"]',
  'main img[src*="vistaprint"]',
  '[role="img"]',
];

let browserInstance: Browser | null = null;

/**
 * Get or create a shared browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });
  }
  return browserInstance;
}

/**
 * Close the shared browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Extract product images from a Vistaprint product page
 */
async function extractImages(page: Page): Promise<ProductImage[]> {
  const images: ProductImage[] = [];
  const seenUrls = new Set<string>();

  for (const selector of CAROUSEL_SELECTORS) {
    try {
      const elements = await page.$$(selector);
      
      for (let i = 0; i < elements.length; i++) {
        const imgData = await elements[i].evaluate((img: HTMLImageElement) => {
          // Get the highest resolution source
          const srcset = img.srcset;
          let bestSrc = img.src;
          
          if (srcset) {
            // Parse srcset and get the highest resolution
            const sources = srcset.split(',').map((s: string) => {
              const parts = s.trim().split(' ');
              const url = parts[0];
              const width = parts[1] ? parseInt(parts[1].replace('w', ''), 10) : 0;
              return { url, width };
            });
            sources.sort((a: { url: string; width: number }, b: { url: string; width: number }) => b.width - a.width);
            if (sources.length > 0 && sources[0].url) {
              bestSrc = sources[0].url;
            }
          }

          // Also check for data-src (lazy loading)
          const dataSrc = img.getAttribute('data-src');
          if (dataSrc && !bestSrc) {
            bestSrc = dataSrc;
          }

          return {
            url: bestSrc,
            alt: img.alt || '',
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
          };
        });

        // Filter out small images, icons, and duplicates
        if (
          imgData.url &&
          !seenUrls.has(imgData.url) &&
          !imgData.url.includes('icon') &&
          !imgData.url.includes('logo') &&
          (imgData.width === 0 || imgData.width >= 200)
        ) {
          seenUrls.add(imgData.url);
          images.push({
            ...imgData,
            index: images.length,
          });
        }
      }

      // If we found images with the current selector, we might have enough
      if (images.length >= 3) {
        break;
      }
    } catch {
      // Selector not found, continue to next
      continue;
    }
  }

  return images;
}

/**
 * Extract product name from the page
 */
async function extractProductName(page: Page): Promise<string> {
  const nameSelectors = [
    'h1',
    '[data-testid="product-title"]',
    '[data-automation="product-name"]',
    '.product-title',
    '.product-name',
    '[class*="ProductName"]',
    '[class*="product-name"]',
  ];

  for (const selector of nameSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const text = await element.evaluate((el: Element) => el.textContent?.trim() || '');
        if (text && text.length > 0 && text.length < 200) {
          return text;
        }
      }
    } catch {
      continue;
    }
  }

  return 'Unknown Product';
}

/**
 * Scrape a Vistaprint product page
 */
export async function scrapeProductPage(url: string): Promise<ScrapedProduct> {
  // Validate URL
  if (!url.includes('vistaprint.com')) {
    throw new Error('URL must be a vistaprint.com page');
  }

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Set a realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    );

    // Navigate to the page
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for potential lazy-loaded content
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));

    // Try to scroll to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, 500);
    });
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));

    // Extract data
    const [productName, images] = await Promise.all([
      extractProductName(page),
      extractImages(page),
    ]);

    if (images.length === 0) {
      throw new Error('No product images found on the page');
    }

    return {
      sourceUrl: url,
      productName,
      images,
      scrapedAt: new Date(),
    };
  } finally {
    await page.close();
  }
}

/**
 * Scrape multiple product pages
 */
export async function scrapeMultiplePages(urls: string[]): Promise<{
  results: ScrapedProduct[];
  errors: Array<{ url: string; error: string }>;
}> {
  const results: ScrapedProduct[] = [];
  const errors: Array<{ url: string; error: string }> = [];

  for (const url of urls) {
    try {
      console.log(`Scraping: ${url}`);
      const result = await scrapeProductPage(url);
      results.push(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error scraping ${url}: ${errorMessage}`);
      errors.push({ url, error: errorMessage });
    }
  }

  return { results, errors };
}
