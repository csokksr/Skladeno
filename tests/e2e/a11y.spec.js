// Автоматична перевірка доступності (axe-core) на сторінках сайту: світла й темна теми. Падає на серйозних і критичних порушеннях.
const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const ROUTES=['hub','tests','mocks','plan','rhythm','preferences','find','strategy','library','cards','graph','about','analytics','reference','practice'];
const PAGE='/skladeno-nmt.html';

for(const scheme of ['light','dark']){
  test.describe(`axe, ${scheme} тема`,()=>{
    test.use({colorScheme:scheme});
    for(const route of ROUTES){
      test(route,async({page})=>{
        await page.goto(`${PAGE}#${route}`);
        await expect(page.locator('#main').first()).toBeVisible();
        const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
        const bad=results.violations.filter(v=>['serious','critical'].includes(v.impact));
        expect(bad.map(v=>`${v.id} (${v.impact}): ${v.help} · елементів: ${v.nodes.length} · напр. ${v.nodes[0].target.join(' ')}`)).toEqual([]);
      });
    }
  });
}

async function scan(page){
  const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  return results.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>`${v.id} (${v.impact}): ${v.help} · елементів: ${v.nodes.length} · напр. ${v.nodes[0].target.join(' ')}`);
}

// Стани, яких немає при простому відкритті сторінки.
for(const scheme of ['light','dark']){
  test.describe(`axe, стани, ${scheme} тема`,()=>{
    // Без руху: інакше розбір відповіді з'являється плавно, і axe міряє напівпрозорий текст.
    test.use({colorScheme:scheme,reducedMotion:'reduce'});
    for(const kind of ['правильна','неправильна']){
      test(`практика після відповіді: ${kind} (розбір, кнопки)`,async({page})=>{
        await page.goto(`${PAGE}#hub`);
        await expect(page.locator('#main h1').first()).toBeVisible();
        const pick=await page.evaluate(k=>{const q=PQ.find(q=>q.type==='single'&&!q.examOnly&&q.subject!=='hist');pStart([q.id],'e2e','e2e');location.hash='#practice';return k==='правильна'?q.answer:(q.answer+1)%q.options.length},kind);
        await page.locator('#main .p-option').nth(pick).click();
        await page.getByRole('button',{name:'Перевірити'}).first().click();
        await expect(page.locator('.p-feedback').first()).toBeVisible();
        expect(await scan(page)).toEqual([]);
      });
    }
    test('швидкий перехід (Ctrl+K)',async({page,isMobile})=>{
      test.skip(isMobile,'клавіатурне вікно');
      await page.goto(`${PAGE}#hub`);
      await expect(page.locator('#main h1').first()).toBeVisible();
      await page.keyboard.press('Control+K');
      await expect(page.locator('#modal[open] #pal-q')).toBeVisible();
      expect(await scan(page)).toEqual([]);
    });
    test('пробник із бланком відповідей',async({page,isMobile})=>{
      test.skip(isMobile,'бланк перевіряємо на комп’ютері');
      await page.goto(`${PAGE}#mocks`);
      await page.locator('#ins-quick button').first().click();
      await page.getByRole('button',{name:'Бланк'}).click();
      await expect(page.locator('#modal[open] .ins-sheet-row').first()).toBeVisible();
      expect(await scan(page)).toEqual([]);
    });
    test('графік функції',async({page})=>{
      await page.goto(`${PAGE}#graph`);
      await expect(page.locator('.gr-svg')).toBeVisible();
      expect(await scan(page)).toEqual([]);
    });
  });
}
