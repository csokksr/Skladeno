/* Вікно підтвердження: власний діалог на сторінці замість confirm() в усіх версіях (у переглядачі артефакту confirm() завжди
   повертає false). Після згоди повторюється та сама дія: натискання кнопки або імпорт файлу; якщо дія питає кілька разів, згоди накопичуються, доки вона не завершиться. Тести Node лишають вбудований confirm
   (window.nativeConfirm). */
if(!window.nativeConfirm){
let confirmOk=new Set(),confirmRetry=null;
document.body.insertAdjacentHTML('beforeend','<dialog id="web-confirm" class="web-confirm" aria-labelledby="web-confirm-text"><p id="web-confirm-text"></p><div class="p-actions"><button class="primary" id="web-confirm-yes">Так, продовжити</button><button id="web-confirm-no" autofocus>Скасувати</button></div></dialog>');
window.confirm=function(message){if(confirmOk.has(message))return true;let trigger=window.event?.type==='click'?window.event.target?.closest?.('button,a,[onclick]'):null,retry=confirmRetry;confirmRetry=null;const dlg=$('#web-confirm');$('#web-confirm-text').textContent=message;
 $('#web-confirm-yes').onclick=()=>{dlg.close();confirmOk.add(message);if(trigger&&trigger.isConnected)trigger.click();else if(retry)retry();if(!dlg.open)confirmOk.clear()};$('#web-confirm-no').onclick=()=>{confirmOk.clear();dlg.close()};
 if(!trigger&&!retry)return false;dlg.showModal();return false};
$('#web-confirm').addEventListener('cancel',()=>confirmOk.clear());
// Файлові поля скидають value до виклику confirm(), тож повтор отримує той самий файл.
const confirmWrapFile=sel=>{const el=$(sel);if(!el||!el.onchange)return;const base=el.onchange;el.onchange=e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;const fake={target:{files:[file],value:''}};const run=()=>{confirmRetry=run;return base(fake)};run()}};
confirmWrapFile('#import-file');confirmWrapFile('#p-import-file');
}
