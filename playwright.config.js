// Тести в справжньому браузері (Chromium). Сторінку важить 100 МБ, тож час очікування щедрий. Запуск: npx playwright test (потрібна збірка dist/skladeno-nmt.html).
const {defineConfig,devices}=require('@playwright/test');
const PORT=8791;
module.exports=defineConfig({
  testDir:'tests/e2e',
  timeout:90000,
  expect:{timeout:15000},
  workers:2,
  retries:1, // рідкісний збій завантаження 100 МБ локальним сервером не має валити прогін
  reporter:process.env.CI?[['list'],['github']]:'list',
  use:{baseURL:`http://127.0.0.1:${PORT}`,trace:'retain-on-failure'},
  webServer:{command:`python -m http.server ${PORT} --bind 127.0.0.1 --directory dist`,url:`http://127.0.0.1:${PORT}/skladeno-nmt.html`,reuseExistingServer:!process.env.CI,timeout:60000,stdout:'ignore',stderr:'ignore'},
  projects:[
    {name:'desktop',use:{...devices['Desktop Chrome']}},
    {name:'mobile',use:{...devices['Pixel 5']}},
  ],
});
