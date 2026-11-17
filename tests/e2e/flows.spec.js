// Основні дії користувача в справжньому браузері: практика, клавіші, шифрування копії, графік, збереження після перезавантаження.
const {test,expect}=require('@playwright/test');
const PAGE='/skladeno-nmt.html';

// Змішана практика бере випадкові завдання, серед яких бувають і без кнопок-варіантів, тож тест стартує з відомого завдання з одним варіантом відповіді.
async function startPractice(page){
  await page.goto(`${PAGE}#hub`);
  await expect(page.locator('#main h1').first()).toBeVisible();
  await page.evaluate(()=>{const q=PQ.find(q=>q.type==='single'&&!q.examOnly&&q.subject!=='hist');pStart([q.id],'e2e','e2e');location.hash='#practice'});
  await expect(page.locator('#main .p-option').first()).toBeVisible();
}

test('практика: вибрати варіант і перевірити відповідь',async({page})=>{
  await startPractice(page);
  await page.locator('#main .p-option').first().click();
  await page.getByRole('button',{name:'Перевірити'}).first().click();
  await expect(page.locator('.p-feedback').first()).toBeVisible();
});

test('відповідь лишається після перезавантаження',async({page})=>{
  await startPractice(page);
  await page.locator('#main .p-option').first().click();
  await page.getByRole('button',{name:'Перевірити'}).first().click();
  await expect(page.locator('.p-feedback').first()).toBeVisible();
  const before=await page.evaluate(()=>Object.keys(pAnswers()).length);
  expect(before).toBeGreaterThan(0);
  await page.reload();
  expect(await page.evaluate(()=>Object.keys(pAnswers()).length)).toBe(before);
});

test('клавіші: Ctrl+K, «/» і «?»',async({page,isMobile})=>{
  test.skip(isMobile,'клавіатурні скорочення перевіряємо на комп’ютері');
  await page.goto(`${PAGE}#hub`);
  await expect(page.locator('#main h1').first()).toBeVisible();
  await page.keyboard.press('Control+K');
  await expect(page.locator('#modal[open] #pal-q')).toBeFocused();
  await page.keyboard.type('ритм');
  await expect(page.locator('#pal-list li[role=option]')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#rhythm$/);
  await page.keyboard.press('/');
  await expect(page).toHaveURL(/#find$/);
  await expect(page.locator('#find-query')).toBeFocused();
  await page.locator('#find-query').blur();
  await page.keyboard.press('Shift+?');
  await expect(page.locator('#modal[open] h2')).toHaveText('Клавіші');
});

test('копія з паролем: шифрування й розшифрування справжнім WebCrypto',async({page})=>{
  await page.goto(`${PAGE}#hub`);
  const ok=await page.evaluate(async()=>{
    const plain=pBackupData(),packed=await encPack(plain,'пароль-12345'),back=await encUnpack(JSON.parse(JSON.stringify(packed)),'пароль-12345');
    let wrong='';try{await encUnpack(packed,'інший-пароль')}catch(e){wrong=e.message}
    return {same:JSON.stringify(back)===JSON.stringify(plain),wrong,hidden:!JSON.stringify(packed).includes('"answers"')};
  });
  expect(ok.same).toBe(true);
  expect(ok.hidden).toBe(true);
  expect(ok.wrong).toMatch(/Неправильний пароль/);
});

test('графік функції будується й має текстовий опис',async({page})=>{
  await page.goto(`${PAGE}#graph`);
  await page.locator('#gr-f').fill('x^2-4');
  await page.getByRole('button',{name:'Побудувати'}).click();
  const svg=page.locator('.gr-svg');
  await expect(svg).toBeVisible();
  await expect(svg).toHaveAttribute('aria-label',/Нулі приблизно: -2, 2/);
});

test('швидка перевірка: пробник на 15 завдань із бланком',async({page,isMobile})=>{
  test.skip(isMobile,'бланк перевіряємо на комп’ютері');
  await page.goto(`${PAGE}#mocks`);
  await page.locator('#ins-quick button').first().click();
  await expect(page).toHaveURL(/#simulate$/);
  await page.getByRole('button',{name:'Бланк'}).click();
  await expect(page.locator('#modal[open] .ins-sheet-row')).toHaveCount(15);
  await page.locator('#modal .ins-bubble').first().click();
  await expect(page.locator('#modal .ins-bubble[aria-pressed=true]')).toHaveCount(1);
});

test('телефон: кнопки «Назад», «Перевірити», «Далі» лишаються внизу екрана',async({page,isMobile})=>{
  test.skip(!isMobile,'лише телефон');
  await startPractice(page);
  const box=await page.locator('.p-question-actions').boundingBox(),vh=page.viewportSize().height;
  expect(box.y+box.height).toBeLessThanOrEqual(vh+1);
  expect(box.y).toBeGreaterThan(vh*0.5);
});

test('практика: на видноті не більше трьох дій, решта в «Ще», один h1',async({page})=>{
  await startPractice(page);
  const bar='#main .p-practice-top .p-actions';
  expect(await page.locator(bar+'>button').count()).toBeLessThanOrEqual(3);
  await expect(page.locator('#main h1')).toHaveCount(1);
  await page.locator(bar+' .p-more summary').click();
  await expect(page.getByRole('button',{name:'Без меню'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Самоперевірка перед відповіддю: вимкнено'})).toBeVisible();
});

test('практика: після перемикача в «Ще» меню лишається відкритим і фокус на тій самій дії',async({page})=>{
  await startPractice(page);
  await page.locator('#main .p-more summary').click();
  await page.getByRole('button',{name:/Самоперевірка перед відповіддю/}).click();
  await expect(page.locator('#main .p-more')).toHaveAttribute('open','');
  await expect(page.getByRole('button',{name:'Самоперевірка перед відповіддю: увімкнено'})).toBeFocused();
});

test('тема історії: вкладки p-tabs, одна активна й aria-pressed збігається',async({page})=>{
  await page.goto(`${PAGE}#topic/3`);
  await expect(page.locator('#main h1')).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Почати тести'})).toBeVisible();
  await page.getByRole('button',{name:'Хронологія'}).click();
  const tabs=page.locator('#main .p-tabs button').first().locator('..').locator('button');
  await expect(tabs.locator('xpath=self::*[contains(@class,"is-active")]')).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Хронологія'})).toHaveAttribute('aria-pressed','true');
});
