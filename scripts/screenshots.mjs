import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { withChromeLock } from '/Volumes/Extreme SSD/Projects/grokbot/orchestration/chrome-lock.mjs';
const dir='/Volumes/Extreme SSD/Projects/grokbot/orchestration/shots/tong';
const phase=process.argv[2]??'after';await mkdir(dir,{recursive:true});
await withChromeLock(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{for(const width of [1440,375]){
   const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1});
   await page.goto('http://127.0.0.1:5370',{waitUntil:'networkidle'});await page.screenshot({path:`${dir}/${phase}-${width}.png`,fullPage:true});
   console.log(`${phase} ${width}: ${await page.title()}; overflow ${await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}`);await page.close();
 }}finally{await browser.close();}
});
