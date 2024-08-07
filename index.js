const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');

const allEmails = [];
const allWebsites = [];
const RESULTS_PER_PAGE = 10;

const scrapeEmails = async (url) => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);

    const html = await page.content();
    const $ = cheerio.load(html);
    const emails = [];

    $('a[href^="mailto:"], .email-contact, span[data-email]').each((index, element) => {
      const email = $(element).text().trim() || $(element).attr('href').replace('mailto:', '');
      if (isValidEmail(email)) {
        emails.push(email);
      }
    });

    await browser.close();

    return emails;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
  }
}

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

const main = async (urls) => {
  for (const url of urls) {
    try {
      const [site, contact] = await Promise.all([
        scrapeEmails(url),
        scrapeEmails(`${url}/contact`)
      ]);

      allEmails.concat(...site);
      allEmails.concat(...contact);
    } catch (error) {
      console.error(`Error processing ${url}:`, error);
    }
  }
}

const getWebsiteLinks = async (q, pageCount = 1) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const start = pageCount === 1 ? 0 : pageCount * RESULTS_PER_PAGE;
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}&start=${start}`;
  console.log(`Fetching websites for ${googleUrl}`);

  await page.goto(googleUrl);
  const html = await page.content();
  const $ = cheerio.load(html);

  $('a[data-ved] > br').parent().each((index, element) => {
    const link = $(element).attr('href');
    if (link) {
      const { origin } = new URL(link);
      allWebsites.push(origin);
    }
  });

  await browser.close();

  if (pageCount === Number(process.argv[3])) {
    return allWebsites;
  }

  return getWebsiteLinks(q, pageCount + 1);
}

const run = async () => {
  const googleQuery = process.argv[2];
  const websites = await getWebsiteLinks(googleQuery);
  console.log(`Found ${websites.length} unique websites to check.`);

  await main(websites);
  const emailAddresses = [...new Set(allEmails.flat())];
  console.log(`Found ${emailAddresses.length} unique email addresses.`);

  fs.writeFileSync(path.join(__dirname, 'result.txt'), emailAddresses.join('\n '));
};

run();