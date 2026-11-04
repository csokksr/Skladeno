---
name: route-smoke
description: Обійти всі маршрути зібраного Складено в браузері й знайти сторінки без заголовка, з аварійним екраном або з помилками в консолі. Запускай після змін у src/app.js чи src/modules.
disable-model-invocation: true
---

# Обхід маршрутів

1. `python -I tools/build.py`, потім `preview_start` з `skladeno` і відкрий `http://localhost:8765/skladeno-nmt.html#hub` (сторінка вантажиться 3 с; перезавантаж, якщо зібрав заново).
2. Виконай у `javascript_tool` (після `await` пауза дає час дорисуватися сторінці):

```js
await new Promise(r=>setTimeout(r,3000));
const routes=['hub','today','plan','library','strategy','mocks','subject/ukr','subject/hist','lesson/ukr-sounds','topics','topic/1','gallery','map','review','analytics','settings','practice','reference','audit','coverage','advanced','history-archive','home','quiz','exam','progress'];
const bad=[];
for(const r of routes){location.hash='#'+r;await new Promise(x=>setTimeout(x,450));
 const m=document.querySelector('#main'),h=m.querySelector('h1');
 if(!h&&!m.querySelector('.p-question'))bad.push(r+': немає H1');else if(h&&/не вдалося показати/.test(h.textContent))bad.push(r+': аварійний екран');}
bad
```

3. `read_console_messages` з `onlyErrors: true`. Порожній список і порожня консоль означають, що все гаразд.
Сторінка завдання (`practice`, `quiz`) H1 не має: вона показує `.p-question`, тому скрипт це допускає.
4. Новий маршрут додай у масив `routes` цього файлу. Маршрути `home`, `quiz`, `exam`, `progress` перенаправляються (`LEGACY_ROUTES` у `src/modules/40-legacy.js`), їх перевіряй так само.

Скіл не замінює `node tests/run.js` і не перевіряє вигляд сторінок: для вигляду роби скриншот.
