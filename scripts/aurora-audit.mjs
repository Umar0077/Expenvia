import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const widths = [320, 360, 390, 430, 768, 1024, 1280, 1440, 1920];
const folder = 'screenshots/aurora-after'; mkdirSync(folder, { recursive: true });
const browser = await chromium.launch();
const findings = [], errors = []; let checks = 0;
const credentials = readFileSync('.demo-credentials.txt', 'utf8');
const password = /Password for every demo account: (\S+)/.exec(credentials)[1];
const roles = [
  { email: 'ceo@demo.expenvia.test', routes: ['/admin/dashboard','/admin/branches','/admin/expenses','/admin/invoices','/admin/approvals','/admin/reports','/admin/audit-logs','/admin/email-delivery','/admin/notifications','/admin/settings','/admin/users','/admin/vendors','/admin/registrations','/admin/categories','/admin/payments'] },
  { email: /Employee:\s+(\S+)/.exec(credentials)[1], routes: ['/user/dashboard','/user/expenses','/user/expenses/new','/user/notifications','/user/settings'] },
  { email: /Vendor:\s+(\S+)/.exec(credentials)[1], routes: ['/vendor/dashboard','/vendor/branches','/vendor/invoices','/vendor/invoices/new','/vendor/supplies','/vendor/notifications','/vendor/settings'] },
];
try {
  const page = await browser.newPage(); page.setDefaultTimeout(60000);
  page.on('pageerror', e => errors.push(e.message));
  async function inspect(route, locale, theme) {
    await page.evaluate(() => document.fonts.ready);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 }); await page.waitForTimeout(180);
      const issues = await page.evaluate(() => {
        const result = [];
        if (document.documentElement.scrollWidth > innerWidth + 1) result.push({ kind: 'page-overflow', width: document.documentElement.scrollWidth });
        for (const el of document.querySelectorAll('label,.sidebar-label,.journey-card p,.preview-metric p,.hero-headline,.ui-button:not([data-size^="icon"])')) {
          const r = el.getBoundingClientRect(); if (!r.width || !r.height || el.closest('.sr-only')) continue;
          if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) result.push({ kind: 'clipped-label', text: el.textContent.slice(0,60), width: el.clientWidth, needed: el.scrollWidth });
        }
        return result;
      });
      checks++;
      if (issues.length) findings.push({ route, locale, theme, width, issues });
    }
  }
  for (const locale of ['en','ur']) for (const theme of ['light','dark']) {
    await page.context().addCookies([{ name:'NEXT_LOCALE', value:locale, url:'http://localhost:3001' }, {name:'expenvia_motion',value:'reduced',url:'http://localhost:3001'}]);
    await page.goto('http://localhost:3001'); await page.evaluate(t=>localStorage.setItem('expenvia-theme',t), theme); await page.reload();
    await inspect('/',locale,theme);
    for (const route of ['/login','/signup','/forgot-password','/pending-approval','/features']) {
      await page.goto(`http://localhost:3001${route}`); await inspect(route,locale,theme);
    }
  }
  console.log('Public page matrix complete');
  for (const role of roles) {
    await page.context().clearCookies();
    await page.context().addCookies([{name:'NEXT_LOCALE',value:'en',url:'http://localhost:3002'}]);
    await page.goto('http://localhost:3002/login');
    await page.getByLabel(/Email address/i).fill(role.email); await page.getByLabel(/^Password/i).first().fill(password);
    await page.getByRole('button',{name:/^Sign in$/}).click(); await page.waitForURL(/\/(admin|user|vendor)\/dashboard/);
    await page.context().addCookies([{name:'NEXT_LOCALE',value:'ur',url:'http://localhost:3002'},{name:'expenvia_motion',value:'reduced',url:'http://localhost:3002'}]);
    for (const theme of ['light','dark']) {
      await page.evaluate(t=>localStorage.setItem('expenvia-theme',t),theme);
      for (const route of role.routes) {
        await page.goto(`http://localhost:3002${route}`); await page.locator('#app-main').waitFor();
        await inspect(route,'ur',theme);
        if (theme === 'light') { await page.setViewportSize({width:1440,height:1000}); await page.screenshot({path:`${folder}/audit-${route.replaceAll('/','-')}.png`,caret:'initial'}); }
      }
    }
    console.log(`${role.routes[0]} route matrix complete`);
  }
  writeFileSync(`${folder}/audit.json`, JSON.stringify({checks,findings,errors},null,2));
  console.log(JSON.stringify({checks,findings:findings.length,errors:errors.length}));
  if(findings.length) console.log(JSON.stringify(findings.slice(0,12)));
} finally { await browser.close(); }
