/* ============================================================
 * global-ui.js — 全局样式设置 & UI 隐藏功能（自包含）
 * 注入悬浮控制按钮 + 设置面板 + 所需样式，任何页面引用即生效
 * 覆盖：index / about / contact / RP / VOID / MT / GG / article(仅API)
 * 存储：siteSettings(主题/背景，兼容旧版) + gui_fontSize + gui_navHidden
 * 暴露：window.GlobalUI（供自建入口的页面同步调用）
 * ============================================================ */
(function () {
    'use strict';
    var hasOwnSettings = !!document.getElementById('settingsToggle');

    /* ---------- 注入样式 ---------- */
    var css = [
        '.gui-fab{position:fixed;right:1rem;bottom:1rem;display:flex;flex-direction:row;gap:.5rem;z-index:9999}',
        '.gui-fab button{width:44px;height:44px;border-radius:50%;border:1px solid rgba(128,128,128,.3);background:rgba(12,22,12,.75);color:inherit;font-size:1.05rem;cursor:pointer;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:0 4px 14px rgba(0,0,0,.35);transition:transform .2s,opacity .2s}',
        '.gui-fab button:hover{transform:scale(1.1)}',
        '.gui-fab button.active{border-color:#e74c3c;background:rgba(231,76,60,.25)}',
        '.gui-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;z-index:10000}',
        '.gui-overlay.show{display:flex}',
        '.gui-panel{width:300px;max-width:92vw;padding:1.2rem 1.3rem;border-radius:1.2rem;background:var(--settings-panel-bg,rgba(12,22,12,.92));border:1px solid var(--settings-panel-border,rgba(255,255,255,.08));box-shadow:0 20px 60px rgba(0,0,0,.5);animation:guiPop .28s cubic-bezier(.34,1.56,.64,1)}',
        '@keyframes guiPop{0%{transform:scale(.9) translateY(14px);opacity:0}100%{transform:scale(1) translateY(0);opacity:1}}',
        '.gui-panel .gui-title{margin:0 0 .35rem;font-size:.98rem;font-weight:700;text-align:center}',
        '.gui-panel .gui-sub{margin:0 0 .9rem;font-size:.75rem;opacity:.6;text-align:center}',
        '.gui-group{margin-bottom:.7rem}',
        '.gui-group .gui-label{font-size:.78rem;opacity:.65;margin-bottom:.35rem}',
        '.gui-group .gui-opts{display:flex;gap:.4rem;flex-wrap:wrap}',
        '.gui-group .gui-opts button{padding:.3rem .9rem;border-radius:2rem;border:1px solid rgba(128,128,128,.28);background:transparent;color:inherit;opacity:.5;cursor:pointer;font-size:.8rem;font-family:inherit;transition:all .2s}',
        '.gui-group .gui-opts button:hover{opacity:.85}',
        '.gui-group .gui-opts button.active{opacity:1;border-color:#66bb6a;color:#66bb6a;background:rgba(102,187,106,.1)}',
        '.gui-actions{display:flex;justify-content:center;gap:.5rem;margin-top:.8rem}',
        '.gui-actions button{padding:.32rem 1.1rem;border-radius:2rem;border:1px solid rgba(128,128,128,.28);background:transparent;color:inherit;cursor:pointer;font-size:.78rem;font-family:inherit}',
        '.gui-actions button:hover{opacity:.85}',
        'body.gui-nav-hidden .nav-menu,body.gui-nav-hidden .nav-links{display:none!important}',
        'body.ui-hidden > :not(.gui-fab):not(.gui-overlay){opacity:0!important;pointer-events:none!important}',
        'body.ui-hidden .gui-fab button{opacity:.35}',
        'body.ui-hidden .gui-fab button:hover{opacity:1}',
        '@media (max-width:640px){.gui-panel{width:280px}}'
    ].join(String.fromCharCode(10));
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var root = document.documentElement;
    var body = document.body;

    /* ---------- 核心 API ---------- */
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
    window.GlobalUI = {
        loadSettings: loadSettings,
        saveSettings: saveSettings,
        setOpts: setOpts,
        applyAll: applyAll
    };

    /* ---------- 自建入口页面（如 article）不注入 UI ---------- */
    if (hasOwnSettings) { applyAll(); return; }

    /* ---------- 注入悬浮按钮（👁️ 眼睛在左，⚙️ 齿轮在右） ---------- */
    var fab = document.createElement('div');
    fab.className = 'gui-fab';
    fab.innerHTML = '<button id="guiHide" title="隐藏界面">👁️</button><button id="guiSettings" title="样式设置">⚙️</button>';
    document.body.appendChild(fab);

    /* ---------- 注入居中虚化弹窗 ---------- */
    var overlay = document.createElement('div');
    overlay.className = 'gui-overlay';
    overlay.id = 'guiOverlay';
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
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    /* ---------- 弹窗开关 ---------- */
    var settingsBtn = document.getElementById('guiSettings');
    var hideBtn = document.getElementById('guiHide');
    var overlayEl = document.getElementById('guiOverlay');
    function openPanel() { applyAll(); overlayEl.classList.add('show'); }
    function closePanel() { overlayEl.classList.remove('show'); }
    settingsBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        overlayEl.classList.contains('show') ? closePanel() : openPanel();
    });
    document.getElementById('guiClose').addEventListener('click', closePanel);
    overlayEl.addEventListener('click', function (e) {
        if (e.target === overlayEl) closePanel();
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

    /* ---------- 隐藏按钮（👁️ 隐藏所有 UI 只留背景） ---------- */
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
