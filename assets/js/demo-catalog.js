/* Render the browser demo state before the unchanged HOMEWOOD interactions initialize. */
(() => {
  'use strict';
  const store = window.HW_DEMO;
  const text = (root, selector, value) => { const node = root.querySelector(selector); if (node) node.textContent = value; };
  const price = amount => {
    const whole = String(Math.floor(amount / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const minor = amount % 100;
    return whole + (minor ? ',' + String(minor).padStart(2,'0') : '') + ' ₽';
  };
  function render() {
    const products = store.getProducts().filter(p => p.is_active);
    const grid = document.getElementById('product-grid');
    const prototype = grid.querySelector('.product-card').cloneNode(true);
    const cards = products.map((product, index) => {
      const card = prototype.cloneNode(true);
      card.id = 'product-' + product.slug;
      card.className = 'product-card reveal' + (index % 3 ? ' delay-' + (index % 3 * 90) : '') + (!product.personalization_geometry ? ' has-neutral-image' : '');
      card.dataset.product = product.slug;
      card.dataset.productUrl = product.original_url;
      card.dataset.category = product.categories.join(' ');
      card.dataset.personalization = String(product.personalization_enabled ? 1 : 0);
      card.dataset.geometry = product.personalization_geometry ? JSON.stringify(product.personalization_geometry) : '';
      const image = card.querySelector('.product-image img');
      image.src = store.imageUrl(product.image_path); image.alt = product.image_alt;
      image.width = product.image_width; image.height = product.image_height;
      const heading = card.querySelector('.product-row h3');
      heading.id = 'product-title-' + product.slug;
      card.querySelectorAll('[aria-describedby]').forEach(node => node.setAttribute('aria-describedby', heading.id));
      text(card,'.product-row h3',product.name); text(card,'.product-row strong',price(product.price_minor));
      text(card,'.modal-copy h2',product.name); text(card,'.modal-price',price(product.price_minor));
      text(card,'.modal-description',product.description); text(card,'.product-meta span:first-child',product.subtitle);
      text(card,'.product-meta span:last-child',String(index+1).padStart(2,'0')+' / '+String(products.length).padStart(2,'0'));
      const tag = card.querySelector('.product-tag'); if (tag) { tag.textContent = product.product_tag; tag.hidden = !product.product_tag; }
      card.querySelectorAll('.order-contact strong').forEach(node => node.textContent = product.name);
      const mail = 'mailto:ivan.teterin@vk.com?subject=' + encodeURIComponent('Заказ ХОУМ ВУД — ' + product.name) + '&body=' + encodeURIComponent('Здравствуйте! Хочу обсудить заказ: ' + product.name + '.\r\nЦена по каталогу: ' + price(product.price_minor) + '.');
      card.querySelectorAll('.order-contact a[href^="mailto:"]').forEach(node => node.href = mail);
      const original = card.querySelector('.modal-original');
      if (original) { original.hidden = !product.original_url; if (product.original_url) original.href = product.original_url; else original.removeAttribute('href'); }
      return card;
    });
    grid.replaceChildren(...cards);
    if (!products.length) { const empty = document.createElement('p'); empty.className = 'catalog-empty'; empty.textContent = 'Сейчас в каталоге нет опубликованных изделий. Обсудите вашу идею с мастерской.'; grid.append(empty); }
    const hero = products.find(p => p.slug === store.getHero()) || products[0];
    const heroPanel = document.querySelector('.hero-product');
    const heroImage = document.querySelector('.hero-camera img');
    if (hero) {
      heroImage.src = store.imageUrl(hero.hero_image_path || hero.image_path); heroImage.alt = hero.image_alt;
      heroImage.width = hero.hero_image_path ? 1680 : hero.image_width; heroImage.height = hero.hero_image_path ? 2250 : hero.image_height;
      document.querySelector('.hero-visual').classList.toggle('has-neutral-image', !hero.hero_image_path);
      let title = hero.name.replace(/^Резная /u,''); title = title.charAt(0).toUpperCase()+title.slice(1);
      text(heroPanel,'strong',title); text(heroPanel,'small',hero.hero_image_path ? 'В кадре / Резная шкатулка' : 'В кадре / ' + (hero.subtitle || hero.name));
      text(heroPanel,'.price',price(hero.price_minor));
      const button = heroPanel.querySelector('.zoom-product'); button.dataset.product = hero.slug; button.href = '#product-title-' + hero.slug; button.setAttribute('aria-label','Посмотреть ' + hero.name + ' крупнее');
    } else { heroPanel.hidden = true; heroImage.hidden = true; }
    const personal = products.filter(p => p.personalization_enabled);
    const select = document.getElementById('personal-product'); select.replaceChildren(...personal.map(p => new Option(p.name,p.slug)));
    const request = document.getElementById('request-product'); request.replaceChildren(new Option('Свой заказ / для компании','other'),...products.map(p => new Option(p.name,p.slug)));
    const preview = document.querySelector('.personal-preview'); preview.hidden = !personal.length;
    if (personal.length) {
      const first = personal[0], stage = document.querySelector('.preview-stage'), img = document.getElementById('preview-image');
      stage.dataset.product = first.slug; stage.classList.toggle('has-neutral-image', !first.personalization_geometry);
      img.src = store.imageUrl(first.image_path); img.alt = first.image_alt; img.width = first.image_width; img.height = first.image_height;
      document.getElementById('preview-caption').textContent = first.name;
    } else document.querySelector('.personal-fallback').textContent = 'Сейчас нет изделий для предпросмотра персонализации. Обсудите вашу идею с мастерской.';
    const gory = products.find(p => p.slug === 'gory');
    text(document,'.workshop-gallery legend',gory ? 'Детали: '+gory.name : 'Детали работы мастерской');
    text(document,'.workshop-note span',gory ? gory.name.replace(/^Резная /u,'')+' / Детали' : 'Мастерская / Детали');
  }
  function loadScript(name) {
    return new Promise((resolve,reject) => { const script=document.createElement('script'); script.src=new URL('assets/js/'+name,store.baseUrl).href; script.onload=resolve; script.onerror=reject; document.body.append(script); });
  }
  (async () => {
    try { await store.ready(); render(); }
    catch (error) {
      const warning=document.createElement('p'); warning.className='no-script'; warning.setAttribute('role','alert'); warning.textContent=error.message; document.querySelector('.footer-bottom').before(warning);
    }
    await loadScript('homewood.js');
    await loadScript('engraving.js');
    if (location.hash) {
      try { document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ block: 'start' }); } catch (_) { /* Ignore malformed fragment identifiers. */ }
    }
    store.subscribe(() => location.reload());
    window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  })().catch(() => { document.documentElement.classList.remove('js'); });
})();
