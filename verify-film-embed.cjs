const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const origin=process.argv[2]||'http://127.0.0.1:8937';let server,browser;
 try{
  if(!process.argv[2]){
   const root=path.resolve('static');
   server=http.createServer((req,res)=>{
    let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return;}
    if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    if(!fs.existsSync(file)){res.writeHead(404).end();return;}
    const size=fs.statSync(file).size,type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.mp4':'video/mp4','.vtt':'text/vtt','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';
    const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range||'');
    if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),size-1):size-1;if(start>end){res.writeHead(416,{'Content-Range':'bytes */'+size}).end();return;}res.writeHead(206,{'Content-Type':type,'Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':end-start+1,'Accept-Ranges':'bytes'});fs.createReadStream(file,{start,end}).pipe(res);}
    else{res.writeHead(200,{'Content-Type':type,'Content-Length':size,'Accept-Ranges':'bytes'});fs.createReadStream(file).pipe(res);}
   });await new Promise(r=>server.listen(8937,'127.0.0.1',r));
  }
  browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://enabler-analytics.fly.dev/**',r=>r.abort());
  for(const route of ['/','/strategy/'])for(const lang of ['ja','en'])for(const width of [320,768,1440]){
   await page.setViewportSize({width,height:900});await page.goto(origin+route+'?lang='+lang,{waitUntil:'domcontentloaded'});
   const video=page.locator('[data-retreat-film] video');await video.waitFor();
   assert.equal(await video.getAttribute('preload'),'none');assert.equal(await video.getAttribute('autoplay'),null);
   await video.evaluate(async v=>{v.muted=true;await v.play();});
   await page.waitForFunction(()=>{const v=document.querySelector('[data-retreat-film] video');return v.currentTime>.2;});
   assert(Math.abs(await video.evaluate(v=>v.duration)-15)<.1);
   await page.waitForFunction(lang=>{const v=document.querySelector('[data-retreat-film] video');return [...v.textTracks].some(t=>t.language===lang&&t.mode==='showing'&&t.cues?.length===3);},lang);
   await video.evaluate(v=>{v.pause();v.currentTime=10.8;});
   await page.waitForFunction(()=>Math.abs(document.querySelector('[data-retreat-film] video').currentTime-10.8)<.1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const link=await page.locator('.retreat-film-primary').getAttribute('href');assert.equal(new URL(link).hash,'#consult');assert.equal(new URL(link).searchParams.get('lang'),lang);
   assert.equal(await page.locator('[data-retreat-film] a[href="https://stayflowapp.com/stays"]').count(),1);
   console.log(JSON.stringify({route,lang,width,duration:15,play:true,seek:true,subtitles:3,overflow:false}));
  }
  await page.locator('#language').click();await page.waitForFunction(()=>document.querySelector('.retreat-film-primary').href.includes('lang=ja'));
  assert.equal(await page.locator('[data-retreat-film] video').count(),1);
  await page.route('**/retreat-intro.mp4',r=>r.abort());await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-retreat-film] video').evaluate(v=>v.load());await page.locator('.retreat-film-error').waitFor({state:'visible'});
  assert.deepEqual(errors,[]);console.log('PASS: 12 cases, playback/seek/subtitles, no autoplay, language retention, links and media failure fallback.');
 }finally{if(browser)await browser.close();if(server){server.closeAllConnections();server.close();}}
})().catch(e=>{console.error(e);process.exitCode=1;});
