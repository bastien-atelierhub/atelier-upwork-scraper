import express from 'express';
import cors    from 'cors';
import { WorkingUpworkScraper_NoCookie } from './scraper.js';

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ status: 'running', service: 'upwork-scraper', version: '1.0.0' });
});

app.post('/scrape', async (req, res) => {
  const { searchUrl, maxJobs = 10 } = req.body;

  if (!searchUrl) {
    return res.status(400).json({ error: 'searchUrl is required' });
  }

  console.log(`[server] /scrape → ${searchUrl} (max ${maxJobs})`);
  const scraper = new WorkingUpworkScraper_NoCookie();

  try {
    await scraper.init();
    await scraper.navigateToUpwork(searchUrl);
    const jobs = await scraper.scrapeJobs(maxJobs);

    console.log(`[server] ${jobs.length} jobs trouvés`);
    res.json({ ok: true, count: jobs.length, jobs });
  } catch (err) {
    console.error('[server] Erreur scraping:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    await scraper.close();
  }
});

app.listen(PORT, () => {
  console.log(`[server] Upwork scraper running on port ${PORT}`);
});
