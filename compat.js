/* ============================================================
 * compat.js — 全站兼容引擎（自包含 · 建议在 <head> 引入）
 * 职责：
 *  1) 能力检测，评定引擎等级：modern / mid / old
 *  2) 智能降级：old 自动进入兼容模式；mid 由访客选择（主页弹窗）
 *  3) 注入兼容样式（毛玻璃 / 动效 / 固定背景 等降级）
 *  4) 补齐旧引擎缺失的 JS API（fetch / Promise / URLSearchParams 等）
 *  5) 暴露 window.Compat（供全局样式设置面板控制：自动 / 开启 / 关闭）
 * 存储：siteSettings.compat = 'auto' | 'on' | 'off'
 *       gui_compatNotice  = '1'（主页提示已读）
 * 调试：?compat=auto|on|off|reset 临时切换 · ?engine=modern|mid|old 模拟等级
 * ============================================================ */
(function () {
    'use strict';

    var win = window, doc = document, root = doc.documentElement;
    var STORAGE_KEY = 'siteSettings';
    var NOTICE_KEY = 'gui_compatNotice';

    /* ---------- 存取工具 ---------- */
    function storeGet(key, def) { try { return localStorage.getItem(key) || def; } catch (e) { return def; } }
    function storeSet(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }
    function storeDel(key) { try { localStorage.removeItem(key); } catch (e) {} }
    function settingsGet() { try { return JSON.parse(storeGet(STORAGE_KEY, '{}')) || {}; } catch (e) { return {}; } }
    function settingsSet(k, v) {
        var s = settingsGet(); s[k] = v;
        storeSet(STORAGE_KEY, JSON.stringify(s));
    }

    /* ---------- 查询参数 ---------- */
    var query = {};
    (function () {
        var q = (location.search || '').replace(/^\?/, '');
        if (!q) return;
        var parts = q.split('&');
        for (var i = 0; i < parts.length; i++) {
            var kv = parts[i].split('=');
            if (kv[0]) query[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
        }
    })();

    /* ---------- 能力检测 ---------- */
    function detect() {
        var d = {};
        var ua = navigator.userAgent || '';
        var m = ua.match(/(?:Chrome|CriOS)\/(\d+)/i);
        d.chrome = m ? parseInt(m[1], 10) : 0;
        d.webview = /; wv\)/.test(ua) || (/Android/.test(ua) && /Version\/\d+\.\d+/.test(ua));
        var CS = win.CSS;
        d.cssSupports = !!(CS && CS.supports);
        d.cssVars = d.cssSupports ? CS.supports('(--a: 0)') : (function () {
            var el = doc.createElement('i');
            if (!el.style || !el.style.setProperty) return false;
            try { el.style.setProperty('--a', '0'); } catch (e) { return false; }
            return !!el.style.getPropertyValue && el.style.getPropertyValue('--a') === '0';
        })();
        var st = root.style;
        d.backdrop = d.cssSupports ? (CS.supports('backdrop-filter', 'blur(4px)') || CS.supports('-webkit-backdrop-filter', 'blur(4px)'))
                                   : (('backdropFilter' in st) || ('webkitBackdropFilter' in st));
        d.grid = d.cssSupports ? CS.supports('display', 'grid') : ('grid' in st);
        d.flexGap = d.cssSupports ? CS.supports('gap', '1px') : false;
        d.fetch = typeof win.fetch === 'function';
        d.promise = typeof win.Promise === 'function';
        return d;
    }
    var caps = detect();

    function rate(d) {
        if (!d.cssVars || !d.promise || !d.grid || (d.chrome && d.chrome < 49)) return 'old';
        if (!d.backdrop || !d.flexGap || (d.chrome && d.chrome < 84)) return 'mid';
        if (!d.chrome && !d.cssSupports) return 'mid';
        return 'modern';
    }

    /* ---------- 等级与模式 ---------- */
    var level = (query.engine === 'modern' || query.engine === 'mid' || query.engine === 'old') ? query.engine : rate(caps);
    var mode = settingsGet().compat || 'auto';
    if (query.compat === 'auto' || query.compat === 'on' || query.compat === 'off') mode = query.compat;
    if (query.compat === 'reset') {
        storeDel(NOTICE_KEY);
        try { var st0 = settingsGet(); delete st0.compat; storeSet(STORAGE_KEY, JSON.stringify(st0)); } catch (e) {}
        mode = 'auto';
    }

    function isOn() { return (mode === 'on') || (mode === 'auto' && level === 'old'); }
    function apply() {
        root.setAttribute('data-engine', level);
        root.setAttribute('data-compat', isOn() ? 'on' : 'off');
    }
    apply();

    /* ---------- 兼容样式注入 ---------- */
    var skipAnim = /弹幕/.test(decodeURIComponent(location.pathname || ''));
    var css = [
        'html[data-compat="on"]{background-attachment:scroll!important}',
        'html[data-compat="on"] body{background-attachment:scroll!important}',
        'html[data-compat="on"] *{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
        'html[data-compat="on"] .gui-overlay,html[data-compat="on"] .rp-overlay,html[data-compat="on"] .settings-overlay,html[data-compat="on"] .image-overlay{background:rgba(0,0,0,.65)!important}',
        'html[data-compat="on"] .fade-in-up{opacity:1!important;transform:none!important}',
        'html[data-compat="on"] .typing-title .char{opacity:1!important;transform:none!important}',
        'html[data-compat="on"] .typing-title .cursor{display:none!important}',
        'html[data-compat="on"] .article-body>*{opacity:1!important;transform:none!important}',
        'html[data-compat="on"] .placeholder-img{animation:none!important;filter:none!important;opacity:.85!important}',
        'html[data-compat="on"][data-engine="old"] body{background:#eef3ee!important;color:#1a3b1a!important}',
        'html[data-compat="on"][data-engine="old"] .card,html[data-compat="on"][data-engine="old"] .void-card,html[data-compat="on"][data-engine="old"] .tool-card,html[data-compat="on"][data-engine="old"] .article-card,html[data-compat="on"][data-engine="old"] .game-card,html[data-compat="on"][data-engine="old"] .game-container,html[data-compat="on"][data-engine="old"] .stats-card,html[data-compat="on"][data-engine="old"] .rp-modal,html[data-compat="on"][data-engine="old"] .settings-panel,html[data-compat="on"][data-engine="old"] .gui-panel,html[data-compat="on"][data-engine="old"] .tool-modal,html[data-compat="on"][data-engine="old"] .cache-modal{background:rgba(255,255,255,.94)!important;color:#1a3b1a!important;border-color:rgba(0,0,0,.08)!important}',
        'html[data-compat="on"][data-engine="old"] a{color:#1b5e20!important}',
        'html[data-compat="on"][data-engine="old"] .gui-fab button,html[data-compat="on"][data-engine="old"] .ctrl-btn{background:rgba(255,255,255,.92)!important;color:#1a3b1a!important}',
        'body.compat-lock{overflow:hidden!important}',
        '.compat-notice-overlay{position:fixed;top:0;right:0;bottom:0;left:0;z-index:20000;background:rgba(0,0,0,.62);display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;-webkit-justify-content:center;justify-content:center;padding:20px}',
        '.compat-notice-panel{width:340px;max-width:92vw;background:#0c160c;color:#c8e6c9;border:1px solid rgba(255,255,255,.1);border-radius:1.2rem;padding:1.4rem 1.5rem 1.2rem;box-shadow:0 24px 70px rgba(0,0,0,.55);font-family:inherit;text-align:left}',
        '.compat-notice-panel .cn-title{margin:0 0 .5rem;font-size:1.05rem;font-weight:700;text-align:center}',
        '.compat-notice-panel .cn-desc{margin:0 0 1rem;font-size:.85rem;line-height:1.7;opacity:.9}',
        '.compat-notice-panel .cn-desc b{color:#8bffb0}',
        '.compat-notice-panel .cn-actions{display:-webkit-flex;display:flex;gap:.6rem;-webkit-justify-content:center;justify-content:center;-webkit-flex-wrap:wrap;flex-wrap:wrap}',
        '.compat-notice-panel .cn-actions button{padding:.45rem 1.1rem;border-radius:2rem;border:1px solid rgba(128,128,128,.35);background:transparent;color:inherit;font-family:inherit;font-size:.85rem;cursor:pointer;opacity:.95}',
        '.compat-notice-panel .cn-actions button.primary{border-color:#66bb6a;color:#8bffb0}',
        '.compat-notice-panel .cn-actions button[disabled]{opacity:.35;cursor:not-allowed}',
        '.compat-notice-panel .cn-foot{margin:.85rem 0 0;font-size:.72rem;opacity:.45;text-align:center}'
    ];
    if (!skipAnim) {
        css.push('html[data-compat="on"] *,html[data-compat="on"] *::before,html[data-compat="on"] *::after{animation-duration:.001s!important;animation-delay:0s!important;transition-duration:.001s!important;transition-delay:0s!important}');
    }
    var styleEl = doc.createElement('style');
    styleEl.id = 'compatStyle';
    styleEl.appendChild(doc.createTextNode(css.join('\n')));
    (doc.head || root).appendChild(styleEl);

    /* ---------- Polyfills（为旧引擎补零件） ---------- */
    (function () {
        // Object.assign
        if (typeof Object.assign !== 'function') {
            Object.assign = function (target) {
                if (target == null) throw new TypeError('Cannot convert undefined or null to object');
                var to = Object(target);
                for (var i = 1; i < arguments.length; i++) {
                    var src = arguments[i];
                    if (src == null) continue;
                    for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) to[k] = src[k];
                }
                return to;
            };
        }
        // Array.prototype.includes
        if (!Array.prototype.includes) {
            Array.prototype.includes = function (v, from) {
                var len = this.length >>> 0;
                var i = from | 0; if (i < 0) i = Math.max(len + i, 0);
                for (; i < len; i++) { var a = this[i]; if (a === v || (a !== a && v !== v)) return true; }
                return false;
            };
        }
        // Array.from（类数组 / 字符串）
        if (!Array.from) {
            Array.from = function (src, mapFn, thisArg) {
                var out = [], i, len;
                if (typeof src === 'string') { for (i = 0, len = src.length; i < len; i++) out.push(src.charAt(i)); }
                else if (src && typeof src.length === 'number') { for (i = 0, len = src.length; i < len; i++) out.push(src[i]); }
                if (typeof mapFn === 'function') { for (i = 0; i < out.length; i++) out[i] = mapFn.call(thisArg, out[i], i); }
                return out;
            };
        }
        // String 方法
        if (!String.prototype.includes) String.prototype.includes = function (s, p) { return this.indexOf(s, p || 0) !== -1; };
        if (!String.prototype.startsWith) String.prototype.startsWith = function (s, p) { p = p || 0; return this.substring(p, p + s.length) === s; };
        if (!String.prototype.endsWith) String.prototype.endsWith = function (s, l) { var str = this.toString(); if (l === undefined || l > str.length) l = str.length; return str.substring(l - s.length, l) === s; };
        // NodeList / HTMLCollection forEach
        if (win.NodeList && !NodeList.prototype.forEach) NodeList.prototype.forEach = Array.prototype.forEach;
        if (win.HTMLCollection && !HTMLCollection.prototype.forEach) HTMLCollection.prototype.forEach = Array.prototype.forEach;
        // Element.matches / closest
        if (win.Element) {
            var ep = Element.prototype;
            ep.matches = ep.matches || ep.webkitMatchesSelector || ep.mozMatchesSelector || ep.msMatchesSelector || function (sel) {
                var m = (this.document || this.ownerDocument).querySelectorAll(sel), i = m.length;
                while (--i >= 0 && m.item(i) !== this) {}
                return i > -1;
            };
            if (!ep.closest) {
                ep.closest = function (sel) {
                    var el = this;
                    while (el && el.nodeType === 1) {
                        if (el.matches && el.matches(sel)) return el;
                        el = el.parentElement || el.parentNode;
                    }
                    return null;
                };
            }
        }
        // requestAnimationFrame
        if (!win.requestAnimationFrame) {
            var lastTime = 0;
            win.requestAnimationFrame = function (cb) {
                var now = Date.now();
                var next = Math.max(0, 16 - (now - lastTime));
                lastTime = now + next;
                return setTimeout(function () { cb(Date.now()); }, next);
            };
            win.cancelAnimationFrame = function (id) { clearTimeout(id); };
        }
        // URLSearchParams（子集：get / has / getAll / toString）
        if (!win.URLSearchParams) {
            var USP = function (qs) {
                this._pairs = [];
                qs = String(qs || '').replace(/^\?/, '');
                if (!qs) return;
                var parts = qs.split('&');
                for (var i = 0; i < parts.length; i++) {
                    var kv = parts[i].split('=');
                    if (!kv[0]) continue;
                    this._pairs.push([
                        decodeURIComponent(kv[0].replace(/\+/g, ' ')),
                        decodeURIComponent((kv[1] || '').replace(/\+/g, ' '))
                    ]);
                }
            };
            USP.prototype.get = function (k) {
                for (var i = 0; i < this._pairs.length; i++) if (this._pairs[i][0] === k) return this._pairs[i][1];
                return null;
            };
            USP.prototype.getAll = function (k) {
                var out = [];
                for (var i = 0; i < this._pairs.length; i++) if (this._pairs[i][0] === k) out.push(this._pairs[i][1]);
                return out;
            };
            USP.prototype.has = function (k) { return this.get(k) !== null; };
            USP.prototype.toString = function () {
                var out = [];
                for (var i = 0; i < this._pairs.length; i++) out.push(encodeURIComponent(this._pairs[i][0]) + '=' + encodeURIComponent(this._pairs[i][1]));
                return out.join('&');
            };
            win.URLSearchParams = USP;
        }
        // Promise（迷你实现）
        if (!win.Promise) {
            var PENDING = 0, FULFILLED = 1, REJECTED = 2;
            var P = function (executor) {
                var self = this;
                self._state = PENDING; self._value = undefined; self._cbs = [];
                var run = function () {
                    if (self._state === PENDING) return;
                    setTimeout(function () {
                        var cbs = self._cbs; self._cbs = [];
                        for (var i = 0; i < cbs.length; i++) {
                            var cb = cbs[i];
                            var fn = self._state === FULFILLED ? cb.onFulfilled : cb.onRejected;
                            if (typeof fn !== 'function') {
                                (self._state === FULFILLED ? cb.resolve : cb.reject)(self._value);
                                continue;
                            }
                            try { cb.resolve(fn(self._value)); } catch (e) { cb.reject(e); }
                        }
                    }, 0);
                };
                self._run = run;
                function settle(state, value) {
                    if (self._state !== PENDING) return;
                    if (state === FULFILLED && value && typeof value.then === 'function') {
                        value.then(res, rej);
                        return;
                    }
                    self._state = state; self._value = value;
                    self._run();
                }
                function res(v) { settle(FULFILLED, v); }
                function rej(e) { settle(REJECTED, e); }
                try { executor(res, rej); } catch (e) { rej(e); }
            };
            P.prototype.then = function (onFulfilled, onRejected) {
                var self = this;
                return new P(function (resolve, reject) {
                    self._cbs.push({ onFulfilled: onFulfilled, onRejected: onRejected, resolve: resolve, reject: reject });
                    self._run();
                });
            };
            P.prototype['catch'] = function (onRejected) { return this.then(null, onRejected); };
            P.resolve = function (v) {
                if (v instanceof P) return v;
                return new P(function (res2) { res2(v); });
            };
            P.reject = function (e) { return new P(function (res2, rej2) { rej2(e); }); };
            P.all = function (arr) {
                return new P(function (resolve, reject) {
                    var n = arr.length, out = [], left = n;
                    if (!n) { resolve([]); return; }
                    for (var i = 0; i < n; i++) {
                        (function (idx) {
                            P.resolve(arr[idx]).then(function (v) { out[idx] = v; if (--left === 0) resolve(out); }, reject);
                        })(i);
                    }
                });
            };
            P.race = function (arr) {
                return new P(function (resolve, reject) {
                    for (var i = 0; i < arr.length; i++) P.resolve(arr[i]).then(resolve, reject);
                });
            };
            win.Promise = P;
        }
        // fetch（XHR 包装）
        if (!win.fetch && win.Promise) {
            win.fetch = function (url, opts) {
                opts = opts || {};
                return new win.Promise(function (resolve, reject) {
                    var xhr = new XMLHttpRequest();
                    xhr.open(opts.method || 'GET', url, true);
                    if (opts.headers) {
                        try {
                            for (var k in opts.headers) if (Object.prototype.hasOwnProperty.call(opts.headers, k)) xhr.setRequestHeader(k, opts.headers[k]);
                        } catch (e) {}
                    }
                    xhr.onreadystatechange = function () {
                        if (xhr.readyState !== 4) return;
                        var body = xhr.responseText != null ? xhr.responseText : xhr.response;
                        var res = {
                            ok: (xhr.status >= 200 && xhr.status < 300) || xhr.status === 304,
                            status: xhr.status,
                            statusText: xhr.statusText || '',
                            url: url,
                            text: function () { return win.Promise.resolve(String(body == null ? '' : body)); },
                            json: function () {
                                return new win.Promise(function (res2, rej2) {
                                    try { res2(JSON.parse(body)); } catch (e) { rej2(e); }
                                });
                            }
                        };
                        resolve(res);
                    };
                    xhr.onerror = function () { reject(new TypeError('Network request failed')); };
                    xhr.ontimeout = function () { reject(new TypeError('Network request timed out')); };
                    try { xhr.send(opts.body || null); } catch (e) { reject(e); }
                });
            };
        }
    })();

    /* ---------- 主页兼容提示弹窗（中间区 · 3 秒强制阅读） ---------- */
    function isHomePage() {
        var p = location.pathname || '';
        return p === '/' || /\/index\.html?$/i.test(p);
    }
    function showNotice() {
        if (!isHomePage()) return;
        if (level !== 'mid') return;
        if (mode !== 'auto') return;
        if (storeGet(NOTICE_KEY, '') === '1') return;
        if (doc.getElementById('compatNoticeOverlay')) return;

        var ov = doc.createElement('div');
        ov.className = 'compat-notice-overlay';
        ov.id = 'compatNoticeOverlay';
        var ver = caps.chrome ? ('Chrome ' + caps.chrome + (caps.webview ? ' · WebView' : '')) : '未知版本';
        ov.innerHTML = [
            '<div class="compat-notice-panel">',
            '<div class="cn-title">🧩 兼容性提示</div>',
            '<div class="cn-desc">检测到您的浏览器内核（<b>' + ver + '</b>）处于中间区间，部分特效（毛玻璃 / 动效）可能影响浏览流畅度。<br>是否改用<b>兼容浏览</b>？（降低特效，内容与功能完整保留）</div>',
            '<div class="cn-actions">',
            '<button type="button" class="primary" id="compatNoticeOn" disabled>开启兼容浏览</button>',
            '<button type="button" id="compatNoticeOff" disabled>继续正常浏览</button>',
            '</div>',
            '<div class="cn-foot" id="compatNoticeFoot">⏳ 请阅读，3 秒后可选择…</div>',
            '</div>'
        ].join('');
        doc.body.appendChild(ov);
        doc.body.className += (doc.body.className ? ' ' : '') + 'compat-lock';

        var left = 3;
        var btnOn = doc.getElementById('compatNoticeOn');
        var btnOff = doc.getElementById('compatNoticeOff');
        var foot = doc.getElementById('compatNoticeFoot');
        function tick() {
            left--;
            if (left > 0) {
                foot.innerHTML = '⏳ 请阅读，' + left + ' 秒后可选择…';
                setTimeout(tick, 1000);
            } else {
                btnOn.disabled = false; btnOff.disabled = false;
                foot.innerHTML = '之后可随时在右下角 ⚙️ 样式设置中更改';
            }
        }
        setTimeout(tick, 1000);

        function close() {
            if (ov.parentNode) ov.parentNode.removeChild(ov);
            doc.body.className = (' ' + doc.body.className + ' ').replace(' compat-lock ', ' ').replace(/^\s+|\s+$/g, '');
        }
        btnOn.onclick = function () {
            if (btnOn.disabled) return;
            storeSet(NOTICE_KEY, '1');
            API.setMode('on');
            close();
        };
        btnOff.onclick = function () {
            if (btnOff.disabled) return;
            storeSet(NOTICE_KEY, '1');
            close();
        };
    }
    if (doc.readyState === 'loading') {
        doc.addEventListener('DOMContentLoaded', showNotice);
    } else {
        showNotice();
    }

    /* ---------- 对外 API ---------- */
    function setMode(m) {
        if (m !== 'auto' && m !== 'on' && m !== 'off') return;
        mode = m;
        settingsSet('compat', m);
        apply();
    }
    function reset() {
        storeDel(NOTICE_KEY);
        try { var s2 = settingsGet(); delete s2.compat; storeSet(STORAGE_KEY, JSON.stringify(s2)); } catch (e) {}
        mode = 'auto';
        apply();
    }
    var API = {
        version: '1.0',
        level: level,
        caps: caps,
        getMode: function () { return mode; },
        setMode: setMode,
        isOn: isOn,
        apply: apply,
        reset: reset
    };
    win.Compat = API;
    apply();
})();
