// Last layer: a failure while drawing one page must not leave an empty screen. Progress is untouched by a failed draw.
function safeRenderFailed(){const main=$('#main');if(!main)return;main.innerHTML='<section class="p-section"><h1>Сторінку не вдалося показати</h1><p>Прогрес не втрачено. Повернись на головну або перевір резервну копію в налаштуваннях.</p><div class="p-actions"><a class="primary" href="#home">На головну ›</a><a href="#preferences">Налаштування ›</a></div></section>'}
const safeRenderBase=render;render=function(){try{safeRenderBase()}catch{safeRenderFailed()}};
