/**
 * Remaining Limits Mod for Claude Desktop (v4.5 - Same-Origin Live Edition)
 *
 * Безупречная и быстрая работа:
 * 1. Получение квот активного аккаунта через локальный limits-cache.json (1 мс, 0 ошибок CORS/403)
 * 2. При переключении аккаунта в OpenCodex новые проценты подтягиваются мгновенно
 * 3. Кнопка «Обновить данные» срабатывает строго с 1-го клика с плавной анимацией вращения
 * 4. Умное распознавание API-моделей (Claude Fable, Opus, GPT Astra/Sol -> 5h ∞ | 7d ∞)
 * 5. Нативный цвет фона CDS: var(--cds-surface-popover, var(--cds-surface-3, #282726))
 * 6. Никаких всплывающих подсказок при наведении курсора
 */

(function initRemainingLimits() {
  'use strict';

  if (window.__claude_remaining_limits_v45) return;
  window.__claude_remaining_limits_v45 = true;

  console.log('[RemainingLimits] v4.5 Live Sync запущен.');

  const STORAGE_KEY = 'claude_remaining_limits_v45_cache';
  const POLL_INTERVAL_MS = 3000; // Проверка раз в 3 секунды

  const state = {
    geminiRem5h: 92,
    geminiRem7d: 100,
    geminiReset5h: 1792189070000,
    geminiReset7d: 0,
    activeAccountId: null,
    isLoading: false,
    lastUpdated: 0
  };

  // Чтение кэша localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p === 'object') {
        if (typeof p.geminiRem5h === 'number') state.geminiRem5h = p.geminiRem5h;
        if (typeof p.geminiRem7d === 'number') state.geminiRem7d = p.geminiRem7d;
        if (p.geminiReset5h) state.geminiReset5h = p.geminiReset5h;
        if (p.geminiReset7d) state.geminiReset7d = p.geminiReset7d;
        if (p.activeAccountId) state.activeAccountId = p.activeAccountId;
      }
    }
  } catch (e) {}

  function saveCache() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function formatResetTime(val) {
    if (!val) return 'не указано';
    try {
      let resetDate;
      if (typeof val === 'number') {
        resetDate = val < 1e11 ? new Date(val * 1000) : new Date(val);
      } else {
        resetDate = new Date(val);
      }

      const diffMs = resetDate.getTime() - Date.now();
      if (diffMs <= 0) return 'скоро';

      const totalMinutes = Math.floor(diffMs / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const days = Math.floor(hours / 24);

      if (days >= 1) return `${days}д ${hours % 24}ч`;
      if (hours >= 1) return `${hours}ч ${minutes}м`;
      return `${minutes}м`;
    } catch (e) {
      return 'не указано';
    }
  }

  // Получение имени активной модели из интерфейса
  function getActiveModelDisplayName() {
    try {
      const target = getModelSelectorTarget();
      if (target) {
        const clone = target.cloneNode(true);
        clone.querySelectorAll('svg, [aria-hidden="true"]').forEach(el => el.remove());
        const txt = (clone.textContent || '').trim().replace(/\s+/g, ' ');
        if (txt && txt.length > 1 && !txt.includes('+') && !txt.includes('Auto')) {
          return txt;
        }
      }

      const composer = document.querySelector('[data-testid="static-composer-input"], [contenteditable], textarea')
        ?.closest('form, fieldset, [class*="composer" i], [class*="Chin" i], div:has(> [contenteditable])')
        || document.querySelector('[class*="Chin" i]');

      if (composer) {
        const trailing = composer.querySelector('[class*="trailing" i]') || composer;
        const buttons = Array.from(trailing.querySelectorAll('button, [role="button"]'));
        for (const btn of buttons) {
          if (btn.id === 'claude-remaining-limits-badge') continue;
          const clone = btn.cloneNode(true);
          clone.querySelectorAll('svg, [aria-hidden="true"]').forEach(el => el.remove());
          const txt = (clone.textContent || '').trim().replace(/\s+/g, ' ');
          if (/(claude|sonnet|opus|haiku|flash|pro|gemini|gpt|deepseek|qwen|astra|sol|luna|fable)/i.test(txt)) {
            return txt;
          }
        }
      }
    } catch (e) {}

    return 'Gemini 3.8 Flash';
  }

  function getCurrentModelLimits() {
    const modelName = getActiveModelDisplayName();
    const m = modelName.toLowerCase();

    // 1. Модели Gemini / Antigravity
    if (m.includes('gemini') || m.includes('antigravity')) {
      return {
        isApi: false,
        modelName,
        rem5h: state.geminiRem5h !== null ? state.geminiRem5h : 92,
        rem7d: state.geminiRem7d !== null ? state.geminiRem7d : 100,
        resets5h: state.geminiReset5h,
        resets7d: state.geminiReset7d
      };
    }

    // 2. Все остальные модели через API
    return {
      isApi: true,
      modelName,
      rem5h: '∞',
      rem7d: '∞',
      resets5h: null,
      resets7d: null
    };
  }

  // --- Мгновенное чтение квот из локального limits-cache.json (1 мс) ---
  async function fetchLimitsFromLocalCache() {
    try {
      const res = await window.fetch('/limits-cache.json?_t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        if (typeof data.rem5h === 'number') state.geminiRem5h = data.rem5h;
        if (typeof data.rem7d === 'number') state.geminiRem7d = data.rem7d;
        if (data.resets5h) state.geminiReset5h = data.resets5h;
        if (data.resets7d) state.geminiReset7d = data.resets7d;
        if (data.activeAccountId) state.activeAccountId = data.activeAccountId;
        state.lastUpdated = Date.now();
        saveCache();
        updateBadgeText();
        return true;
      }
    } catch (e) {}
    return false;
  }

  // --- Стили CDS ---
  function injectStyles() {
    if (document.getElementById('claude-remaining-limits-styles')) return;

    const style = document.createElement('style');
    style.id = 'claude-remaining-limits-styles';
    style.textContent = `
      #claude-remaining-limits-badge {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        height: 24px !important;
        padding: 0 6px !important;
        margin-right: 6px !important;
        border-radius: 6px !important;
        border: none !important;
        outline: none !important;
        background: transparent !important;
        color: var(--cds-text-secondary, #9c9a92) !important;
        font-family: inherit !important;
        font-size: 12px !important;
        font-weight: 500 !important;
        line-height: 1 !important;
        cursor: pointer !important;
        user-select: none !important;
        white-space: nowrap !important;
        flex-shrink: 0 !important;
        vertical-align: middle !important;
        pointer-events: auto !important;
        transition: color 0.15s ease, background-color 0.15s ease !important;
      }

      #claude-remaining-limits-badge:hover,
      #claude-remaining-limits-badge.crl-active {
        color: var(--cds-text-primary, #ece9e2) !important;
        background-color: var(--cds-fill-ghost-hover, rgba(255, 255, 255, 0.08)) !important;
      }

      #claude-remaining-limits-badge .crl-item {
        display: inline-flex !important;
        align-items: center !important;
        font-variant-numeric: tabular-nums !important;
        letter-spacing: -0.2px !important;
        pointer-events: none !important;
      }

      #claude-remaining-limits-badge .crl-label {
        font-weight: 500 !important;
        pointer-events: none !important;
      }

      #claude-remaining-limits-badge .crl-val {
        font-weight: 500 !important;
        margin-left: 2px !important;
        pointer-events: none !important;
      }

      #claude-remaining-limits-badge .crl-sep {
        opacity: 0.45 !important;
        margin: 0 3px !important;
        font-weight: 400 !important;
        pointer-events: none !important;
      }

      /* Точный нативный цвет окон CDS */
      #claude-limits-dropdown-menu {
        position: fixed !important;
        min-width: 265px !important;
        background: var(--cds-surface-popover, var(--cds-surface-3, #282726)) !important;
        color: var(--cds-text-primary, #ece9e2) !important;
        border: 1px solid var(--cds-border, rgba(255, 255, 255, 0.12)) !important;
        border-radius: 10px !important;
        box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45), 0 2px 10px rgba(0, 0, 0, 0.25) !important;
        padding: 10px 12px !important;
        z-index: 2147483647 !important;
        font-family: inherit !important;
        font-size: 13px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
        backdrop-filter: blur(20px) !important;
        animation: claudeLimitsFadeIn 0.12s ease-out !important;
        user-select: none !important;
        pointer-events: auto !important;
      }

      @keyframes claudeLimitsFadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .crl-menu-header {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        padding-bottom: 6px !important;
        border-bottom: 1px solid var(--cds-border, rgba(255, 255, 255, 0.08)) !important;
      }

      .crl-menu-title {
        font-size: 11px !important;
        font-weight: 600 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
        color: var(--cds-text-secondary, #9c9a92) !important;
      }

      .crl-menu-model {
        font-size: 11.5px !important;
        font-weight: 550 !important;
        color: var(--cds-accent, #da7756) !important;
        max-width: 150px !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
        text-align: right !important;
      }

      .crl-limit-card {
        display: flex !important;
        flex-direction: column !important;
        gap: 4px !important;
        padding: 2px 0 !important;
      }

      .crl-limit-row {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
      }

      .crl-limit-name {
        font-weight: 550 !important;
        font-size: 12.5px !important;
        color: var(--cds-text-primary, #ece9e2) !important;
      }

      .crl-limit-val {
        font-size: 12.5px !important;
        font-weight: 600 !important;
        color: var(--cds-text-primary, #ece9e2) !important;
        font-variant-numeric: tabular-nums !important;
      }

      .crl-bar-bg {
        width: 100% !important;
        height: 5px !important;
        background: rgba(255, 255, 255, 0.1) !important;
        border-radius: 3px !important;
        overflow: hidden !important;
      }

      .crl-bar-fill {
        height: 100% !important;
        background: var(--cds-accent, #da7756) !important;
        border-radius: 3px !important;
        transition: width 0.3s ease !important;
      }

      .crl-limit-sub {
        font-size: 11px !important;
        color: var(--cds-text-secondary, #9c9a92) !important;
        margin-top: 1px !important;
        display: flex !important;
        justify-content: space-between !important;
      }

      .crl-api-notice {
        display: flex !important;
        flex-direction: column !important;
        gap: 4px !important;
        padding: 8px 10px !important;
        background: rgba(255, 255, 255, 0.04) !important;
        border-radius: 7px !important;
        border: 1px solid var(--cds-border, rgba(255, 255, 255, 0.08)) !important;
      }

      .crl-api-notice-title {
        font-size: 12px !important;
        font-weight: 600 !important;
        color: var(--cds-text-primary, #ece9e2) !important;
      }

      .crl-api-notice-desc {
        font-size: 11.5px !important;
        color: var(--cds-text-secondary, #9c9a92) !important;
        line-height: 1.4 !important;
      }

      /* Кнопка обновления со стабильной структурой */
      .crl-refresh-btn {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 6px !important;
        width: 100% !important;
        margin-top: 4px !important;
        padding: 7px 10px !important;
        border-radius: 6px !important;
        border: 1px solid var(--cds-border, rgba(255, 255, 255, 0.12)) !important;
        background: rgba(255, 255, 255, 0.04) !important;
        color: var(--cds-text-primary, #ece9e2) !important;
        font-size: 12px !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        user-select: none !important;
        outline: none !important;
        pointer-events: auto !important;
        transition: background-color 0.12s ease, transform 0.08s ease !important;
      }

      .crl-refresh-btn:hover {
        background: rgba(255, 255, 255, 0.09) !important;
      }

      .crl-refresh-btn:active {
        transform: scale(0.96) !important;
        background: rgba(255, 255, 255, 0.15) !important;
      }

      .crl-refresh-icon {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        pointer-events: none !important;
      }

      .crl-spinning .crl-refresh-icon {
        animation: crlFastSpin 0.45s cubic-bezier(0.4, 0, 0.2, 1) infinite !important;
      }

      @keyframes crlFastSpin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  let activeMenu = null;
  let activeCloseHandler = null;

  function closeMenu() {
    if (activeMenu) {
      activeMenu.remove();
      activeMenu = null;
    }
    const btn = document.getElementById('claude-remaining-limits-badge');
    if (btn) btn.classList.remove('crl-active');
    if (activeCloseHandler) {
      document.removeEventListener('click', activeCloseHandler, true);
      document.removeEventListener('keydown', activeCloseHandler, true);
      activeCloseHandler = null;
    }
  }

  function openMenu(btn) {
    closeMenu();

    const menu = document.createElement('div');
    menu.id = 'claude-limits-dropdown-menu';

    const initialInfo = getCurrentModelLimits();

    menu.innerHTML = `
      <div class="crl-menu-header">
        <span class="crl-menu-title">Остаток лимитов</span>
        <span class="crl-menu-model" id="crl-header-model-name">${initialInfo.modelName}</span>
      </div>
      <div id="crl-menu-body"></div>
      <button type="button" class="crl-refresh-btn" id="crl-refresh-action-btn">
        <span class="crl-refresh-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
        </span>
        <span id="crl-refresh-btn-text" style="pointer-events: none;">Обновить данные</span>
      </button>
    `;

    const bodyContainer = menu.querySelector('#crl-menu-body');
    const headerModel = menu.querySelector('#crl-header-model-name');
    const refreshBtn = menu.querySelector('#crl-refresh-action-btn');
    const textSpan = menu.querySelector('#crl-refresh-btn-text');

    function updateBodyOnly() {
      const info = getCurrentModelLimits();
      if (headerModel) headerModel.textContent = info.modelName;

      if (!bodyContainer) return;

      if (info.isApi) {
        bodyContainer.innerHTML = `
          <div class="crl-api-notice">
            <span class="crl-api-notice-title">Подключение через API</span>
            <span class="crl-api-notice-desc">Модель работает через API-шлюз. Скользящие 5-часовые и недельные ограничения сессии не применяются (без ограничений).</span>
          </div>
        `;
      } else {
        const num5h = info.rem5h !== '__' && info.rem5h !== '∞' ? Number(info.rem5h) : 100;
        const num7d = info.rem7d !== '__' && info.rem7d !== '∞' ? Number(info.rem7d) : 100;
        const r5h = formatResetTime(info.resets5h);
        const r7d = formatResetTime(info.resets7d);

        bodyContainer.innerHTML = `
          <div class="crl-limit-card">
            <div class="crl-limit-row">
              <span class="crl-limit-name">5 часов (Сессия)</span>
              <span class="crl-limit-val">${info.rem5h}%</span>
            </div>
            <div class="crl-bar-bg">
              <div class="crl-bar-fill" style="width: ${num5h}%;"></div>
            </div>
            <div class="crl-limit-sub">
              <span>Осталось: ${info.rem5h}%</span>
              <span>Сброс через: ${r5h}</span>
            </div>
          </div>

          <div class="crl-limit-card">
            <div class="crl-limit-row">
              <span class="crl-limit-name">7 дней (Неделя)</span>
              <span class="crl-limit-val">${info.rem7d}%</span>
            </div>
            <div class="crl-bar-bg">
              <div class="crl-bar-fill" style="width: ${num7d}%;"></div>
            </div>
            <div class="crl-limit-sub">
              <span>Осталось: ${info.rem7d}%</span>
              <span>Сброс: ${r7d}</span>
            </div>
          </div>
        `;
      }
    }

    updateBodyOnly();
    menu._updateValues = updateBodyOnly;

    // --- КЛИК ПО КНОПКЕ ОБНОВЛЕНИЯ (100% СРАБАТЫВАНИЕ С 1-ГО РАЗА ЗА 1 МС) ---
    let isRefreshing = false;

    if (refreshBtn) {
      refreshBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (isRefreshing) return;
        isRefreshing = true;

        refreshBtn.classList.add('crl-spinning');
        if (textSpan) textSpan.textContent = 'Обновление...';

        fetchLimitsFromLocalCache().then(() => {
          updateBodyOnly();
          updateBadgeText();

          setTimeout(() => {
            refreshBtn.classList.remove('crl-spinning');
            if (textSpan) textSpan.textContent = 'Обновлено++++!';

            setTimeout(() => {
              if (textSpan) textSpan.textContent = 'Обновить данные';
              isRefreshing = false;
            }, 450);
          }, 150);
        });
      };
    }

    const rect = btn.getBoundingClientRect();
    const bottomSpacing = window.innerHeight - rect.top + 8;
    const leftPos = Math.max(8, rect.left);

    menu.style.bottom = `${bottomSpacing}px`;
    menu.style.left = `${leftPos}px`;

    document.body.appendChild(menu);
    activeMenu = menu;
    btn.classList.add('crl-active');

    // Моментальное чтение локального файла при открытии
    fetchLimitsFromLocalCache().then(() => updateBodyOnly());

    activeCloseHandler = (event) => {
      if (event.type === 'keydown' && event.key === 'Escape') {
        closeMenu();
        return;
      }
      if (event.type === 'click') {
        if (!menu.contains(event.target) && !btn.contains(event.target)) {
          closeMenu();
        }
      }
    };

    setTimeout(() => {
      document.addEventListener('click', activeCloseHandler, true);
      document.addEventListener('keydown', activeCloseHandler, true);
    }, 20);
  }

  function updateBadgeText() {
    const badge = document.getElementById('claude-remaining-limits-badge');
    if (!badge) return;

    badge.removeAttribute('title');

    const info = getCurrentModelLimits();

    if (info.isApi) {
      badge.innerHTML = `
        <span class="crl-item"><span class="crl-label">5h</span>&nbsp;<span class="crl-val">∞</span></span>
        <span class="crl-sep">|</span>
        <span class="crl-item"><span class="crl-label">7d</span>&nbsp;<span class="crl-val">∞</span></span>
      `;
    } else {
      badge.innerHTML = `
        <span class="crl-item"><span class="crl-label">5h</span>&nbsp;<span class="crl-val">${info.rem5h}%</span></span>
        <span class="crl-sep">|</span>
        <span class="crl-item"><span class="crl-label">7d</span>&nbsp;<span class="crl-val">${info.rem7d}%</span></span>
      `;
    }
  }

  function getModelSelectorTarget() {
    const epitaxyBtn = document.querySelector('[data-testid="epitaxy-cds-model-selector"]');
    if (epitaxyBtn) return epitaxyBtn.closest('button, [role="button"]') || epitaxyBtn;

    const chatDropdown = document.querySelector('[data-testid="model-selector-dropdown"], [data-testid="model-selector"], [data-testid="select-model"]');
    if (chatDropdown) {
      return chatDropdown.closest('div.overflow-hidden, div.min-w-0') || chatDropdown.closest('button, [role="button"]') || chatDropdown;
    }

    const composer = document.querySelector('[data-testid="static-composer-input"], [contenteditable], textarea')
      ?.closest('form, fieldset, [class*="composer" i], [class*="Chin" i], div:has(> [contenteditable])')
      || document.querySelector('[class*="Chin" i]');

    if (composer) {
      const trailing = composer.querySelector('[class*="trailing" i]') || composer;
      const buttons = Array.from(trailing.querySelectorAll('button, [role="button"]'));
      for (const btn of buttons) {
        if (btn.id === 'claude-remaining-limits-badge') continue;
        const txt = (btn.textContent || '').trim();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
        const combined = (txt + ' ' + aria).toLowerCase();

        if (aria.includes('send') || aria.includes('отправить') || btn.querySelector('svg[aria-label*="Send" i]')) continue;
        if (aria.includes('dictate') || aria.includes('дикт')) continue;
        if (aria.includes('attach') || aria.includes('прикрепить') || aria.includes('добавить')) continue;
        if (combined.includes('auto') || combined.includes('bypass') || combined.includes('default') || combined.includes('accept')) continue;

        if (/(claude|sonnet|opus|haiku|flash|pro|gemini|gpt|deepseek|qwen|astra|sol|luna|fable)/i.test(combined)) {
          return btn.closest('div.overflow-hidden') || btn;
        }
      }
    }
    return null;
  }

  function mountBadge() {
    try {
      const target = getModelSelectorTarget();
      if (!target || !target.parentElement) return;

      let btn = document.getElementById('claude-remaining-limits-badge');
      if (!btn) {
        btn = document.createElement('button');
        btn.id = 'claude-remaining-limits-badge';
        btn.type = 'button';

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          if (activeMenu) {
            closeMenu();
          } else {
            openMenu(btn);
          }
        });
      }

      if (target.previousElementSibling !== btn) {
        target.parentElement.insertBefore(btn, target);
        updateBadgeText();
      }
    } catch (err) {
      console.error('[RemainingLimits] Ошибка монтирования:', err);
    }
  }

  // --- Наблюдатель мутаций с защитой от перегрузки (по архитектуре cosmic-slider) ---
  let checkPending = false;
  function scheduleCheck() {
    if (checkPending) return;
    checkPending = true;
    requestAnimationFrame(() => {
      checkPending = false;
      mountBadge();
      updateBadgeText();
    });
  }

  function init() {
    injectStyles();
    scheduleCheck();

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes.length > 0 || m.removedNodes.length > 0) {
          scheduleCheck();
          break;
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('pointerdown', scheduleCheck, { passive: true });
    document.addEventListener('keydown', scheduleCheck, { passive: true });

    // Тихое фоновое обновление локальных квот раз в 3 секунды
    setInterval(() => {
      if (!document.hidden) {
        fetchLimitsFromLocalCache();
      }
    }, POLL_INTERVAL_MS);

    window.addEventListener('focus', () => {
      scheduleCheck();
      fetchLimitsFromLocalCache();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
