/* ============================================================
   VoidOS · 引擎核心 (assets/js/core.js)
   桌面元素系统：气泡弹窗统一工厂
   长按拖动 / 点击置顶 / 滚轮双指缩放 / 工具函数
   ============================================================ */
(function () {
  'use strict';

  /* ---------- DOM ---------- */
  var desktop = document.getElementById('desktop');
  var zoomIndicator = document.getElementById('zoom-indicator');
  var zoomSpan = document.getElementById('zoom-value');

  /* ---------- 状态 ---------- */
  var elements = [];            // 桌面元素 {el,x,y,w,h,type,appId,data,z}
  var currentScale = 1;
  var MIN_SCALE = 0.3;
  var MAX_SCALE = 2.0;
  var zTop = 10;                // 层级计数器
  var isDragging = false;
  var dragData = null;

  /* ---------- 工具 ---------- */
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function rand(min, max) { return min + Math.random() * (max - min); }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;amp;', '<': '&amp;lt;', '>': '&amp;gt;', '"': '&amp;quot;', "'": '&amp;#39;' }[c];
    });
  }

  /* ============================================================
     1. 桌面元素系统（气泡弹窗统一工厂）
     ============================================================ */

  // config: { type, x, y, w, h, appId, data, closable, onClick }
  function createElement(config) {
    var el = document.createElement('div');
    el.className = 'desktop-element';
    if (config.type) el.dataset.type = config.type;
    if (config.appId) el.dataset.appId = config.appId;

    // 浮动随机偏移（轻呼吸）
    el.style.setProperty('--float-x', rand(-3, 3) + 'px');
    el.style.setProperty('--float-y', rand(-3, 3) + 'px');
    el.style.setProperty('--float-rot', rand(-1, 1) + 'deg');
    el.style.animationDuration = rand(3.5, 5) + 's';

    var w = config.w || 80;
    var h = config.h || 80;
    var x = config.x == null ? rand(20, Math.max(20, window.innerWidth - w - 20)) : config.x;
    var y = config.y == null ? rand(20, Math.max(20, window.innerHeight - h - 20)) : config.y;
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.zIndex = (config.z || (++zTop)) + '';

    // 可关闭气泡：右上角关闭钮
    if (config.closable !== false && config.type !== 'app') {
      var closeBtn = document.createElement('span');
      closeBtn.className = 'bubble-close';
      closeBtn.textContent = '✕';
      el.appendChild(closeBtn);
      closeBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        removeElement(el);
      });
    }

    desktop.appendChild(el);

    var data = {
      el: el, x: x, y: y, w: w, h: h,
      type: config.type || 'widget',
      appId: config.appId || null,
      data: config.data || {},
      z: parseInt(el.style.zIndex, 10),
      onClick: config.onClick || null,
      onClose: null
    };
    elements.push(data);
    bindElementEvents(el, data);
    return data;
  }

  function removeElement(el) {
    var idx = elements.findIndex(function (item) { return item.el === el; });
    if (idx !== -1) {
      var item = elements[idx];
      elements.splice(idx, 1);
      if (item.onClose) item.onClose(item);
      el.remove();
    }
  }

  // 点击置顶（自由重叠层级）
  function bringToFront(el) {
    el.style.zIndex = (++zTop) + '';
    var item = elements.find(function (it) { return it.el === el; });
    if (item) item.z = zTop;
  }

  /* ---------- 拖动（长按 260ms 触发，单击执行 onClick） ---------- */
  function bindElementEvents(el, data) {
    var startX, startY, startLeft, startTop, offsetX, offsetY;
    var longPressTimer = null;
    var longPressFired = false;

    function onDown(e) {
      if (e.target.closest('.bubble-close')) return;
      if (e.target.closest('.app-window-body')) return; // 窗口内容区由应用自行处理
      var ev = e.touches ? e.touches[0] : e;
      startX = ev.clientX;
      startY = ev.clientY;
      startLeft = parseFloat(el.style.left) || 0;
      startTop = parseFloat(el.style.top) || 0;
      offsetX = ev.clientX - startLeft;
      offsetY = ev.clientY - startTop;
      longPressFired = false;

      longPressTimer = setTimeout(function () {
        longPressFired = true;
        isDragging = true;
        el.classList.add('dragging');
        dragData = { el: el, offsetX: offsetX, offsetY: offsetY };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
      }, 260);
    }

    function onMove(e) {
      e.preventDefault();
      if (!isDragging || !dragData) return;
      var ev = e.touches ? e.touches[0] : e;
      var newX = clamp(ev.clientX - dragData.offsetX, 0, window.innerWidth - el.offsetWidth);
      var newY = clamp(ev.clientY - dragData.offsetY, 0, window.innerHeight - el.offsetHeight);
      el.style.left = newX + 'px';
      el.style.top = newY + 'px';
      data.x = newX;
      data.y = newY;
    }

    function onUp() {
      clearTimeout(longPressTimer);
      if (isDragging) {
        el.classList.remove('dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
        dragData = null;
        isDragging = false;
      }
    }

    el.addEventListener('pointerdown', function (e) {
      bringToFront(el);
      onDown(e);
    });
    el.addEventListener('touchstart', function (e) {
      bringToFront(el);
      onDown(e);
    }, { passive: false });
    el.addEventListener('selectstart', function (e) { e.preventDefault(); });
    // 单击（非长按拖动）
    el.addEventListener('click', function (e) {
      if (longPressFired || isDragging) return;
      if (data.onClick) data.onClick(e, data);
    });
  }

  /* ============================================================
     2. 缩放控制（滚轮 / 双指）
     ============================================================ */
  var lastTouchDist = 0;

  function handleZoom(factor, cx, cy) {
    var newScale = clamp(currentScale * factor, MIN_SCALE, MAX_SCALE);
    if (newScale === currentScale) return;
    currentScale = newScale;
    cx = cx == null ? window.innerWidth / 2 : cx;
    cy = cy == null ? window.innerHeight / 2 : cy;

    elements.forEach(function (item) {
      var el = item.el;
      var left = parseFloat(el.style.left) || 0;
      var top = parseFloat(el.style.top) || 0;
      var w = parseFloat(el.style.width) || 80;
      var h = parseFloat(el.style.height) || 80;
      var dx = left + w / 2 - cx;
      var dy = top + h / 2 - cy;
      var nw = Math.max(24, w * factor);
      var nh = Math.max(24, h * factor);
      var nl = cx + dx * factor - nw / 2;
      var nt = cy + dy * factor - nh / 2;
      el.style.left = nl + 'px';
      el.style.top = nt + 'px';
      el.style.width = nw + 'px';
      el.style.height = nh + 'px';
      item.x = nl; item.y = nt; item.w = nw; item.h = nh;
    });

    if (zoomSpan) zoomSpan.textContent = Math.round(currentScale * 100) + '%';
    if (zoomIndicator) {
      zoomIndicator.classList.add('show');
      clearTimeout(zoomIndicator._hideTimer);
      zoomIndicator._hideTimer = setTimeout(function () {
        zoomIndicator.classList.remove('show');
      }, 1500);
    }
  }

  document.addEventListener('wheel', function (e) {
    if (e.target.closest('#terminal-input-area') || e.target.closest('.app-foreground')) return;
    e.preventDefault();
    handleZoom(e.deltaY > 0 ? 0.9 : 1.1, e.clientX, e.clientY);
  }, { passive: false });

  document.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) {
      var dx = e.touches[0].clientX - e.touches[1].clientX;
      var dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist = Math.sqrt(dx * dx + dy * dy);
    }
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      var dx = e.touches[0].clientX - e.touches[1].clientX;
      var dy = e.touches[0].clientY - e.touches[1].clientY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (lastTouchDist > 0) {
        var cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        var cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        handleZoom(dist / lastTouchDist, cx, cy);
      }
      lastTouchDist = dist;
    }
  }, { passive: false });

  function setScale(v) {
    handleZoom(v / currentScale, window.innerWidth / 2, window.innerHeight / 2);
  }

  /* ---------- 暴露核心（供其他模块使用） ---------- */
  window.__voidCore = {
    elements: elements,
    createElement: createElement,
    removeElement: removeElement,
    bringToFront: bringToFront,
    escapeHtml: escapeHtml,
    clamp: clamp,
    rand: rand,
    scale: function () { return currentScale; },
    setScale: setScale,
    isDragging: function () { return isDragging; }
  };
})();
