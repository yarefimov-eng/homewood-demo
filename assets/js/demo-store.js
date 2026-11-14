/* Browser-only demonstration storage. This is not server authorization or a database shared by visitors. */
(() => {
  'use strict';
  // Project Pages can inherit the account's custom domain with an HTTP redirect.
  // Keep this demo on HTTPS without changing the account's other Pages sites.
  if (location.protocol === 'http:' && !['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname)) {
    const secureUrl = new URL(location.href);
    secureUrl.protocol = 'https:';
    location.replace(secureUrl.href);
    return;
  }
  const baseUrl = new URL('../../', document.currentScript.src);
  const databaseName = 'homewood-demo:' + baseUrl.pathname;
  const copy = value => JSON.parse(JSON.stringify(value));
  const initial = () => ({ version: 1, products: copy(window.HW_DEMO_SEED), hero_product: 'gory' });
  let state = initial();
  let database = null;
  let opening = null;
  const listeners = new Set();
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(databaseName) : null;
  const safeImage = value => typeof value === 'string' && (/^assets\/images\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|svg)$/.test(value) || /^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(value));
  const imageUrl = value => safeImage(value) ? (value.startsWith('data:') ? value : new URL(value, baseUrl).href) : new URL('assets/images/unavailable.svg', baseUrl).href;
  function cleanProducts(products) {
    if (!Array.isArray(products) || products.length > 200) throw new Error('В демоверсии можно сохранить не более 200 товаров.');
    const ids = new Set(), slugs = new Set();
    return products.map(source => {
      const p = copy(source);
      if (!Number.isSafeInteger(p.id) || p.id < 1 || ids.has(p.id) || typeof p.slug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(p.slug) || slugs.has(p.slug)) throw new Error('Некорректный идентификатор товара.');
      ids.add(p.id); slugs.add(p.slug);
      for (const [field, maximum] of [['name',160],['subtitle',300],['description',10000],['image_alt',300],['product_tag',100]]) {
        p[field] = typeof p[field] === 'string' ? p[field].trim() : '';
        if (p[field].length > maximum || p[field].includes('\0') || (field === 'name' && !p[field])) throw new Error('Проверьте название и длину полей товара.');
      }
      if (!Number.isSafeInteger(p.price_minor) || p.price_minor < 0 || p.price_minor > 99999999999) throw new Error('Укажите допустимую цену в рублях и копейках.');
      if (!Number.isSafeInteger(p.sort_order) || p.sort_order < 0 || p.sort_order > 1000000) throw new Error('Укажите целый порядок от 0 до 1000000.');
      if (!Array.isArray(p.categories) || !p.categories.length || p.categories.some(x => !['gift','desk','kitchen'].includes(x))) throw new Error('Выберите допустимые категории.');
      p.categories = [...new Set(p.categories)];
      p.is_active = p.is_active ? 1 : 0; p.personalization_enabled = p.personalization_enabled ? 1 : 0;
      if (!safeImage(p.image_path) || p.image_path.length > 8 * 1024 * 1024) throw new Error('Выберите JPEG, PNG или WebP размером до 5 МБ.');
      p.hero_image_path = p.hero_image_path && safeImage(p.hero_image_path) ? p.hero_image_path : null;
      p.original_url = typeof p.original_url === 'string' ? p.original_url.trim() : '';
      if (p.original_url) { let u; try { u = new URL(p.original_url); } catch (_) {} if (!u || u.protocol !== 'https:' || u.username || u.password || p.original_url.length > 2000) throw new Error('Для исходной карточки разрешена только полная HTTPS-ссылка.'); }
      p.image_width = Math.max(1, Math.min(6000, Number(p.image_width) || 1024));
      p.image_height = Math.max(1, Math.min(6000, Number(p.image_height) || 1024));
      p.personalization_geometry = p.personalization_geometry && Array.isArray(p.personalization_geometry.corners) && p.personalization_geometry.corners.length === 4 ? p.personalization_geometry : null;
      return p;
    });
  }
  function readState() {
    return new Promise((resolve, reject) => {
      const tx = database.transaction('catalog', 'readonly');
      const request = tx.objectStore('catalog').get('state');
      request.onsuccess = () => resolve(request.result || initial());
      request.onerror = () => reject(request.error || new Error('Не удалось прочитать демонстрационный каталог.'));
    });
  }
  function ready() {
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('Браузер не поддерживает хранение демонстрационного каталога.')); return; }
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('catalog');
      request.onblocked = () => reject(new Error('Закройте старые вкладки демоверсии и обновите страницу.'));
      request.onerror = () => reject(new Error('Не удалось открыть хранилище браузера. Разрешите данные сайта и обновите страницу.'));
      request.onsuccess = async () => {
        database = request.result;
        database.onversionchange = () => database.close();
        try { state = await readState(); state.products = cleanProducts(state.products); resolve(); }
        catch (error) { reject(error); }
      };
    });
    return opening;
  }
  async function saveState(next) {
    await ready();
    const checked = { version: 1, products: cleanProducts(next.products), hero_product: String(next.hero_product || 'gory') };
    await new Promise((resolve, reject) => {
      const tx = database.transaction('catalog', 'readwrite');
      tx.objectStore('catalog').put(checked, 'state');
      tx.oncomplete = resolve;
      tx.onerror = tx.onabort = () => reject(new Error('Не удалось сохранить изменения в браузере. Возможно, закончилось доступное место.'));
    });
    state = checked;
    channel?.postMessage('changed');
    listeners.forEach(fn => fn());
  }
  channel?.addEventListener('message', async () => {
    if (!database) return;
    try { state = await readState(); listeners.forEach(fn => fn()); } catch (_) { /* Retain the last usable catalogue. */ }
  });
  window.HW_DEMO = {
    baseUrl,
    ready,
    getProducts: () => copy(state.products).sort((a,b) => a.sort_order - b.sort_order || a.id - b.id),
    saveProducts: products => saveState({ ...state, products }),
    reset: () => saveState(initial()),
    getHero: () => state.hero_product || 'gory',
    setHero: slug => saveState({ ...state, hero_product: slug }),
    imageUrl,
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); }
  };
})();
