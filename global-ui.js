/* ============================================================
 * global-ui.js — 全局样式设置 & UI 隐藏功能（自包含）
 * 注入悬浮控制按钮 + 设置面板 + 所需样式，任何页面引用即生效
 * 覆盖：index / about / contact / RP / VOID / MT / GG
 * 存储：siteSettings(主题/背景，兼容旧版) + gui_fontSize + gui_navHidden
 * ============================================================ */
(function () {
    'use strict';

    /* ---------- 注入样式 ---------- */
    var css = [
        '.gui-fab{position:fixed;right:1rem;bottom:1rem;display:flex;flex-direction:column;gap:.5rem;z-index:9999}',
        '.gui-fab button{width:44px;height:44px;border-radius:50%;border:1px solid rgba(128,128,128,.3);background:rgba(12,22,12,.75);color:inherit;font-size:1.05rem;cursor:pointer;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:0 4px 14px rgba(0,0,0,.35);transition:transform .2s,opacity .2s}',
        '.gui-fab button:hover{transform:scale(1.1)}',
        '.gui-fab button.active{border-color:#e74c3c;background:rgba(231,76,60,.25)}',
        '.gui-panel{position:fixed;right:1rem;bottom:5.4rem;width:280px;padding:1.1rem 1.2rem;border-radius:1.1rem;background:var(--settings-panel-bg,rgba(12,22,12,.92));border:1px solid var(--settings-panel-border,rgba(255,255,255,.08));backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);display:none;z-index:9998;box-shadow:0 8px 30px rgba(0,0,0,.4)}',
        '.gui-panel.show{display:block}',
        '.gui-panel .gui-title{margin:0 0 .35rem;font-size:.98rem;font-weight:700}',
        '.gui-panel .gui-sub{margin:0 0 .8rem;font-size:.75rem;opacity:.6}',
        '.gui-group{margin-bottom:.7rem}',
        '.gui-group .gui-label{font-size:.78rem;opacity:.65;margin-bottom:.35rem}',
        '.gui-group .gui-opts{display:flex;gap:.4rem;flex-wrap:wrap}',
        '.gui-group .gui-opts button{padding:.3rem .9rem;border-radius:2rem;border:1px solid rgba(128,128,128,.28);background:transparent;color:inherit;opacity:.5;cursor:pointer;font-size:.8rem;font-family:inherit;transition:all .2s}',
        '.gui-group .gui-opts button:hover{opacity:.85}',
        '.gui-group .gui-opts button.active{opacity:1;border-color:#66bb6a;color:#66bb6a;background:rgba(102,187,106,.1)}',
        '.gui-actions{display:flex;justify-content:flex-end;gap:.5rem;margin-top:.7rem}',
        '.gui-actions button{padding:.32rem 1.1rem;border-radius:2rem;border:1px solid rgba(128,128,128,.28);background:transparent;color:inherit;cursor:pointer;font-size:.78rem;font-family:inherit}',
        '.gui-actions button:hover{opacity:.85}',
        'body.gui-nav-hidden .nav-menu,body.gui-nav-hidden .nav-links{display:none!important}',
        'body.ui-hidden .nav-menu,body.ui-hidden .nav-links,body.ui-hidden .footer,body.ui-hidden .tool-toolbar,body.ui-hidden .tool-cats{display:none!important}',
        'body.ui-hidden .gui-fab button{opacity:.35}',
        'body.ui-hidden .gui-fab button:hover{opacity:1}',
        '@media (max-width:640px){.gui-panel{width:250px}}'
    ].join(String.fromCharCode(10));
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    /* ---------- 注入悬浮按钮 ---------- */
    var fab = document.createElement('div');
    fab.className = 'gui-fab';
    fab.innerHTML = '<button id="guiSettings" title="样式设置">⚙️</button><button id="guiHide" title="隐藏界面">👁️</button>';
    document.body.appendChild(fab);

    /* ---------- 注入设置面板 ---------- */
    var panel = document.createElement('div');
    panel.className = 'gui-panel';
    panel.id = 'guiPanel';
    panel.innerHTML = [
        '<p class="gui-title">⚙️ 样式设置</p>',
        '<p class="gui-sub">自定义你的浏览体验</p>',
        '<div class="gui-group"><div class="gui-label">🎨 主题模式</div><div class="gui-opts" id="guiTheme">',
        '<button data-v="default">默认</button><button data-v="light">亮色</button><button data-v="dark">暗色</button></div></div>',
        '<div class="gui-group"><div class="gui-label">🖼️ 背景图片</div><div class="gui-opts" id="guiBg">',
        '<button data-v="default">默认</button><button data-v="food">海边</button><button data-v="trip">旅途</button><button data-v="electric1">！？电电？！(1)</button><button data-v="electric2">！？电电？！(2)</button></div></div>',
        '<div class="gui-group"><div class="gui-label">🔤 字号</div><div class="gui-opts" id="guiFont">',
        '<button data-v="0.9">小</button><button data-v="1">中</button><button data-v="1.1">大</button></div></div>',
        '<div class="gui-group"><div class="gui-label">👁️ 界面元素</div><div class="gui-opts" id="guiNav">',
        '<button data-v="nav">隐藏导航</button></div></div>',
        '<div class="gui-actions"><button id="guiReset">重置</button><button id="guiClose">关闭</button></div>'
    ].join('');
    document.body.appendChild(panel);

    var root = document.documentElement;
    var body = document.body;

    /* ---------- 设置读写 ---------- */
    function loadSettings() {
        try {
            var s = JSON.parse(localStorage.getItem('siteSettings') || '{}');
            return { theme: s.theme || 'default', bg: s.bg || 'default' };
        } catch (e) { return { theme: 'default', bg: 'default' }; }
    }
    function saveSettings(s) {
        try { localStorage.setItem('siteSettings', JSON.stringify(s)); } catch (e) {}
    }
    function setOpts(id, val) {
        var box = document.getElementById(id);
        if (!box) return;
        box.querySelectorAll('button').forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-v') === val);
        });
    }

    /* ---------- 应用设置 ---------- */
    function applyAll() {
        var s = loadSettings();
        root.removeAttribute('data-theme');
        if (s.theme !== 'default') root.setAttribute('data-theme', s.theme);
        setOpts('guiTheme', s.theme);
        root.removeAttribute('data-bg');
        if (s.bg !== 'default') root.setAttribute('data-bg', s.bg);
        setOpts('guiBg', s.bg);
        var fs = localStorage.getItem('gui_fontSize') || '1';
        root.style.fontSize = (parseFloat(fs) * 16) + 'px';
        setOpts('guiFont', fs);
        var nav = localStorage.getItem('gui_navHidden') === '1';
        body.classList.toggle('gui-nav-hidden', nav);
        setOpts('guiNav', nav ? 'nav' : '');
    }

    /* ---------- 面板开关 ---------- */
    var settingsBtn = document.getElementById('guiSettings');
    var hideBtn = document.getElementById('guiHide');
    var panelEl = document.getElementById('guiPanel');
    function openPanel() { applyAll(); panelEl.classList.add('show'); }
    function closePanel() { panelEl.classList.remove('show'); }
    settingsBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        panelEl.classList.contains('show') ? closePanel() : openPanel();
    });
    document.getElementById('guiClose').addEventListener('click', closePanel);
    document.addEventListener('click', function (e) {
        if (panelEl.classList.contains('show') && !panelEl.contains(e.target) && e.target !== settingsBtn) {
            closePanel();
        }
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closePanel();
    });

    /* ---------- 面板选项 ---------- */
    document.getElementById('guiTheme').addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        var s = loadSettings();
        s.theme = b.getAttribute('data-v');
        saveSettings(s);
        applyAll();
    });
    document.getElementById('guiBg').addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        var s = loadSettings();
        s.bg = b.getAttribute('data-v');
        saveSettings(s);
        applyAll();
    });
    document.getElementById('guiFont').addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        localStorage.setItem('gui_fontSize', b.getAttribute('data-v'));
        applyAll();
    });
    document.getElementById('guiNav').addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        localStorage.setItem('gui_navHidden', body.classList.contains('gui-nav-hidden') ? '0' : '1');
        applyAll();
    });

    /* ---------- 隐藏按钮（👁️ 纯净模式） ---------- */
    hideBtn.addEventListener('click', function () {
        var on = body.classList.toggle('ui-hidden');
        hideBtn.classList.toggle('active', on);
        hideBtn.title = on ? '显示界面' : '隐藏界面';
        hideBtn.textContent = on ? '👁️‍🗨️' : '👁️';
    });

    /* ---------- 重置 ---------- */
    document.getElementById('guiReset').addEventListener('click', function () {
        localStorage.removeItem('siteSettings');
        localStorage.removeItem('gui_fontSize');
        localStorage.removeItem('gui_navHidden');
        body.classList.remove('gui-nav-hidden', 'ui-hidden');
        hideBtn.classList.remove('active');
        hideBtn.title = '隐藏界面';
        hideBtn.textContent = '👁️';
        applyAll();
    });

    /* ---------- 初始化 ---------- */
    applyAll();
})();
