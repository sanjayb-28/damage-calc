(function () {
  'use strict';

  var root = document.documentElement;
  var body = document.body;
  var wrapper = document.querySelector('.wrapper');
  if (!wrapper) return;

  root.classList.add('desktop-shell');
  body.classList.add('desktop-app');

  function installMotionField() {
    var canvas = document.createElement('canvas');
    canvas.className = 'desktop-motion-field';
    canvas.setAttribute('aria-hidden', 'true');
    body.insertBefore(canvas, body.firstChild);

    var context = canvas.getContext('2d');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var width = 0;
    var height = 0;
    var pixelRatio = 1;
    var lastFrame = 0;
    var dots = [];
    var dotSpacing = 18;
    var flowAngle = 25 * Math.PI / 180;

    function initializeDots() {
      dots = [];
      var columns = Math.ceil((width + height * Math.abs(Math.tan(flowAngle))) / dotSpacing) + 4;
      var rows = Math.ceil(height / dotSpacing) + 4;

      for (var column = -2; column < columns; column += 1) {
        for (var row = -2; row < rows; row += 1) {
          var x = column * dotSpacing - row * dotSpacing * Math.sin(flowAngle);
          var y = row * dotSpacing;
          if (x < -dotSpacing * 3 || x > width + dotSpacing * 3 ||
              y < -dotSpacing * 3 || y > height + dotSpacing * 3) continue;
          dots.push({
            baseX: x,
            baseY: y,
            flowOffset: (column + row) * 0.42,
          });
        }
      }
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      initializeDots();
      draw(performance.now());
    }

    function draw(time) {
      context.clearRect(0, 0, width, height);
      var phase = time * 0.00055;
      context.fillStyle = 'rgba(142, 156, 181, 0.3)';

      dots.forEach(function (dot) {
        var x = dot.baseX + Math.sin(phase + dot.flowOffset) * 7;
        var y = dot.baseY + Math.cos(phase + dot.flowOffset * 0.7) * 3.5;
        context.beginPath();
        context.arc(x, y, 1.25, 0, Math.PI * 2);
        context.fill();
      });
    }

    function animate(time) {
      if (time - lastFrame >= 32) {
        draw(time);
        lastFrame = time;
      }
      window.requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize, {passive: true});
    resize();
    if (!reduceMotion) window.requestAnimationFrame(animate);
  }

  installMotionField();

  var panels = Array.prototype.slice.call(wrapper.querySelectorAll(':scope > .panel'));
  if (panels.length >= 3) {
    var grid = document.createElement('div');
    grid.className = 'desktop-calculator-grid';
    panels[0].parentNode.insertBefore(grid, panels[0]);
    panels.forEach(function (panel) {
      grid.appendChild(panel);
    });
  }

  function normalizeType(type) {
    return String(type || '').toLowerCase().replace(/[^a-z]/g, '');
  }

  function syncMoveType(row) {
    var typeSelect = row.querySelector('.move-type');
    if (!typeSelect) return;
    var type = normalizeType(typeSelect.value);
    if (row.dataset.moveType !== type) row.dataset.moveType = type;
  }

  function syncMoveTypes() {
    Array.prototype.forEach.call(document.querySelectorAll('.move1, .move2, .move3, .move4'), syncMoveType);
  }

  var activeMoveWidget = null;

  function selectedMoveLabel(select) {
    var option = select.options[select.selectedIndex];
    return option ? option.text : 'Choose move';
  }

  function syncMoveWidget(select) {
    var widget = select && select._desktopMoveWidget;
    if (!widget) return;
    widget.button.textContent = selectedMoveLabel(select);
    if (activeMoveWidget === widget) renderMoveOptions(widget, widget.search.value);
  }

  function syncMoveWidgets() {
    Array.prototype.forEach.call(document.querySelectorAll('select.move-selector'), syncMoveWidget);
  }

  function syncDesktopMoveState() {
    syncMoveTypes();
    syncMoveWidgets();
  }

  var desktopMoveStateFrame = 0;
  var desktopMoveStateTimer = 0;

  function queueDesktopMoveStateSync() {
    if (!desktopMoveStateFrame) {
      desktopMoveStateFrame = window.requestAnimationFrame(function () {
        desktopMoveStateFrame = 0;
        syncDesktopMoveState();
      });
    }
    window.clearTimeout(desktopMoveStateTimer);
    desktopMoveStateTimer = window.setTimeout(syncDesktopMoveState, 80);
  }

  function closeMoveMenu() {
    if (!activeMoveWidget) return;
    activeMoveWidget.menu.hidden = true;
    activeMoveWidget.button.setAttribute('aria-expanded', 'false');
    activeMoveWidget = null;
  }

  function renderMoveOptions(widget, term) {
    var query = String(term || '').trim().toLowerCase();
    var fragment = document.createDocumentFragment();
    widget.options.textContent = '';

    Array.prototype.forEach.call(widget.select.options, function (option) {
      if (query && option.text.toLowerCase().indexOf(query) === -1) return;
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'desktop-move-option';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', option.selected ? 'true' : 'false');
      item.dataset.value = option.value;
      item.textContent = option.text;
      fragment.appendChild(item);
    });

    if (!fragment.childNodes.length) {
      var empty = document.createElement('div');
      empty.className = 'desktop-move-empty';
      empty.textContent = 'No matching moves';
      fragment.appendChild(empty);
    }
    widget.options.appendChild(fragment);
  }

  function positionMoveMenu(widget) {
    var rect = widget.button.getBoundingClientRect();
    var width = Math.min(320, Math.max(260, rect.width));
    var left = Math.max(10, Math.min(rect.left, window.innerWidth - width - 10));
    var spaceBelow = window.innerHeight - rect.bottom - 10;
    var spaceAbove = rect.top - 10;
    var openAbove = spaceBelow < 280 && spaceAbove > spaceBelow;
    var available = Math.max(180, Math.min(420, openAbove ? spaceAbove : spaceBelow));

    widget.menu.style.width = width + 'px';
    widget.menu.style.left = left + 'px';
    widget.menu.style.top = openAbove ? 'auto' : (rect.bottom + 4) + 'px';
    widget.menu.style.bottom = openAbove ? (window.innerHeight - rect.top + 4) + 'px' : 'auto';
    widget.options.style.maxHeight = Math.max(130, available - 54) + 'px';
  }

  function openMoveMenu(widget) {
    closeMoveMenu();
    activeMoveWidget = widget;
    widget.search.value = '';
    renderMoveOptions(widget, '');
    widget.menu.hidden = false;
    widget.button.setAttribute('aria-expanded', 'true');
    positionMoveMenu(widget);
    widget.search.focus({preventScroll: true});
  }

  function selectMoveOption(widget, option) {
    if (!widget || !option) return;
    widget.select.value = option.dataset.value;
    widget.button.textContent = selectedMoveLabel(widget.select);
    widget.select.dispatchEvent(new Event('change', {bubbles: true}));
    closeMoveMenu();
    widget.button.focus({preventScroll: true});
  }

  function installDesktopMoveSelectors() {
    Array.prototype.forEach.call(document.querySelectorAll('select.move-selector'), function (select, index) {
      if (select._desktopMoveWidget) {
        syncMoveWidget(select);
        return;
      }

      select.classList.remove('select2-offscreen');
      select.classList.add('desktop-move-source');
      select.hidden = true;

      var row = select.closest('.move1, .move2, .move3, .move4');
      var legacySelect2 = row && row.querySelector('.move-selector.select2-container');
      if (legacySelect2) legacySelect2.hidden = true;

      var wrapper = document.createElement('span');
      wrapper.className = 'desktop-move-combobox';
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'desktop-move-button';
      button.setAttribute('aria-haspopup', 'listbox');
      button.setAttribute('aria-expanded', 'false');
      button.textContent = selectedMoveLabel(select);
      wrapper.appendChild(button);
      select.insertAdjacentElement('afterend', wrapper);

      var menu = document.createElement('div');
      menu.className = 'desktop-move-menu';
      menu.hidden = true;
      var search = document.createElement('input');
      search.type = 'search';
      search.className = 'desktop-move-search';
      search.placeholder = 'Search moves…';
      search.setAttribute('aria-label', 'Search moves');
      var options = document.createElement('div');
      options.className = 'desktop-move-options';
      options.id = 'desktop-move-options-' + index;
      options.setAttribute('role', 'listbox');
      button.setAttribute('aria-controls', options.id);
      menu.appendChild(search);
      menu.appendChild(options);
      document.body.appendChild(menu);

      var widget = {select: select, wrapper: wrapper, button: button, menu: menu, search: search, options: options};
      select._desktopMoveWidget = widget;

      button.addEventListener('click', function (event) {
        event.stopPropagation();
        if (activeMoveWidget === widget) closeMoveMenu();
        else openMoveMenu(widget);
      });
      menu.addEventListener('pointerdown', function (event) { event.stopPropagation(); });
      search.addEventListener('input', function () { renderMoveOptions(widget, search.value); });
      search.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeMoveMenu();
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          var first = options.querySelector('.desktop-move-option');
          if (first) first.focus();
        }
        if (event.key === 'Enter') {
          var match = options.querySelector('.desktop-move-option');
          if (match) selectMoveOption(widget, match);
        }
      });
      options.addEventListener('pointerdown', function (event) {
        var option = event.target.closest('.desktop-move-option');
        if (!option || (typeof event.button === 'number' && event.button !== 0)) return;
        event.preventDefault();
        event.stopPropagation();
        selectMoveOption(widget, option);
      });
      options.addEventListener('click', function (event) {
        var option = event.target.closest('.desktop-move-option');
        if (!option || menu.hidden) return;
        selectMoveOption(widget, option);
      });
      options.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeMoveMenu();
      });
    });
  }

  var dropdownScrollGuardUntil = 0;
  var dropdownPointerActive = false;

  function dropdownContainer(target) {
    if (!target || !target.closest) return null;
    return target.closest(
      '.desktop-move-menu, .select2-container, .select2-drop, .select2-results, .select2-search'
    );
  }

  function markDropdownScroll(event) {
    if (dropdownContainer(event.target)) dropdownScrollGuardUntil = Date.now() + 300;
  }

  function isDropdownScrollInteraction(event) {
    return Boolean(dropdownContainer(event.target)) || dropdownPointerActive || Date.now() < dropdownScrollGuardUntil;
  }

  document.addEventListener('change', queueDesktopMoveStateSync);

  if (window.jQuery) {
    window.jQuery(document).on(
      'change.desktopMoveState',
      '.move-selector, .move-type, .set-selector, input[name="gen"]',
      function () {
        queueDesktopMoveStateSync();
      }
    );

    window.jQuery(document).on('change.desktopMoveState', '.move-selector', function () {
      syncMoveWidget(this);
    });
  }

  syncDesktopMoveState();
  window.setTimeout(syncDesktopMoveState, 250);
  window.setTimeout(installDesktopMoveSelectors, 250);
  window.setTimeout(installDesktopMoveSelectors, 750);
  document.addEventListener('pointerdown', closeMoveMenu);
  document.addEventListener('pointerdown', function (event) {
    dropdownPointerActive = Boolean(dropdownContainer(event.target));
    if (dropdownPointerActive) markDropdownScroll(event);
  }, true);
  document.addEventListener('pointerup', function () {
    dropdownPointerActive = false;
  }, true);
  document.addEventListener('pointercancel', function () {
    dropdownPointerActive = false;
  }, true);
  document.addEventListener('wheel', markDropdownScroll, {capture: true, passive: true});
  document.addEventListener('touchmove', markDropdownScroll, {capture: true, passive: true});
  document.addEventListener('scroll', function (event) {
    if (isDropdownScrollInteraction(event)) return;
    closeMoveMenu();
  }, true);
  window.addEventListener('resize', function () {
    closeMoveMenu();
  }, {passive: true});

  var tauri = window.__TAURI__;
  var updateButton = document.querySelector('.desktop-update-button');
  var updateCheckInFlight = false;
  var lastUpdateCheck = 0;
  var updateStatusTimer = 0;
  var defaultUpdateLabel = 'Check for updates';

  async function invoke(command, args) {
    if (!tauri || !tauri.core || !tauri.core.invoke) return null;
    return tauri.core.invoke(command, args || {});
  }

  function resetUpdateButton(message, delay) {
    window.clearTimeout(updateStatusTimer);
    updateButton.textContent = message || defaultUpdateLabel;
    updateButton.disabled = false;
    delete updateButton.dataset.version;
    updateButton.removeAttribute('title');
    if (delay) {
      updateStatusTimer = window.setTimeout(function () {
        updateButton.textContent = defaultUpdateLabel;
      }, delay);
    }
  }

  async function checkForUpdate(manual) {
    if (!updateButton || !tauri || updateCheckInFlight) return null;
    updateCheckInFlight = true;
    lastUpdateCheck = Date.now();
    if (manual) {
      updateButton.disabled = true;
      updateButton.textContent = 'Checking for updates…';
    }
    try {
      var update = await invoke('check_for_update');
      if (!update) {
        resetUpdateButton(manual ? 'You’re up to date' : defaultUpdateLabel, manual ? 2500 : 0);
        return null;
      }
      updateButton.hidden = false;
      updateButton.disabled = false;
      updateButton.textContent = 'Update to ' + update.version;
      updateButton.dataset.version = update.version;
      if (update.notes) updateButton.title = update.notes;
      return update;
    } catch (error) {
      if (manual) resetUpdateButton('Update check failed — retry');
      console.warn('Update check failed', error);
      return null;
    } finally {
      updateCheckInFlight = false;
    }
  }

  if (updateButton) {
    updateButton.addEventListener('click', async function () {
      if (!updateButton.dataset.version) {
        await checkForUpdate(true);
        return;
      }
      updateButton.disabled = true;
      updateButton.textContent = 'Installing update…';
      try {
        await invoke('install_update');
      } catch (error) {
        updateButton.disabled = false;
        updateButton.textContent = 'Update failed — retry';
        console.error('Update install failed', error);
      }
    });
    if (!tauri) updateButton.hidden = true;
  }

  document.addEventListener('click', function (event) {
    var anchor = event.target.closest('a[href]');
    if (!anchor || !tauri) return;
    var href = anchor.getAttribute('href');
    if (!href || href.charAt(0) === '#' || href.startsWith('./') || href.endsWith('.html')) return;

    var url;
    try {
      url = new URL(href, window.location.href);
    } catch (_) {
      return;
    }

    if (url.protocol === 'http:' || url.protocol === 'https:') {
      event.preventDefault();
      invoke('open_external', {url: url.href});
    }
  });

  checkForUpdate();
  window.setInterval(checkForUpdate, 6 * 60 * 60 * 1000);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && Date.now() - lastUpdateCheck > 15 * 60 * 1000) {
      checkForUpdate();
    }
  });
}());
