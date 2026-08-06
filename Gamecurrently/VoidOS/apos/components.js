/* ============================================================
   VoidOS · 组件中心 (apos/components.js)
   桌面组件开关管理：注册/移除桌面组件气泡
   内置时间/日历默认开启，状态保存于 localStorage
   ============================================================ */
(function () {
  'use strict';
  var V = window.VoidOS;
  var STATE_KEY = 'voidos.components.state';

  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(STATE_KEY));
      if (s && typeof s === 'object') return s;
    } catch (e) {}
    return {};
  }

  function saveState(s) {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch (e) {}
  }

  function defaultPos(type) {
    if (type === 'time') return { x: 30, y: 40, w: 170, h: 92 };
    if (type === 'calendar') return { x: Math.max(30, window.innerWidth - 190), y: 40, w: 130, h: 108 };
    return { x: 30, y: 200, w: 160, h: 100 };
  }

  V.registerApp('components', {
    name: '组件中心',
    icon: '🧩',
    fullscreen: true,

    fullscreen: function (stage, api) {
      render(stage, api);
    }
  });

  function render(stage, api) {
    stage.innerHTML = '';
    var state = loadState();
    var types = V.getComponents();

    // 未记录的类型默认开启（time/calendar 默认 true）
    types.forEach(function (t) {
      if (state[t.type] == null) state[t.type] = true;
    });
    saveState(state);

    var page = document.createElement('div');
    page.className = 'fg-page';

    var head = document.createElement('div');
    head.className = 'fg-item';
    head.innerHTML = '<span class="fg-item-label">🧩 桌面组件</span>' +
      '<span class="fg-item-desc">开启/关闭会立即在桌面创建或移除组件气泡</span>';
    page.appendChild(head);

    types.forEach(function (t) {
      var row = document.createElement('label');
      row.className = 'void-row';
      var on = state[t.type] === true;
      row.innerHTML =
        '<span class="void-row-info"><span class="void-row-label">' + t.name + '</span>' +
        '<span class="void-row-desc">' + (t.desc || '') + '</span></span>' +
        '<span class="void-switch"><input type="checkbox"' + (on ? ' checked' : '') + '>' +
        '<span class="track"></span></span>';
      var input = row.querySelector('input');
      input.addEventListener('change', function () {
        state[t.type] = input.checked;
        saveState(state);
        if (input.checked) {
          V.createComponent(t.type, defaultPos(t.type));
          api.notify('组件中心', t.name + ' 组件已开启', { icon: '🧩' });
        } else {
          V.removeComponent(t.type);
          api.notify('组件中心', t.name + ' 组件已关闭', { icon: '🧩' });
        }
      });
      page.appendChild(row);
    });

    stage.appendChild(page);
    api.setTitle('🧩 组件中心');
  }
})();