// Кожна сторінка відкривається в справжньому браузері без помилок у консолі й без винятків.
const {test,expect}=require('@playwright/test');
const ROUTES=['hub','tests','mocks','plan','rhythm','preferences','find','strategy','library','cards','graph','about','analytics','reference','official','coach','growth'];
const PAGE='/skladeno-nmt.html';

test.describe('сторінки відкриваються без помилок',()=>{
  for(const route of ROUTES){
    test(route,async({page})=>{
      const errors=[];
      page.on('pageerror',e=>errors.push('pageerror: '+e.message));
      page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
      await page.goto(`${PAGE}#${route}`);
      await expect(page.locator('#main h1').first()).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});
