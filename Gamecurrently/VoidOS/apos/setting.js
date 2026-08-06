/* ============================================================
   VoidOS · 系统设置 (apos/setting.js)
   桌面系统设置：显示 / 通知 / 系统
   二级页：桌面应用设置（展示开关，动态生效，设置本身始终展示）
   ============================================================ */
(function () {
  'use strict';
  var V = window.VoidOS;

  V.registerApp('setting', {
    name: '系统设置',
    icon: '⚙️',
    fullscreen: true,

    fullscreen: function (stage, api) {
      renderHome(stage, api);
    },

    onClose: function (api) {
      api.notify('系统设置', '设置已关闭');
    }
  });

  /* ---------- 工具 ---------- */
  function getShowApps() {
    try {
      var v = JSON.parse(localStorage.getItem('voidos.showapps'));
      if (v === false) return false;
    } catch (e) {}
    return true;
  }

  function setShowApps(v) {
    try { localStorage.setItem('voidos.showapps', JSON.stringify(v)); } catch (e) {}
  }

  function page() {
    var p = document.createElement('div');
    p.className = 'fg-page';
    return p;
  }

  function sectionTitle(text) {
    var s = document.createElement('div');
    s.className = 'fg-section';
    s.textContent = text;
    return s;
  }

  function linkItem(label, desc, fn) {
    var row = document.createElement('button');
    row.className = 'fg-item';
    row.innerHTML = '<span class="fg-item-label">' + label + '</span>' +
      '<span class="fg-item-desc">' + (desc || '') + '</span>' +
      '<span class="fg-item-arrow">›</span>';
    row.addEventListener('click', fn);
    return row;
  }

  function voidRow(label, desc, extra) {
    var row = document.createElement('div');
    row.className = 'void-row';
    row.innerHTML = '<span class="void-row-info"><span class="void-row-label">' + label + '</span>' +
      '<span class="void-row-desc">' + (desc || '') + '</span></span>';
    if (extra) row.appendChild(extra);
    return row;
  }

  function switchEl(checked, onChange) {
    var label = document.createElement('label');
    label.className = 'void-switch';
    label.innerHTML = '<input type="checkbox"' + (checked ? ' checked' : '') + '><span class="track"></span>';
    var input = label.querySelector('input');
    input.addEventListener('change', function () { onChange(input.checked); });
    return label;
  }

  /* ---------- 主页 ---------- */
  function renderHome(stage, api) {
    stage.innerHTML = '';
    var p = page();

    p.appendChild(sectionTitle('🎨 显示'));
    p.appendChild(linkItem('桌面应用设置', '展示/隐藏桌面应用图标', function () { renderAppSettings(stage, api); }));

    p.appendChild(sectionTitle('📢 通知'));
    p.appendChild(linkItem('通知中心', '右下角通知区：仅展示最新一条，带倒计时进度条', function () { renderNotifyInfo(stage, api); }));

    p.appendChild(sectionTitle('ℹ️ 系统'));
    p.appendChild(linkItem('系统信息', 'VoidOS · 虚空终端 v0.6', function () { api.notify('系统信息', 'VoidOS v0.6 · 虚空终端'); }));
    p.appendChild(linkItem('关于 VoidOS', '版本与致谢', function () { showAbout(stage, api); }));

    stage.appendChild(p);
    api.setTitle('⚙️ 系统设置');
  }

  /* ---------- 二级页：桌面应用设置 ---------- */
  function renderAppSettings(stage, api) {
    api.pushView({
      title: '桌面应用设置',
      mount: function (s) {
        s.innerHTML = '';
        var p = page();
        var showApps = getShowApps();

        var sw = switchEl(showApps, function (on) {
          setShowApps(on);
          V.renderAppIcons();
          api.notify('桌面应用设置', on ? '桌面应用已展示' : '桌面应用已隐藏（系统设置除外）', { icon: '🖥️' });
        });

        p.appendChild(voidRow('展示桌面应用', '关闭后桌面仅保留系统设置图标', sw));

        var tip = document.createElement('div');
        tip.className = 'void-hint';
        tip.textContent = '系统设置本身始终显示，确保可以随时回来修改。';
        p.appendChild(tip);

        s.appendChild(p);
      }
    });
  }

  /* ---------- 二级页：通知中心说明 ---------- */
  function renderNotifyInfo(stage, api) {
    api.pushView({
      title: '通知中心',
      mount: function (s) {
        s.innerHTML = '';
        var p = page();
        var items = [
          { t: '通知区位置', d: '所有通知统一在右下角通知区展示，不再随机散落桌面' },
          { t: '最新一条', d: '通知区只保留最新一条通知，新通知替换旧通知' },
          { t: '倒计时进度条', d: '气泡底部进度条展示剩余展示时间' },
          { t: '快速测试', d: '在桌面输入 notify 标题|内容 命令可发送测试通知' }
        ];
        items.forEach(function (it) {
          p.appendChild(linkItem(it.t, it.d, function () {}));
        });
        s.appendChild(p);
      }
    });
  }

  /* ---------- 二级页：关于 ---------- */
  function showAbout(stage, api) {
    api.pushView({
      title: '关于 VoidOS',
      html: '<div class="fg-page fg-center">' +
        '<div class="about-logo">👁️</div>' +
        '<div class="about-title">VoidOS · 虚空终端</div>' +
        '<div class="about-ver">v0.6</div>' +
        '<div class="about-desc">桌面即引擎，气泡即宇宙。<br>虚空之眼连接着终端与世界树。<br><br>由 大贤者 & 纳西妲 共同维护</div>' +
        '</div>',
      mount: function () {}
    });
  }
})();