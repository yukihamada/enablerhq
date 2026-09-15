// PLAYWRIGHT_PATH=/absolute/path/to/playwright node verify-persona.cjs [public-origin]
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
async function main(){
 const origin=process.argv[2]||'http://127.0.0.1:8934';
 let server,browser;
 try{
  if(!process.argv[2]){
   server=spawn('python3',['-m','http.server','8934','--bind','127.0.0.1','--directory',path.join(__dirname,'static')],{stdio:'ignore'});
   for(let i=0;i<40;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  }
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({reducedMotion:'reduce'});
  // Existing analytics is unrelated to this deterministic UI regression suite.
  await context.route('https://enabler-analytics.fly.dev/**',route=>route.abort());
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const pathname of ['/','/strategy/'])for(const lang of ['ja','en'])for(const width of [320,390,768,1024,1440]){
   await page.setViewportSize({width,height:900});
   const response=await page.goto(origin+pathname+'?lang='+lang,{waitUntil:'domcontentloaded',timeout:30000});assert.equal(response.status(),200);
   await page.locator(pathname==='/'?'.entry':'.experience-card').last().waitFor();
   await page.locator('img').evaluateAll(async images=>{await Promise.all(images.map(async img=>{img.loading='eager';await img.decode();}));});
   const result=await page.evaluate(()=>({
    width:innerWidth,scrollWidth:document.documentElement.scrollWidth,lang:document.documentElement.lang,
    h1:document.querySelectorAll('h1').length,
    duplicateIds:[...document.querySelectorAll('[id]')].map(n=>n.id).filter((id,i,all)=>all.indexOf(id)!==i),
    tiny:[...document.querySelectorAll('p,span,a,li,label,button')].filter(n=>n.checkVisibility()&&n.textContent.trim()&&parseFloat(getComputedStyle(n).fontSize)<12).length
   }));
   assert(result.scrollWidth<=width,JSON.stringify(result));assert.equal(result.lang,lang);assert.equal(result.h1,1);assert.deepEqual(result.duplicateIds,[]);assert.equal(result.tiny,0);
   if(pathname==='/strategy/'){
    for(const peek of await page.locator('.fold-peek').all())assert(await peek.evaluate(n=>n.checkVisibility()),'Closed summary description must be visible');
    const hero=await page.locator('.hero-photo img').boundingBox();assert(Math.abs(hero.width/hero.height-1.5)<.02);
   }
   console.log(JSON.stringify({path:pathname,lang,width,overflow:false,images:'decoded',tiny:result.tiny}));
  }
  await page.goto(origin+'/?lang=en');await page.locator('.entry[href*="filter=create"]').click();
  await page.waitForURL('**/strategy/**');await page.locator('.product').last().waitFor();
  assert.equal(await page.locator('.product').count(),4);assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.equal(await page.locator('[data-filter="create"]').getAttribute('aria-pressed'),'true');
  await page.locator('#language').click();assert.equal(await page.locator('.product').count(),4);
  await page.locator('[data-filter="all"]').click();assert.equal(await page.locator('.product').count(),11);
  for(const id of ['strategy','reality']){
   await page.locator('.guide-shortcuts a[href="#'+id+'"]').click();
   assert(await page.locator('#'+id).evaluate(n=>n.checkVisibility()),'Anchor must reveal closed details');
  }
  for(const plan of ['blank','camp','bbq']){
   await page.locator('[data-plan="'+plan+'"]').click();assert.equal(await page.locator('[data-plan="'+plan+'"]').getAttribute('aria-pressed'),'true');
  }
  await page.locator('#request-company').fill('Example Team');await page.locator('#request-budget').fill('JPY 2 million');
  await page.locator('#request-preferences').fill('10 people / English');await page.locator('#request-guests').fill('6');
  await page.locator('#request-notes').fill('<img src=x onerror=alert(1)>');
  await page.locator('#request-form button[type="submit"]').click();
  const text=await page.locator('#request-preview').inputValue();assert(text.includes('Example Team'));assert(text.includes('10 people / English'));
  assert.equal(new URL(await page.locator('#request-email').getAttribute('href')).searchParams.get('body'),text);
  assert.equal(await page.locator('#request-result img').count(),0);
  await page.locator('#request-guests').fill('0');await page.locator('#request-form button[type="submit"]').click();assert.equal(await page.locator('#request-result').isVisible(),false);
  await page.locator('#request-guests').fill('6');await page.locator('#language').click();assert.equal(await page.locator('#request-company').inputValue(),'Example Team');
  await page.locator('header .wordmark').click();await page.waitForURL(origin+'/?lang=en');await page.waitForFunction(()=>document.documentElement.lang==='en');assert.equal(new URL(page.url()).pathname,'/');assert.equal(await page.locator('html').getAttribute('lang'),'en');
  for(const lang of ['ja','en']){
   await page.goto(origin+'/strategy/?edition=1&lang='+lang);assert.equal(await page.locator('.product').count(),9);assert.equal(await page.locator('.experience-card').count(),0);
   const broken=await page.locator('a[href^="#"]').evaluateAll(links=>links.map(a=>a.getAttribute('href')).filter(h=>h!=='#'&&!document.getElementById(h.slice(1))));assert.deepEqual(broken,[]);
  }
  const nojs=await browser.newContext({javaScriptEnabled:false});const basic=await nojs.newPage();await basic.goto(origin+'/');assert.equal(await basic.locator('.entry').count(),3);assert(await basic.locator('#contact').isVisible());await nojs.close();
  assert.deepEqual(errors,[]);console.log('PASS: 20 viewport/language cases; image decoding; visible fold previews; purpose deep link; anchors; enquiry/XSS DOM; language retention; edition=1; no-JS homepage.');
 }finally{if(browser)await browser.close();if(server)server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
