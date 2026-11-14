(() => {
  'use strict';
  const app = document.getElementById('admin-app');
  const entryKey = 'homewood-demo-entered:' + new URL('../', location.href).pathname;
  const labels = {gift:'Для подарка',desk:'Для рабочего стола',kitchen:'Для кухни'};
  let store;
  let notice = '';
  let entered = false;
  try { entered = sessionStorage.getItem(entryKey) === 'yes'; } catch (_) { /* Entry is a visual choice, not authentication. */ }

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const money = minor => {
    const whole = Math.trunc(Number(minor) / 100).toLocaleString('ru-RU');
    const part = Number(minor) % 100;
    return whole + (part ? ',' + String(part).padStart(2,'0') : '') + ' ₽';
  };
  const inputMoney = minor => Math.trunc(minor / 100) + ',' + String(minor % 100).padStart(2,'0');
  const href = (view = '', id = '') => 'index.html' + (view ? '?view=' + encodeURIComponent(view) + (id ? '&id=' + encodeURIComponent(id) : '') : '');
  const products = () => store.getProducts();
  const find = id => products().find(product => product.slug === String(id) || String(product.id) === String(id));
  const photo = path => store.imageUrl(path);
  function go(view = '', id = '') {
    history.pushState({}, '', href(view,id));
    render();
    window.scrollTo(0,0);
  }
  function header() {
    return '<header class="topbar"><a class="brand" href="index.html" data-view="">ХОУМ ВУД<small>Управление мастерской · демо</small></a><nav aria-label="Управление"><a href="index.html" data-view="">Каталог</a><a href="index.html?view=settings" data-view="settings">Настройки</a><a href="../">Открыть сайт ↗</a><button type="button" data-action="exit">Выйти</button></nav></header>';
  }
  function shell(content) {
    app.innerHTML = header() + '<main class="container">' + (notice ? '<div class="notice" role="status">' + esc(notice) + '</div>' : '') + content + '<p class="bottom-note">ХОУМ ВУД · Управление каталогом · Демонстрация</p></main>';
    notice = '';
  }
  function login() {
    app.innerHTML = '<main class="login-wrap"><section class="login-card" aria-labelledby="login-title"><a class="brand" href="../">ХОУМ ВУД</a><h1 id="login-title">Вход в управление</h1><p class="intro">Посмотрите, как заказчик управляет каталогом, фотографиями и ценами.</p><p class="demo-login-note">Это публичная демонстрация интерфейса. Пароль не требуется. Изменения будут видны только в вашем браузере.</p><button class="button" type="button" data-action="enter">Открыть демо-панель</button><a class="login-back" href="../">← Вернуться на сайт</a></section></main>';
  }
  function resetControl() {
    return '<section class="panel demo-reset"><h2>Вернуть исходный ассортимент</h2><p class="help">Сброс удалит добавленные в этом браузере товары и вернёт все шесть исходных изделий, их фотографии, цены и настройки первого экрана.</p><p><button class="button secondary" type="button" data-action="reset">Сбросить демонстрационные изменения</button></p></section>';
  }
  function dashboard() {
    const all = products();
    const active = all.filter(p => p.is_active).length;
    shell('<div class="page-heading"><div><p class="eyebrow">Мастерская · Каталог</p><h1>ХОУМ ВУД — Управление каталогом</h1><p class="intro">Сохраните изменения и откройте сайт в этом же браузере.</p></div><a class="button" href="'+href('create')+'" data-view="create">+ Добавить товар</a></div><div class="stats" aria-label="Статистика каталога"><div class="stat"><strong>'+all.length+'</strong><span>Всего товаров</span></div><div class="stat"><strong>'+active+'</strong><span>Опубликовано</span></div><div class="stat"><strong>'+(all.length-active)+'</strong><span>Скрыто</span></div></div><section class="panel"><form class="filters" id="filter-form"><div class="field"><label for="search">Поиск по названию</label><input type="search" id="search" name="q" maxlength="200" placeholder="Например, шкатулка"></div><div class="field"><label for="status">Публикация</label><select id="status" name="status"><option value="">Все товары</option><option value="active">Опубликованные</option><option value="hidden">Скрытые</option></select></div><div class="field"><label for="category">Категория</label><select id="category" name="category"><option value="">Все категории</option>'+Object.entries(labels).map(([slug,label])=>'<option value="'+slug+'">'+label+'</option>').join('')+'</select></div><button class="button secondary" type="submit">Найти</button></form></section><section class="panel"><div class="table-scroll"><table><thead><tr><th scope="col" id="catalog-heading">Товар · '+all.length+'</th><th scope="col">Цена</th><th scope="col">Публикация</th><th scope="col">Порядок</th><th scope="col">Действия</th></tr></thead><tbody id="products-body"></tbody></table></div></section>'+resetControl());
    drawRows(all);
  }
  function drawRows(rows) {
    document.getElementById('catalog-heading').textContent = 'Товар · ' + rows.length;
    const body = document.getElementById('products-body');
    body.innerHTML = rows.map(p=>'<tr><td><div class="product-cell"><img src="'+esc(photo(p.image_path))+'" alt="'+esc(p.image_alt)+'" width="78" height="78" loading="lazy"><div><strong>'+esc(p.name)+'</strong><small>'+esc((p.categories||[]).map(c=>labels[c]||c).join(' · '))+'</small></div></div></td><td class="price">'+esc(money(p.price_minor))+'</td><td><span class="badge '+(p.is_active?'':'hidden')+'">'+(p.is_active?'Опубликован':'Скрыт')+'</span></td><td><div class="sort"><span>'+esc(p.sort_order)+'</span><button type="button" class="button secondary small" data-action="up" data-id="'+esc(p.slug)+'" aria-label="Поднять: '+esc(p.name)+'">↑</button><button type="button" class="button secondary small" data-action="down" data-id="'+esc(p.slug)+'" aria-label="Опустить: '+esc(p.name)+'">↓</button></div></td><td><div class="actions"><a class="button secondary small" href="'+href('edit',p.slug)+'" data-view="edit" data-id="'+esc(p.slug)+'">Изменить</a><button class="button secondary small" type="button" data-action="toggle" data-id="'+esc(p.slug)+'">'+(p.is_active?'Скрыть':'Опубликовать')+'</button>'+(p.is_active?'<a href="../#product-'+esc(p.slug)+'">На сайте ↗</a>':'')+'<button type="button" class="link-button" data-action="delete" data-id="'+esc(p.slug)+'">Удалить</button></div></td></tr>').join('') || '<tr><td class="empty" colspan="5">'+(products().length?'Ничего не найдено. Измените поиск или фильтры.':'В каталоге пока нет товаров. Добавьте первое изделие.')+'</td></tr>';
  }
  function form(existing) {
    const editing = !!existing;
    const p = existing || {name:'',price_minor:0,sort_order:products().length+1,subtitle:'',description:'',categories:[],image_alt:'',original_url:'',is_active:1,personalization_enabled:0};
    shell('<a class="back-link" href="index.html" data-view="">← Все товары</a><div class="page-heading"><div><p class="eyebrow">Каталог · '+(editing?'Изменить':'Добавить')+'</p><h1>'+(editing?'Редактирование товара':'Новый товар')+'</h1><p class="intro">'+(editing?'Измените нужные поля и нажмите «Сохранить изменения».':'Заполните карточку изделия и добавьте фотографию.')+'</p></div>'+(editing&&p.is_active?'<a class="button secondary" href="../#product-'+esc(p.slug)+'">Посмотреть на сайте</a>':'')+'</div><div id="form-errors" role="alert" hidden></div><form id="product-form" data-id="'+esc(p.slug||'')+'"><div class="form-grid"><div><section class="panel"><h2>Об изделии</h2><div class="field"><label for="name">Название</label><input type="text" name="name" id="name" maxlength="160" required value="'+esc(p.name)+'" autocomplete="off"></div><div class="two-columns"><div class="field"><label for="price">Цена, ₽</label><input type="text" name="price" id="price" inputmode="decimal" maxlength="15" value="'+(editing?esc(inputMoney(p.price_minor)):'')+'" placeholder="2300,00" required><p class="help">Рубли и, при необходимости, копейки через запятую.</p></div><div class="field"><label for="sort_order">Порядок отображения</label><input type="number" name="sort_order" id="sort_order" min="0" max="1000000" step="1" value="'+esc(p.sort_order)+'" required><p class="help">Меньшее число — ближе к началу каталога.</p></div></div><div class="field"><label for="subtitle">Краткая подпись</label><input type="text" name="subtitle" id="subtitle" maxlength="300" value="'+esc(p.subtitle)+'"></div><div class="field"><label for="description">Описание</label><textarea name="description" id="description" maxlength="10000" rows="6">'+esc(p.description)+'</textarea><p class="help">Обычный текст, без HTML.</p></div><fieldset><legend>Категории</legend><div class="checks">'+Object.entries(labels).map(([slug,label])=>'<label class="check"><input type="checkbox" name="categories" value="'+slug+'" '+((p.categories||[]).includes(slug)?'checked':'')+'>'+label+'</label>').join('')+'</div><p class="help">Выберите хотя бы одну категорию. Можно выбрать несколько.</p></fieldset><div class="field"><label for="original_url">Исходная карточка — необязательно</label><input type="url" name="original_url" id="original_url" maxlength="2000" value="'+esc(p.original_url)+'" placeholder="https://"><p class="help">Допускается только ссылка с https://. Фотография по ссылке не загружается.</p></div></section></div><div><section class="panel"><h2>Фотография</h2><img class="current-image" id="photo-preview" '+(editing?'src="'+esc(photo(p.image_path))+'"':'hidden')+' alt="'+esc(p.image_alt||'Предпросмотр выбранной фотографии')+'"><div class="field"><label for="image">'+(editing?'Заменить фотографию':'Загрузить фотографию')+'</label><input type="file" name="image" id="image" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" '+(editing?'':'required')+'><p class="help">JPEG, PNG или WebP до 10 МБ. В этой демонстрации фото уменьшается до 1600 пикселей для хранения в браузере.'+(editing?' Оставьте поле пустым, чтобы сохранить текущую фотографию. При замене точное наложение гравировки отключается.':'')+'</p></div><div class="field"><label for="image_alt">Описание фотографии</label><input type="text" name="image_alt" id="image_alt" maxlength="300" value="'+esc(p.image_alt)+'"><p class="help">Кратко опишите, что изображено, для посетителей с нарушениями зрения.</p></div></section><section class="panel"><h2>Публикация и персонализация</h2><div class="field"><label class="check"><input type="checkbox" name="is_active" value="1" '+(p.is_active?'checked':'')+'>Опубликовать на сайте</label><p class="help">Скрытый товар остаётся в админке и недоступен посетителям.</p></div><div class="field"><label class="check"><input type="checkbox" name="personalization_enabled" value="1" '+(p.personalization_enabled?'checked':'')+'>Разрешить персонализацию</label><p class="help">Для исходных изделий сохранены индивидуальные поверхности гравировки. Для нового изделия используется нейтральный предпросмотр без точного наложения на фотографию.</p></div></section></div></div><div class="form-footer"><button class="button" type="submit">'+(editing?'Сохранить изменения':'Добавить товар')+'</button><a class="button secondary" href="index.html" data-view="">Вернуться к каталогу</a></div></form>');
  }
  function settings() {
    const all = products().filter(p=>p.is_active);
    shell('<div class="page-heading"><div><p class="eyebrow">Мастерская · Настройки</p><h1>Настройки сайта</h1><p class="intro">Первый экран и демонстрационный ассортимент.</p></div></div><section class="panel"><h2>Выбор изделия для первого экрана</h2><p class="help">Если выбранное изделие скрыть или удалить, сайт покажет другое опубликованное изделие.</p><form id="hero-form"><div class="field"><label for="hero-product">Изделие</label><select id="hero-product" name="hero_product" '+(!all.length?'disabled':'')+'>'+all.map(p=>'<option value="'+esc(p.slug)+'" '+(store.getHero()===p.slug?'selected':'')+'>'+esc(p.name)+' · '+esc(money(p.price_minor))+'</option>').join('')+(!all.length?'<option>Нет опубликованных изделий</option>':'')+'</select></div><button type="submit" class="button" '+(!all.length?'disabled':'')+'>Сохранить первый экран</button></form></section><section class="panel"><h2>О демонстрации</h2><p class="demo-technical-note">Каталог этой версии хранится только в вашем браузере. В полноценной PHP-версии есть серверная авторизация, смена пароля и резервные копии базы. Здесь демонстрационный вход не защищает данные и не требует настоящего пароля.</p></section>'+resetControl());
  }
  function render() {
    if (!entered) return login();
    const query = new URLSearchParams(location.search);
    const view = query.get('view') || '';
    if (view === 'create') return form(null);
    if (view === 'edit') {
      const p = find(query.get('id'));
      if (!p) return shell('<section class="panel"><h1>Товар не найден</h1><p>Возможно, его уже удалили.</p><a class="button" href="index.html" data-view="">Вернуться к каталогу</a></section>');
      return form(p);
    }
    if (view === 'settings') return settings();
    dashboard();
  }
  function showError(error) {
    const message = error && error.message ? error.message : 'Не удалось сохранить изменения в браузере. Проверьте доступность хранилища и свободное место.';
    const box = document.getElementById('form-errors');
    if (box) { box.hidden = false; box.className='errors'; box.textContent = message; box.scrollIntoView({block:'center'}); }
    else { notice=message; render(); const box=app.querySelector('.notice');if(box){box.classList.add('demo-error');box.setAttribute('role','alert');} }
  }
  function parsePrice(text) {
    const match = /^(0|[1-9]\d{0,8})(?:[,.](\d{1,2}))?$/.exec(text.trim());
    if (!match) throw new Error('Укажите цену от 0 до 999999999,99 ₽, не более двух знаков после запятой.');
    return Number(match[1])*100 + Number((match[2]||'').padEnd(2,'0'));
  }
  async function decodePhoto(file) {
    if (file.size > 10*1024*1024 || !/\.(jpe?g|png|webp)$/i.test(file.name) || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Выберите JPEG, PNG или WebP размером до 10 МБ.');
    const bytes = new Uint8Array(await file.slice(0,16).arrayBuffer());
    const raster = bytes[0]===255&&bytes[1]===216&&bytes[2]===255 || bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71 || String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
    if (!raster) throw new Error('Файл не является поддерживаемой растровой фотографией.');
    let bitmap;
    try { bitmap=await createImageBitmap(file); } catch (_) { throw new Error('Не удалось прочитать фотографию. Выберите другой файл.'); }
    try {
      if (!bitmap.width || !bitmap.height || bitmap.width>6000 || bitmap.height>6000 || bitmap.width*bitmap.height>12000000) throw new Error('Фотография должна быть до 6000 × 6000 пикселей и не более 12 миллионов пикселей.');
      const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const ctx=canvas.getContext('2d');ctx.fillStyle='#f5f3ed';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      return {image_path:canvas.toDataURL('image/jpeg',.87),image_width:canvas.width,image_height:canvas.height};
    } finally { bitmap.close(); }
  }
  async function saveForm(form) {
    const existing = find(form.dataset.id);
    const data = new FormData(form);
    const name=String(data.get('name')||'').trim();
    if (!name || name.length>160) throw new Error('Укажите название длиной до 160 символов.');
    const categories=data.getAll('categories').filter(c=>Object.hasOwn(labels,c));
    if (!categories.length) throw new Error('Выберите хотя бы одну категорию.');
    const order=String(data.get('sort_order')||'');
    if (!/^\d{1,7}$/.test(order)||Number(order)>1000000) throw new Error('Порядок должен быть целым числом от 0 до 1000000.');
    const originalUrl=String(data.get('original_url')||'').trim();
    if (originalUrl) { let url;try{url=new URL(originalUrl);}catch(_){throw new Error('Укажите полную HTTPS-ссылку.');}if(url.protocol!=='https:'||url.username||url.password||/[\x00-\x20]/.test(originalUrl))throw new Error('Разрешена только HTTPS-ссылка без логина и пароля.'); }
    const all=products();
    const now=new Date().toISOString();
    const p=existing ? {...existing} : {id:Math.max(0,...all.map(x=>Number(x.id)||0))+1,slug:'item-'+crypto.randomUUID().replaceAll('-','').slice(0,20),created_at:now,version:0,personalization_geometry:null,hero_image_path:null,product_tag:''};
    Object.assign(p,{name,price_minor:parsePrice(String(data.get('price')||'')),subtitle:String(data.get('subtitle')||'').trim(),description:String(data.get('description')||'').trim(),image_alt:String(data.get('image_alt')||'').trim(),original_url:originalUrl,categories,sort_order:Number(order),is_active:data.get('is_active')?1:0,personalization_enabled:data.get('personalization_enabled')?1:0,updated_at:now,version:(Number(p.version)||0)+1});
    const file=data.get('image');
    if (file && file.size) { Object.assign(p,await decodePhoto(file));p.personalization_geometry=null;p.hero_image_path=null; }
    if (!p.image_path) throw new Error('Загрузите фотографию нового товара.');
    const next=existing?all.map(x=>x.slug===p.slug?p:x):[...all,p];
    await store.saveProducts(next);
    notice=existing?'Изменения сохранены в этом браузере. Откройте сайт, чтобы увидеть обновлённый товар.':'Товар добавлен в демонстрационный каталог этого браузера.';
    go('edit',p.slug);
  }
  app.addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.target;
    if (form.id==='filter-form') {
      const data=new FormData(form),q=String(data.get('q')||'').trim().toLocaleLowerCase('ru'),status=data.get('status'),category=data.get('category');
      drawRows(products().filter(p=>(!q||p.name.toLocaleLowerCase('ru').includes(q))&&(!status||(status==='active'?p.is_active:!p.is_active))&&(!category||p.categories.includes(category))));return;
    }
    const button=form.querySelector('button[type="submit"]');if(button)button.disabled=true;
    try {
      if(form.id==='product-form') await saveForm(form);
      if(form.id==='hero-form'){await store.setHero(String(new FormData(form).get('hero_product')||''));notice='Первый экран сохранён в этом браузере.';render();}
    } catch(error){showError(error);}finally{if(button)button.disabled=false;}
  });
  app.addEventListener('change',async event=>{
    if(event.target.id!=='image'||!event.target.files?.length)return;
    try{const image=await decodePhoto(event.target.files[0]);const preview=document.getElementById('photo-preview');preview.src=image.image_path;preview.hidden=false;}
    catch(error){
      event.target.value='';
      const existing=find(document.getElementById('product-form')?.dataset.id);
      const preview=document.getElementById('photo-preview');
      if(existing){preview.src=photo(existing.image_path);preview.hidden=false;}else{preview.removeAttribute('src');preview.hidden=true;}
      showError(error);
    }
  });
  app.addEventListener('click',async event=>{
    const navigation=event.target.closest('[data-view]');
    if(navigation){event.preventDefault();go(navigation.dataset.view,navigation.dataset.id||'');return;}
    const button=event.target.closest('[data-action]');if(!button)return;
    const action=button.dataset.action;
    if(action==='enter'){entered=true;try{sessionStorage.setItem(entryKey,'yes');}catch(_){}render();return;}
    if(action==='exit'){entered=false;try{sessionStorage.removeItem(entryKey);}catch(_){}go();return;}
    button.disabled=true;
    try {
      if(action==='reset'){
        if(!confirm('Сбросить все демонстрационные изменения в этом браузере и вернуть шесть исходных товаров?'))return;
        await store.reset();notice='Восстановлены все шесть исходных товаров, фотографии, цены и настройки.';go();return;
      }
      const all=products(),id=button.dataset.id,p=all.find(x=>x.slug===id);if(!p)throw new Error('Товар не найден. Обновите страницу.');
      if(action==='delete'){
        if(!confirm('Удалить «'+p.name+'» из демонстрационного каталога?'))return;
        await store.saveProducts(all.filter(x=>x.slug!==id));notice='Товар удалён из этого браузера.';
      } else if(action==='toggle'){
        await store.saveProducts(all.map(x=>x.slug===id?{...x,is_active:x.is_active?0:1,version:(x.version||1)+1}:x));notice=p.is_active?'Товар скрыт в этом браузере.':'Товар опубликован в этом браузере.';
      } else if(action==='up'||action==='down'){
        const index=all.findIndex(x=>x.slug===id),target=index+(action==='up'?-1:1);
        if(target<0||target>=all.length)return;
        [all[index],all[target]]=[all[target],all[index]];
        await store.saveProducts(all.map((x,i)=>({...x,sort_order:i+1,version:(x.version||1)+1})));notice='Порядок товаров сохранён в этом браузере.';
      }
      render();
    } catch(error){showError(error);}finally{if(button.isConnected)button.disabled=false;}
  });
  window.addEventListener('popstate',()=>render());
  async function start(){
    try{store=window.HW_DEMO;if(!store)throw new Error('Не удалось загрузить демонстрационный каталог. Обновите страницу.');await store.ready();render();}
    catch(error){app.innerHTML='<main class="container"><section class="panel"><h1>Демонстрационный каталог недоступен</h1><p role="alert">'+esc(error.message)+'</p><p>Разрешите этому сайту хранение данных в браузере и обновите страницу.</p><a href="../">Открыть сайт</a></section></main>';}
  }
  start();
})();
