import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { Mutex } from 'async-mutex';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

const PLAYWRIGHT_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-blink-features=AutomationControlled',
];

const extractReadable = (
  html: string,
  url: string,
  fallbackTitle?: string,
): { content: string; title: string } => {
  const dom = new JSDOM(html, {
    url,
  });

  const article = new Readability(dom.window.document).parse();
  const title =
    fallbackTitle ||
    article?.title ||
    dom.window.document.querySelector('title')?.textContent?.trim() ||
    'No title';

  return {
    title,
    content: `
        # ${title} - ${url}
        ${article?.textContent?.trim() ?? 'No content available'}
        `,
  };
};

class Scraper {
  private static browser: any | undefined;
  private static playwrightUnavailable = false;
  private static IDLE_KILL_TIMEOUT = 30000;
  private static NAVIGATION_TIMEOUT = 20000;
  private static idleTimeout: NodeJS.Timeout | undefined;
  private static browserMutex = new Mutex();
  private static userCount = 0;

  private static async initBrowser() {
    if (this.playwrightUnavailable) return;

    await this.browserMutex.runExclusive(async () => {
      if (this.browser || this.playwrightUnavailable) return;

      try {
        const { chromium } = await import('playwright');

        try {
          this.browser = await chromium.launch({
            headless: true,
            channel: 'chromium-headless-shell',
            args: PLAYWRIGHT_ARGS,
          });
        } catch {
          this.browser = await chromium.launch({
            headless: true,
            args: PLAYWRIGHT_ARGS,
          });
        }
      } catch (err: any) {
        this.playwrightUnavailable = true;
        console.warn(
          'Playwright browser is not available; falling back to HTTP scraping. Run `npx playwright install --only-shell chromium` to enable full scraping.',
          err?.message || err,
        );
      }

      if (this.idleTimeout) clearTimeout(this.idleTimeout);
    });
  }

  private static scheduleIdleKill() {
    if (this.idleTimeout) clearTimeout(this.idleTimeout);

    this.idleTimeout = setTimeout(async () => {
      await this.browserMutex.runExclusive(async () => {
        if (this.browser && this.userCount === 0) {
          {
            await this.browser.close();
            this.browser = undefined;
          }
        }
      });
    }, this.IDLE_KILL_TIMEOUT);
  }

  private static async scrapeWithFetch(
    url: string,
  ): Promise<{ content: string; title: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': USER_AGENT,
        },
        redirect: 'follow',
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const html = await res.text();
      return extractReadable(html, url);
    } catch (err) {
      console.log(`Error scraping ${url}:`, err);

      return {
        title: 'Failed to scrape',
        content: `# ${url}\n\nError scraping content.`,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private static async scrapeWithPlaywright(
    url: string,
  ): Promise<{ content: string; title: string }> {
    const context = await this.browser.newContext({
      userAgent: USER_AGENT,
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();

    this.userCount++;

    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.NAVIGATION_TIMEOUT,
      });

      await page
        .waitForLoadState('load', { timeout: 5000 })
        .catch(() => undefined);
      await page.waitForTimeout(500);

      const html = await page.content();
      const title = await page.title();

      return extractReadable(html, url, title);
    } catch (err) {
      console.log(`Error scraping ${url}:`, err);

      return {
        title: 'Failed to scrape',
        content: `# ${url}\n\nError scraping content.`,
      };
    } finally {
      this.userCount--;

      await context.close().catch(() => undefined);

      if (this.userCount === 0) {
        this.scheduleIdleKill();
      }
    }
  }

  static async scrape(
    url: string,
  ): Promise<{ content: string; title: string }> {
    await this.initBrowser();

    if (this.browser) {
      return this.scrapeWithPlaywright(url);
    }

    return this.scrapeWithFetch(url);
  }
}

export default Scraper;
