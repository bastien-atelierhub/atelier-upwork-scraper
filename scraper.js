import { connect } from 'puppeteer-real-browser';

const JOB_SELECTORS = [
  'article[data-test="JobTile"]',
  '.job-tile',
  '.air3-card.job-tile',
  '[data-test="job-tile-list"] > div',
];

export class WorkingUpworkScraper_NoCookie {
  constructor() {
    this.browser = null;
    this.page    = null;
  }

  async init() {
    const { browser, page } = await connect({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1280,800',
      ],
      customConfig: {},
      turnstile: true,
      connectOption: {},
      disableXvfb: false,
      ignoreAllFlags: false,
    });

    this.browser = browser;
    this.page    = page;

    await this.page.setViewport({ width: 1280, height: 800 });
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });
  }

  async navigateToUpwork(url) {
    console.log(`[scraper] Navigation → ${url}`);
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await this.waitForCloudflareComplete();
  }

  async waitForCloudflareComplete(timeout = 45_000) {
    const deadline = Date.now() + timeout;
    console.log('[scraper] Attente passage Cloudflare...');

    while (Date.now() < deadline) {
      const currentUrl = this.page.url();
      const title      = await this.page.title();

      const onUpwork      = currentUrl.includes('upwork.com');
      const notChallenge  = !currentUrl.includes('challenges') && !title.toLowerCase().includes('just a moment');

      if (onUpwork && notChallenge) {
        console.log('[scraper] Cloudflare passé ✓');
        return;
      }

      await new Promise(r => setTimeout(r, 1500));
    }

    throw new Error('Cloudflare timeout — page non résolue après 45s');
  }

  async findJobElements() {
    for (const selector of JOB_SELECTORS) {
      const count = await this.page.$$eval(selector, els => els.length);
      if (count > 0) {
        console.log(`[scraper] Sélecteur trouvé: "${selector}" (${count} éléments)`);
        return selector;
      }
    }
    return null;
  }

  async scrapeJobs(maxJobs = 10) {
    const selector = await this.findJobElements();

    if (!selector) {
      const html = await this.page.content();
      console.warn('[scraper] Aucun sélecteur trouvé. Extrait HTML:', html.slice(0, 500));
      return [];
    }

    const jobs = await this.page.$$eval(selector, (elements, max) => {
      return elements.slice(0, max).map(el => {
        const text = s => el.querySelector(s)?.textContent?.trim() ?? '';
        const attr = (s, a) => el.querySelector(s)?.getAttribute(a) ?? '';

        const titleEl = el.querySelector(
          '[data-test="job-tile-title"] a, h2 a, h3 a, .job-title a, a[href*="/jobs/"]'
        );

        const skills = [...el.querySelectorAll(
          '[data-test="TokenClamp-Container"] span, .skills-list span, .air3-token span'
        )].map(s => s.textContent.trim()).filter(Boolean);

        return {
          title:       titleEl?.textContent?.trim() ?? text('h2, h3'),
          url:         titleEl ? 'https://www.upwork.com' + (titleEl.getAttribute('href') ?? '') : '',
          description: text('[data-test="job-description-text"], .job-description, p'),
          budget:      text('[data-test="budget"], .budget, [data-test="is-fixed-to-hourly"]'),
          skills,
        };
      });
    }, maxJobs);

    return jobs.filter(j => j.title);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page    = null;
    }
  }
}
