---
name: new-module
description: Додати нову можливість у Складено як модуль src/modules/NN-назва.js за шаблоном проєкту (обгортка над наявною функцією), з CSS, тестом і рядком у README.
disable-model-invocation: true
---

# Новий модуль

Модулі збирає `tools/build.py` після `src/app.js` і `src/vendor/*.js`, за алфавітом назв. Усе в одній області видимості: `P`, `S`, `PM`, `PT`, `render`, `pSave`, `esc`, `$` доступні напряму.

1. Файл `src/modules/NN-назва.js`, номер після вже наявних (`ls src/modules`). Угорі однорядковий коментар про призначення.
2. Розширюй наявну функцію обгорткою, а не правкою `app.js`:

```js
const xBase=pLesson;pLesson=function(id){xBase(id);/* дописати в DOM після xBase */};
```

3. Правила, які ми вже обпікали:
   - **Перегляд нічого не пише.** Не викликай `coachItem(id)` при показі: він створює запис. Читай `P.coach.items[id]||{}`. Запис створює лише дія користувача. Це охороняє `tests/cases/coach-items.js`.
   - **Стан** змінюй і зберігай через `pSave()`; для питань історії (`QM[id]`) ще й `save()`. Нових ключів у `P` не вигадуй: `pNormal` відкидає невідомі ключі при імпорті резервної копії.
   - **Текст у DOM** пропускай через `esc()`, ідентифікатори в `onclick` бери лише з `PT`/`PM`.
   - **Рух** лише `opacity`/`transform`, і лише як відповідь на дію (див. шапку `src/modules/70-motion.js`).
4. Стилі: `src/theme/NN-назва.css` або додай у наявний файл за темою, змінні кольорів лише з `10-tokens.css`.
5. Тест: файл `tests/cases/назва.js` за зразком `tests/cases/learn-recall.js` (виводить `PASS`/`FAIL`, наприкінці `fails N`).
6. Рядок про модуль у таблиці `README.md`.
7. `python -I tools/build.py`, `python -I tools/validate.py` («OK»), `node tests/run.js`, потім скіл `route-smoke`.
