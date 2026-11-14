
(function () {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(max-width: 900px)');
  const listenMedia = (query, callback) => {
    if (query.addEventListener) query.addEventListener('change', callback);
    else if (query.addListener) query.addListener(callback);
  };
  const focusable = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]';
  const visibleControls = root => $$(focusable, root).filter(node => !node.closest('[hidden]') && !node.closest('[inert]') && node.getClientRects().length);
  document.documentElement.classList.add('js');

  // Navigation remains accessible without JavaScript; the collapsed state is enhanced here.
  const menuButton = $('.menu-toggle');
  const menu = $('#main-nav');
  const header = $('.site-header');
  const dialog = $('#product-dialog');
  function sizeOpenMenu() {
    if (header && menu?.classList.contains('is-open')) {
      menu.style.setProperty('--menu-top', Math.max(0, header.getBoundingClientRect().bottom) + 'px');
    }
  }
  function setMenu(open, returnFocus = false) {
    if (!menu || !menuButton) return;
    const expanded = mobile.matches && open;
    menu.classList.toggle('is-open', expanded);
    menuButton.setAttribute('aria-expanded', String(expanded));
    menuButton.setAttribute('aria-label', expanded ? 'Закрыть меню' : 'Открыть меню');
    menu.inert = mobile.matches && !expanded;
    if (mobile.matches) menu.setAttribute('aria-hidden', String(!expanded));
    else menu.removeAttribute('aria-hidden');
    sizeOpenMenu();
    if (returnFocus) menuButton.focus({ preventScroll: true });
  }
  if (menu && menuButton && header) {
    setMenu(false);
    header.classList.add('nav-ready');
    menuButton.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
    $$('a[href^="#"]', header).forEach(link => link.addEventListener('click', () => {
      // Let the browser follow the anchor before making its link inert.
      if (menu.classList.contains('is-open')) requestAnimationFrame(() => setMenu(false));
    }));
    document.addEventListener('pointerdown', event => {
      if (menu.classList.contains('is-open') && !menu.contains(event.target) && !menuButton.contains(event.target)) setMenu(false);
    });
    listenMedia(mobile, () => setMenu(false));
    document.addEventListener('keydown', event => {
      if (!mobile.matches || !menu.classList.contains('is-open')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenu(false, true);
      } else if (event.key === 'Tab') {
        const controls = [menuButton, ...visibleControls(menu)];
        const current = controls.indexOf(document.activeElement);
        const next = current < 0 ? 0 : (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
        event.preventDefault();
        controls[next].focus();
      }
    });
  }

  // One frame per scroll event; no idle animation loop.
  const progress = $('.scroll-progress');
  const page = document.scrollingElement || document.documentElement;
  let scrollFrame = 0;
  function paintScroll() {
    scrollFrame = 0;
    const max = page.scrollHeight - page.clientHeight;
    const amount = max > 0 ? Math.min(1, Math.max(0, page.scrollTop / max)) : 0;
    if (progress) progress.style.transform = 'scaleX(' + amount + ')';
    if (header) header.classList.toggle('is-scrolled', page.scrollTop > 24);
    sizeOpenMenu();
  }
  function requestScrollPaint() {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(paintScroll);
  }
  window.addEventListener('scroll', requestScrollPaint, { passive: true });
  window.addEventListener('resize', requestScrollPaint, { passive: true });
  paintScroll();
  window.addEventListener('load', requestScrollPaint, { once: true });
  if ('ResizeObserver' in window) new ResizeObserver(requestScrollPaint).observe(document.body);

  // Reveal only once. Reduced motion shows all content immediately.
  const reveals = $$('.reveal');
  let revealObserver = null;
  function showReveal(element) {
    element.classList.add('is-visible');
    revealObserver?.unobserve(element);
  }
  function showAllReveals() {
    if (revealObserver) revealObserver.disconnect();
    reveals.forEach(element => element.classList.add('is-visible'));
  }
  if ('IntersectionObserver' in window && !motion.matches) {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) showReveal(entry.target);
      });
    }, { rootMargin: '0px 0px -24px 0px' });
    reveals.forEach(element => revealObserver.observe(element));
    document.addEventListener('focusin', event => {
      const element = event.target.closest('.reveal:not(.is-visible)');
      if (element) showReveal(element);
    });
  } else showAllReveals();

  if ('IntersectionObserver' in window && !motion.matches) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.remove('awaiting-entrance');
        observer.unobserve(entry.target);
      }
    });
    for (const part of $$('.hero-copy')) {
      part.classList.add('awaiting-entrance');
      observer.observe(part);
    }
  }

  listenMedia(motion, () => {
    if (!motion.matches) return;
    showAllReveals();
    stopCatalogAnimations();
    stopPhotoTransition();
  });

  // Server-rendered SQLite catalog supplies data to every product control.
  const cards = $$('#product-grid .product-card[data-product]');
  const productById = new Map();
  function readGeometry(value) {
    try { return value ? JSON.parse(value) : null; } catch (_) { return null; }
  }
  for (const card of cards) {
    const id = card.dataset.product;
    const name = $('.product-row h3', card)?.textContent.trim();
    if (!id || !name || productById.has(id)) continue;
    const photo = $('.product-image img', card);
    productById.set(id, {
      id,
      name,
      price: $('.product-row strong', card)?.textContent.trim() || '',
      src: photo?.getAttribute('src') || '',
      alt: photo?.alt || name,
      width: Number(photo?.getAttribute('width')) || 1024,
      height: Number(photo?.getAttribute('height')) || 1024,
      url: card.dataset.productUrl || '',
      description: $('.modal-description', card)?.textContent.trim() || '',
      personalizationEnabled: card.dataset.personalization === '1',
      geometry: readGeometry(card.dataset.geometry)
    });
  }

  function addProductOptions(select, personalOnly = false) {
    if (!select) return;
    // Keep the general request option; replace SSR products without duplicating them.
    Array.from(select.options).filter(option => option.value !== 'other').forEach(option => option.remove());
    for (const product of productById.values()) {
      if (!personalOnly || product.personalizationEnabled) select.add(new Option(product.name, product.id));
    }
  }

  const heroProductButton = $('.hero-product .zoom-product');
  const heroProduct = productById.get(heroProductButton?.dataset.product);
  const heroPrice = $('.hero-product .price');
  if (heroPrice && heroProduct?.price) {
    heroPrice.textContent = heroProduct.price;
    heroPrice.hidden = false;
  }
  if (heroProductButton && !heroProduct) heroProductButton.hidden = true;

  const filters = $$('.filter-button');
  const catalogStatus = $('.catalog-status');
  const catalogControls = $('.collection-controls');
  const catalogCount = $('.filter-button[data-filter="all"] span');
  if (catalogCount) catalogCount.textContent = String(cards.length).padStart(2, '0');
  function showCatalogCount(count) {
    if (catalogStatus) catalogStatus.textContent = 'Изделий в подборке: ' + count + ' из ' + cards.length;
  }
  showCatalogCount(cards.length);
  if (catalogControls && cards.length) catalogControls.hidden = false;
  let filterGeneration = 0;
  const catalogAnimations = new Set();
  function stopCatalogAnimations() {
    catalogAnimations.forEach(animation => animation.cancel());
    catalogAnimations.clear();
  }
  function animateCard(card, entering, index) {
    if (motion.matches || !card.animate) return Promise.resolve();
    const animation = card.animate(
      entering ? [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0)' }]
        : [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(8px)' }],
      { duration: entering ? 330 : 130, delay: entering ? index * 35 : 0, easing: 'cubic-bezier(.2,.7,.2,1)', fill: entering ? 'backwards' : 'forwards' }
    );
    catalogAnimations.add(animation);
    return animation.finished.catch(() => {}).finally(() => {
      if (entering) catalogAnimations.delete(animation);
    });
  }
  async function applyFilter(button) {
    const generation = ++filterGeneration;
    const filter = button.dataset.filter || 'all';
    filters.forEach(item => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    const matches = card => filter === 'all' || (card.dataset.category || '').split(/\s+/).includes(filter);
    const shown = cards.filter(matches);
    shown.forEach((card, index) => {
      const ordinal = $('.product-meta span:last-child', card);
      if (ordinal) ordinal.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(shown.length).padStart(2, '0');
    });
    showCatalogCount(shown.length);
    stopCatalogAnimations();
    await Promise.all(cards.filter(card => !card.hidden && !matches(card)).map((card, index) => animateCard(card, false, index)));
    if (generation !== filterGeneration) return;
    cards.forEach(card => { card.hidden = !matches(card); });
    stopCatalogAnimations();
    shown.forEach((card, index) => {
      showReveal(card);
      animateCard(card, true, index);
    });
    requestScrollPaint();
  }
  filters.forEach(button => button.addEventListener('click', () => applyFilter(button)));

  // The native dialog supplies focus containment and Escape handling.
  const nativeDialog = typeof dialog?.showModal === 'function';
  let dialogInvoker = null;
  let modalProduct = null;
  const modalContent = dialog && $('.modal-content', dialog);
  const modalLink = dialog && $('.modal-original', dialog);
  const catalogUrl = modalLink?.getAttribute('href');

  let photoFlight = null;

  function stopPhotoTransition() {
    if (!photoFlight) return;
    const { animation, ghost, target } = photoFlight;
    photoFlight = null;
    animation.cancel();
    ghost.remove();
    target.classList.remove('is-in-flight');
  }

  function imageRect(image, naturalWidth, naturalHeight) {
    const bounds = image.getBoundingClientRect();
    const style = getComputedStyle(image);
    const fit = style.objectFit === 'cover' ? Math.max : Math.min;
    const scale = fit(bounds.width / naturalWidth, bounds.height / naturalHeight);
    const width = naturalWidth * scale;
    const height = naturalHeight * scale;
    const position = style.objectPosition.split(' ').map(parseFloat);
    return {
      left: bounds.left + (bounds.width - width) * position[0] / 100,
      top: bounds.top + (bounds.height - height) * position[1] / 100,
      width,
      height
    };
  }

  function animateProductPhoto(source, target, trigger) {
    const from = imageRect(source, source.naturalWidth, source.naturalHeight);
    const to = imageRect(target, source.naturalWidth, source.naturalHeight);
    const clip = trigger.getBoundingClientRect();
    if (!from.width || !to.width || !to.height) return;
    const top = Math.max(0, Math.max(clip.top, 0) - from.top) / from.height * 100;
    const left = Math.max(0, Math.max(clip.left, 0) - from.left) / from.width * 100;
    const right = Math.max(0, from.left + from.width - Math.min(clip.right, window.innerWidth)) / from.width * 100;
    const bottom = Math.max(0, from.top + from.height - Math.min(clip.bottom, window.innerHeight)) / from.height * 100;
    if (top + bottom >= 100 || left + right >= 100) return;
    const ghost = new Image();
    ghost.src = source.currentSrc || source.src;
    ghost.className = 'modal-photo-flight';
    ghost.alt = '';
    ghost.setAttribute('aria-hidden', 'true');
    Object.assign(ghost.style, { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px' });
    dialog.classList.add('photo-transition');
    target.classList.add('is-in-flight');
    dialog.append(ghost);
    const animation = ghost.animate([
      {
        transform: 'translate(' + (from.left - to.left) + 'px,' + (from.top - to.top) + 'px) scale(' + (from.width / to.width) + ')',
        clipPath: 'inset(' + [top, right, bottom, left].map(value => value + '%').join(' ') + ')'
      },
      { transform: 'none', clipPath: 'inset(0%)' }
    ], { duration: 340, easing: 'cubic-bezier(.22,.75,.22,1)', fill: 'both' });
    photoFlight = { animation, ghost, target };
    animation.finished.then(() => {
      if (photoFlight?.animation === animation) stopPhotoTransition();
    }, () => {});
  }

  function openProduct(id, invoker) {
    const product = productById.get(String(id));
    if (!dialog || dialog.hasAttribute('open') || !product) return;
    modalProduct = product;
    dialogInvoker = invoker || document.activeElement;
    const image = $('.modal-image', dialog);
    const title = $('#modal-title', dialog);
    const price = $('.modal-price', dialog);
    const description = $('.modal-description', dialog);
    if (image) {
      image.hidden = !product.src;
      if (product.src) {
        image.width = product.width;
        image.height = product.height;
        image.src = product.src;
        image.alt = product.alt;
      } else image.removeAttribute('src');
    }
    dialog.classList.toggle('without-photo', !product.src);
    if (title) title.textContent = product.name;
    if (price) price.textContent = product.price;
    if (description) description.textContent = product.description;
    if (modalLink) {
      let safeUrl = '';
      try { const url = new URL(product.url); if (url.protocol === 'https:' && !url.username && !url.password) safeUrl = url.href; } catch (_) { /* No external URL. */ }
      modalLink.hidden = !safeUrl;
      if (safeUrl) modalLink.href = safeUrl; else modalLink.removeAttribute('href');
    }
    const source = invoker?.classList.contains('product-image') && $('img', invoker);
    document.body.classList.add('dialog-open');
    if (nativeDialog) dialog.showModal();
    else dialog.setAttribute('open', '');
    if (modalContent) modalContent.scrollTop = 0;
    const close = $('[data-close-dialog]', dialog);
    if (close) close.focus({ preventScroll: true });
    if (source?.complete && source.naturalWidth && !motion.matches && nativeDialog && image?.animate) {
      animateProductPhoto(source, image, invoker);
    }
  }
  function afterDialogClose() {
    if (dialog.hasAttribute('open')) return;
    stopPhotoTransition();
    dialog.classList.remove('photo-transition');
    document.body.classList.remove('dialog-open');
    const invoker = dialogInvoker;
    dialogInvoker = null;
    if (invoker?.isConnected) invoker.focus({ preventScroll: true });
  }
  function closeDialog() {
    if (!dialog || !dialog.hasAttribute('open')) return;
    if (nativeDialog) dialog.close();
    else dialog.removeAttribute('open');
    afterDialogClose();
  }
  if (dialog) {
    if (!nativeDialog) {
      dialog.classList.add('dialog-fallback');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
    }
    for (const trigger of $$('.zoom-product')) {
      const id = trigger.closest('.product-card')?.dataset.product || trigger.dataset.product;
      if (!productById.has(id)) continue;
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-controls', 'product-dialog');
      trigger.addEventListener('click', event => {
        if (event.defaultPrevented) return;
        event.preventDefault();
        openProduct(id, trigger);
      });
    }
    window.addEventListener('resize', stopPhotoTransition, { passive: true });
    modalContent?.addEventListener('scroll', stopPhotoTransition, { passive: true });
    $$('[data-close-dialog]', dialog).forEach(button => button.addEventListener('click', closeDialog));
    dialog.addEventListener('close', afterDialogClose);
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      closeDialog();
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog();
    });
    dialog.addEventListener('keydown', event => {
      if (!nativeDialog && event.key === 'Escape') { event.preventDefault(); closeDialog(); }
      if (!nativeDialog && event.key === 'Tab') {
        const controls = visibleControls(dialog);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
  }

  // Accessible tabs support arrows, Home, End, click, and roving tab stops.
  const tabs = $$('.custom-tabs [role="tab"]');
  function activateTab(tab, moveFocus = false) {
    tabs.forEach(item => {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(item.getAttribute('aria-controls'));
      if (panel) { panel.hidden = !active; panel.inert = !active; }
    });
    if (moveFocus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', event => {
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault(); activateTab(tabs[next], true);
    });
  });
  if (tabs.length) activateTab(tabs.find(tab => tab.getAttribute('aria-selected') === 'true') || tabs[0]);

  const personalProduct = $('#personal-product');
  addProductOptions(personalProduct, true);
  const personalForm = $('.personal-form');
  const personalSubmit = $('.personal-submit');
  if (Array.from(productById.values()).some(product => product.personalizationEnabled)) {
    if (personalForm) personalForm.hidden = false;
    if (personalSubmit) personalSubmit.hidden = false;
    const fallback = $('.personal-fallback');
    if (fallback) fallback.hidden = true;
  }
  const personalText = $('#personal-text');
  const personalStyle = $('#personal-style');
  const fontChoices = $$('[name="engraving-font"]');
  const previewImage = $('#preview-image');
  const previewStage = $('.preview-stage');
  const relief = $('.engraving-relief', previewStage || document);
  const previewCaption = $('#preview-caption');
  const personalTextCount = $('#personal-text-count');
  const previewLiveStatus = $('#preview-live-status');
  const previewQuote = $('#preview-quote');
  const styleLabels = { name: 'Имя', date: 'Дата', message: 'Надпись' };
  const styleExamples = { name: 'Анна', date: '12.08.2026', message: 'Всегда рядом' };
  const fontLabels = { serif: 'С засечками', sans: 'Без засечек', italic: 'Курсив' };
  const typeLabels = { engraving: 'Гравировка', form: 'Своя идея', company: 'Для компании' };
  const selectedFont = () => fontChoices.find(choice => choice.checked)?.value || 'serif';
  let previewStatusTimer = 0;
  let previewLightTimer = 0;

  function updatePreview(event) {
    const product = personalProduct && productById.get(personalProduct.value);
    const style = personalStyle?.value || 'name';
    const text = personalText?.value.trim().slice(0, 48).replace(/\s+/g, ' ') || '';
    const displayedText = text || styleExamples[style] || styleExamples.name;
    const font = selectedFont();

    if (product && previewImage) {
      previewImage.hidden = !product.src;
      if (product.src && previewImage.getAttribute('src') !== product.src) {
        if (relief) relief.hidden = true;
        previewImage.src = product.src;
      }
      previewImage.alt = product.alt;
    }
    if (previewCaption && product) previewCaption.textContent = product.name;
    const precise = Boolean(product?.personalizationEnabled && product.geometry);
    if (previewStage) previewStage.classList.toggle('has-neutral-image', !precise);
    const mark = $('.preview-mark', previewStage || document);
    if (mark) {
      const dot = document.createElement('span');
      dot.className = 'preview-status-dot';
      dot.setAttribute('aria-hidden', 'true');
      mark.replaceChildren(dot, document.createTextNode(precise ? 'Пример гравировки' : 'Макет надписи'));
    }
    const disclaimer = $('.preview-disclaimer');
    if (disclaimer) disclaimer.textContent = precise
      ? 'Предварительная визуализация. Размещение и размер согласовываются с мастерской.'
      : 'Образец надписи показан отдельно. Размещение и возможность нанесения согласуем с мастерской.';
    if (!precise && relief) relief.hidden = true;
    if (previewQuote) {
      previewQuote.textContent = '«' + displayedText + '»';
      previewQuote.dataset.engravingFont = font;
    }
    if (personalText) personalText.placeholder = styleExamples[style] || styleExamples.name;
    if (personalTextCount) personalTextCount.textContent = (personalText?.value.length || 0) + ' / 48';
    if (previewStage) {
      if (product) previewStage.dataset.product = product.id;
      previewStage.dataset.engravingText = displayedText;
      previewStage.dataset.engravingFont = font;
      previewStage.classList.toggle('has-text', Boolean(text));
      previewStage.classList.remove('is-settled');
      window.clearTimeout(previewLightTimer);
      if (event && !motion.matches) {
        previewLightTimer = window.setTimeout(() => previewStage.classList.add('is-settled'), 380);
      }
    }
    if (event && previewLiveStatus) {
      window.clearTimeout(previewStatusTimer);
      previewStatusTimer = window.setTimeout(() => {
        previewLiveStatus.textContent = (product ? product.name + '. ' : '')
          + (text ? 'Ваша надпись: ' : 'Пример гравировки: ') + displayedText + '. Шрифт: ' + fontLabels[font] + '.';
      }, 650);
    }
  }
  personalProduct?.addEventListener('change', updatePreview);
  personalText?.addEventListener('input', updatePreview);
  personalStyle?.addEventListener('change', updatePreview);
  fontChoices.forEach(choice => choice.addEventListener('change', updatePreview));
  updatePreview();

  // Letter preparation is entirely local and never reports a server submission.
  const form = $('#inquiry-form');
  const inquiryFallback = $('#inquiry-fallback');
  const requestName = $('#request-name');
  const requestContact = $('#request-contact');
  const requestProduct = $('#request-product');
  addProductOptions(requestProduct);
  const requestMessage = $('#request-message');
  const requestStatus = $('#request-status');
  const letterResult = $('#letter-result');
  const letterText = $('#letter-text');
  const openEmail = $('#open-email');
  const copyButton = $('#copy-letter');
  const copyStatus = $('#copy-status');
  function invalidateLetter() {
    if (letterResult) letterResult.hidden = true;
    if (copyStatus) copyStatus.textContent = '';
  }
  function replaceGeneratedBlock(current, previous, replacement) {
    const index = previous ? current.indexOf(previous) : -1;
    return index < 0 ? null : current.slice(0, index) + replacement + current.slice(index + previous.length);
  }

  function highlightRequestField(field) {
    if (!field?.animate || motion.matches) return;
    field.getAnimations().forEach(animation => animation.cancel());
    field.animate([
      { boxShadow: 'inset 0 0 0 2px #a37b43', offset: 0 },
      { boxShadow: 'inset 0 0 0 2px #a37b43', offset: .56 },
      { boxShadow: 'inset 0 0 0 2px #a37b4300', offset: 1 }
    ], { duration: 950, easing: 'ease-out' });
  }

  function discussOrder(product, message, announcement) {
    if (!form || form.hidden) return;
    if (dialog?.hasAttribute('open')) {
      dialogInvoker = null;
      closeDialog();
    }
    setMenu(false);
    if (requestProduct) {
      requestProduct.value = product ? String(product.id) : 'other';
      highlightRequestField(requestProduct);
    }
    if (requestMessage) {
      const previous = requestMessage.dataset.generated || '';
      const current = requestMessage.value.trim();
      const updated = replaceGeneratedBlock(current, previous, message);
      requestMessage.value = updated !== null ? updated : (current ? current + '\n\n' + message : message);
      requestMessage.dataset.generated = message;
      requestMessage.setCustomValidity('');
    }
    invalidateLetter();
    if (requestStatus) requestStatus.textContent = announcement || 'Выбор добавлен в заявку. Укажите имя и контакт.';
    form.focus({ preventScroll: true });
    form.scrollIntoView({ behavior: motion.matches ? 'auto' : 'smooth', block: 'start' });
  }
  function productOrderMessage(product) {
    const request = 'Хочу заказать: ' + product.name + '.';
    return product.price ? request + '\nЦена по каталогу: ' + product.price + '.' : request;
  }
  function discussProduct(product) {
    if (product) discussOrder(product, productOrderMessage(product), 'В заявку добавлено: ' + product.name + '.');
  }
  $$('.order-product').forEach(trigger => trigger.addEventListener('click', event => {
    const product = productById.get(trigger.closest('.product-card')?.dataset.product);
    if (event.defaultPrevented || !form || form.hidden || !product) return;
    event.preventDefault();
    discussProduct(product);
  }));
  const modalOrder = dialog && $('.modal-order', dialog);
  if (modalOrder) modalOrder.addEventListener('click', () => discussProduct(modalProduct));
  const personalOrder = $('#personal-order');
  if (personalOrder) personalOrder.addEventListener('click', () => {
    const product = personalProduct && productById.get(personalProduct.value);
    const activeTab = tabs.find(tab => tab.getAttribute('aria-selected') === 'true');
    const type = activeTab ? activeTab.dataset.tab : 'engraving';
    const style = personalStyle ? personalStyle.value : 'name';
    const text = personalText ? personalText.value.trim() : '';
    const lines = [
      'Хочу обсудить персонализацию' + (product ? ': ' + product.name + '.' : '.'),
      'Вариант: ' + (typeLabels[type] || 'Гравировка') + '.',
      'Тип надписи: ' + (styleLabels[style] || 'Надпись') + '.',
      'Шрифт: ' + fontLabels[selectedFont()] + '.',
      text ? 'Текст: ' + text : 'Текст надписи согласуем с мастерской.',
      'Размещение и возможность нанесения согласуем с мастерской.'
    ];
    discussOrder(product, lines.join('\n'), 'Изделие и параметры персонализации добавлены в заявку.');
  });
  const businessOrder = $('.business-order');
  businessOrder?.addEventListener('click', event => {
    if (event.defaultPrevented || !form || form.hidden) return;
    event.preventDefault();
    discussOrder(null, 'Хочу обсудить корпоративные подарки.\nИзделие, тираж, нанесение и сроки согласуем с мастерской.', 'В заявку добавлен запрос на корпоративные подарки.');
  });
  if (form && requestName && requestContact && requestMessage && letterResult && letterText && openEmail) {
    [requestName, requestContact, requestProduct, requestMessage].filter(Boolean).forEach(field => {
      const onEdit = () => {
        if (field.setCustomValidity) field.setCustomValidity('');
        invalidateLetter();
        if (requestStatus) requestStatus.textContent = '';
      };
      field.addEventListener('input', onEdit);
      field.addEventListener('change', onEdit);
    });
    if (requestProduct && requestMessage) requestProduct.addEventListener('change', () => {
      // A manual product change also updates our generated block, retaining the visitor's own note.
      const previous = requestMessage.dataset.generated || '';
      const current = requestMessage.value.trim();
      if (!previous || !current.includes(previous)) return;
      const product = productById.get(requestProduct.value);
      let replacement = previous;
      if (previous.startsWith('Хочу заказать:') || previous === 'Хочу обсудить индивидуальный заказ.') {
        replacement = product ? productOrderMessage(product) : 'Хочу обсудить индивидуальный заказ.';
      } else if (previous.startsWith('Хочу обсудить персонализацию')) {
        replacement = previous.replace(/^.*?(?=\n|$)/, 'Хочу обсудить персонализацию' + (product ? ': ' + product.name + '.' : '.'));
      }
      requestMessage.value = replaceGeneratedBlock(current, previous, replacement);
      requestMessage.dataset.generated = replacement;
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const name = requestName ? requestName.value.trim() : '';
      const contact = requestContact ? requestContact.value.trim() : '';
      const message = requestMessage ? requestMessage.value.trim() : '';
      if (requestName) requestName.setCustomValidity(name ? '' : 'Пожалуйста, укажите ваше имя.');
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
      const digits = contact.replace(/\D/g, '');
      const phoneValid = /^\+?[\d\s().\-]+$/.test(contact) && digits.length >= 7 && digits.length <= 16;
      if (requestContact) requestContact.setCustomValidity(emailValid || phoneValid ? '' : 'Укажите телефон с кодом города или электронную почту.');
      if (requestMessage) requestMessage.setCustomValidity(message ? '' : 'Пожалуйста, расскажите, что вы хотите заказать.');
      if (!form.reportValidity()) {
        if (requestStatus) requestStatus.textContent = 'Проверьте заполнение отмеченных полей.';
        return;
      }
      const product = requestProduct && productById.get(requestProduct.value);
      const subject = 'Заказ ХОУМ ВУД — ' + (product ? product.name : 'Индивидуальный запрос');
      const body = [
        'Здравствуйте, ХОУМ ВУД!', '',
        'Имя: ' + name,
        'Контакт: ' + contact,
        'Изделие: ' + (product ? product.name : 'Индивидуальный / корпоративный заказ'),
        '', message, ''
      ].join('\n');
      if (letterText) letterText.value = body;
      const emailBody = body.replace(/\r\n|\r|\n/g, '\r\n');
      openEmail.href = 'mailto:ivan.teterin@vk.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(emailBody);
      if (letterResult) {
        letterResult.hidden = false;
        highlightRequestField(letterResult);
        letterResult.tabIndex = -1;
        letterResult.focus({ preventScroll: true });
        letterResult.scrollIntoView({ behavior: motion.matches ? 'auto' : 'smooth', block: 'nearest' });
      }
      if (requestStatus) requestStatus.textContent = 'Письмо подготовлено. Откройте его в почте и отправьте или скопируйте текст заявки.';
      requestScrollPaint();
    });
    form.hidden = false;
    if (inquiryFallback) inquiryFallback.hidden = true;
  }
  function fallbackCopy() {
    if (!letterText) return false;
    const active = document.activeElement;
    letterText.focus({ preventScroll: true });
    letterText.select();
    letterText.setSelectionRange(0, letterText.value.length);
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (_) { copied = false; }
    if (copied && active && active.focus) active.focus({ preventScroll: true });
    return copied;
  }
  if (copyButton) copyButton.addEventListener('click', async () => {
    if (!letterText || !letterText.value) return;
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(letterText.value); copied = true; } catch (_) { /* Local-file fallback below. */ }
    }
    if (!copied) copied = fallbackCopy();
    if (copyStatus) copyStatus.textContent = copied
      ? 'Текст заявки скопирован.'
      : 'Текст выделен. Нажмите Ctrl+C (⌘C на Mac) или выберите «Копировать» в меню устройства.';
  });

})();
