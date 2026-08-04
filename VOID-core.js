/**
 * VOID-core.js
 * 扁平化文章页核心逻辑
 * 所有文章信息与正文均位于 VOID/ 目录下，无子文件夹
 */

(function() {
    'use strict';

    // ========== 配置 ==========
    const INDEX_PATH = 'VOID/index.json';     // 索引文件
    const DATA_ROOT = 'VOID/';                // 数据根目录（所有正文文件在此）
    const HIDDEN_PASSWORDS = ['纳西妲天下第一可爱！', '纳西妲是最棒的萝莉神！'];
    const CLICK_THRESHOLD = 5;
    const CACHE_KEY = 'voidUnlockCache';

    // ========== 状态 ==========
    let allSeries = [];
    let allArticles = [];                     // 扁平文章列表（方便搜索）
    let currentFilter = '__all__';
    let currentSearch = '';
    let currentArticle = null;
    let clickCount = 0;
    let clickTimer = null;

    // DOM 引用
    const contentEl = document.getElementById('voidContent');
    const seriesSelect = document.getElementById('seriesFilter');
    const searchInput = document.getElementById('searchInput');
    const unlockOverlay = document.getElementById('unlockOverlay');
    const unlockInput = document.getElementById('unlockInput');
    const unlockConfirm = document.getElementById('unlockConfirm');
    const unlockCancel = document.getElementById('unlockCancel');
    const decryptOverlay = document.getElementById('decryptOverlay');
    const decryptInput = document.getElementById('decryptInput');
    const decryptConfirm = document.getElementById('decryptConfirm');
    const decryptCancel = document.getElementById('decryptCancel');

    // ========== 工具函数 ==========
    function toast(msg, dur) {
        dur = dur || 4000;
        if (window.showVoidToast) {
            window.showVoidToast(msg, dur);
        } else {
            alert(msg);
        }
    }

    function getToday() {
        return new Date().toISOString().slice(0, 10);
    }

    function getCache() {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    }
    function setCache(data) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    }

    function isHiddenUnlocked() {
        const cache = getCache();
        return cache.hiddenUnlocked && cache.date === getToday();
    }
    function setHiddenUnlocked() {
        const cache = getCache();
        cache.hiddenUnlocked = true;
        cache.date = getToday();
        setCache(cache);
    }

    function isEncryptedSeriesUnlocked(seriesName) {
        const cache = getCache();
        return cache.encryptedSeries && cache.encryptedSeries[seriesName] === getToday();
    }
    function unlockEncryptedSeries(seriesName) {
        const cache = getCache();
        if (!cache.encryptedSeries) cache.encryptedSeries = {};
        cache.encryptedSeries[seriesName] = getToday();
        setCache(cache);
    }

    // ========== 数据加载 ==========
    function loadIndex() {
        return fetch(INDEX_PATH)
            .then(res => {
                if (!res.ok) throw new Error('索引加载失败 (HTTP ' + res.status + ')');
                return res.json();
            })
            .then(data => {
                allSeries = data.series || [];
                // 构建扁平文章列表（每条记录附带所属系列信息）
                allArticles = [];
                for (const s of allSeries) {
                    const articles = s.articles || [];
                    for (const a of articles) {
                        allArticles.push({
                            ...a,
                            _seriesName: s.name,
                            _seriesType: s.type,
                            _seriesDesc: s.desc
                        });
                    }
                }
                populateSelect();
                renderContent();
                bindSearch();
                return allSeries;
            })
            .catch(err => {
                toast('❌ 索引加载失败：' + err.message);
                contentEl.innerHTML = '<div class="void-empty">索引加载失败，请检查 VOID/index.json 是否存在</div>';
            });
    }

    // ========== 获取可见系列 ==========
    function getVisibleSeries() {
        const hiddenOk = isHiddenUnlocked();
        const result = [];
        for (const s of allSeries) {
            if (s.type === 'encrypted') {
                if (isEncryptedSeriesUnlocked(s.name)) result.push(s);
            } else if (s.type === 'hidden') {
                if (hiddenOk) result.push(s);
            } else {
                result.push(s);
            }
        }
        return result;
    }

    // ========== 获取可见文章（基于当前系列和搜索） ==========
    function getVisibleArticles() {
        const visibleSeriesNames = new Set(getVisibleSeries().map(s => s.name));

        // 先过滤出可见系列的文章
        let articles = allArticles.filter(a => visibleSeriesNames.has(a._seriesName));

        // 按系列过滤
        if (currentFilter !== '__all__') {
            articles = articles.filter(a => a._seriesName === currentFilter);
        }

        // 搜索过滤
        if (currentSearch.trim()) {
            const kw = currentSearch.trim().toLowerCase();
            articles = articles.filter(a =>
                (a.title || '').toLowerCase().includes(kw) ||
                (a.desc || '').toLowerCase().includes(kw)
            );
        }

        return articles;
    }

    // ========== 填充下拉框 ==========
    function populateSelect() {
        const currentVal = seriesSelect.value;
        seriesSelect.innerHTML = '<option value="__all__">📂 全部系列</option>';
        const visible = getVisibleSeries();
        for (const s of visible) {
            const opt = document.createElement('option');
            opt.value = s.name;
            const label = s.name + (s.type === 'encrypted' ? ' 🔒' : s.type === 'hidden' ? ' 🔐' : '');
            opt.textContent = label;
            seriesSelect.appendChild(opt);
        }
        if (currentVal && Array.from(seriesSelect.options).some(o => o.value === currentVal)) {
            seriesSelect.value = currentVal;
        } else {
            seriesSelect.value = '__all__';
        }
        currentFilter = seriesSelect.value;
    }

    // ========== 渲染内容 ==========
    function renderContent() {
        const articles = getVisibleArticles();

        if (articles.length === 0) {
            contentEl.innerHTML = '<div class="void-empty">📭 没有找到文章</div>';
            return;
        }

        // 如果当前在阅读某篇文章且仍然存在，保持阅读模式
        if (currentArticle) {
            const stillExists = articles.some(a => a.id === currentArticle.id);
            if (stillExists) {
                renderArticleBody(currentArticle);
                return;
            } else {
                currentArticle = null;
            }
        }

        // 渲染文章列表（卡片网格）
        let html = '<div class="article-grid">';
        for (const a of articles) {
            const badge = a.encrypted ? '<span class="badge">🔒</span>' : '';
            const typeLabel = a._seriesType === 'encrypted' ? '🔒' : a._seriesType === 'hidden' ? '🔐' : '';
            html += `
                <div class="article-item" data-id="${a.id}" data-series="${a._seriesName}">
                    <div class="title">${a.title || '无标题'} ${badge}</div>
                    <div class="desc">${a.desc || ''}</div>
                    <div class="meta">
                        <span>${a.date || ''}</span>
                        ${(a.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}
                        ${typeLabel ? `<span class="tag">${typeLabel}</span>` : ''}
                    </div>
                </div>
            `;
        }
        html += '</div>';
        contentEl.innerHTML = html;

        // 点击文章卡片 → 进入正文
        document.querySelectorAll('.article-item').forEach(el => {
            el.addEventListener('click', function() {
                const id = this.dataset.id;
                const seriesName = this.dataset.series;
                const article = allArticles.find(a => a.id === id && a._seriesName === seriesName);
                if (article) {
                    currentArticle = article;
                    renderArticleBody(article);
                }
            });
        });
    }

    // ========== 渲染正文 ==========
    function renderArticleBody(article) {
        contentEl.innerHTML = '<div class="void-empty">⏳ 加载正文...</div>';

        const bodyFile = article.bodyFile;
        if (!bodyFile) {
            contentEl.innerHTML = '<div class="void-empty">该文章没有正文文件</div>';
            return;
        }

        // 直接读取 VOID/ 目录下的文件（扁平结构）
        const filePath = DATA_ROOT + encodeURIComponent(bodyFile);

        fetch(filePath)
            .then(res => {
                if (!res.ok) throw new Error('正文文件加载失败 (HTTP ' + res.status + ')');
                return res.text();
            })
            .then(text => {
                if (article.encrypted === true) {
                    // 加密文章 → 显示解密按钮
                    contentEl.innerHTML = `
                        <div style="text-align:center; padding:2rem;">
                            <p>🔒 该文章已加密，需要解密才能阅读。</p>
                            <button class="btn btn-primary" id="decryptBtn">🔑 解密</button>
                            <button class="btn btn-secondary" id="backBtn" style="margin-left:0.5rem;">← 返回</button>
                        </div>
                    `;
                    document.getElementById('decryptBtn')?.addEventListener('click', function() {
                        openDecryptDialog(article, text);
                    });
                    document.getElementById('backBtn')?.addEventListener('click', function() {
                        currentArticle = null;
                        renderContent();
                    });
                    return;
                }

                // 普通正文 → 渲染 Markdown
                const htmlContent = marked.parse(text);
                contentEl.innerHTML = `
                    <div class="article-body">${htmlContent}</div>
                    <div style="margin-top:1.5rem; text-align:center;">
                        <button class="btn btn-secondary" id="backFromBody">← 返回文章列表</button>
                    </div>
                `;
                document.getElementById('backFromBody')?.addEventListener('click', function() {
                    currentArticle = null;
                    renderContent();
                });
            })
            .catch(err => {
                toast('❌ 加载正文失败：' + err.message);
                contentEl.innerHTML = '<div class="void-empty">正文加载失败，请检查文件是否存在</div>';
            });
    }

    // ========== 解密弹窗（加密2） ==========
    function openDecryptDialog(article, encryptedText) {
        decryptOverlay.classList.add('active');
        decryptInput.value = '';
        decryptInput.focus();

        const confirmHandler = function() {
            const key = decryptInput.value.trim();
            if (!key) {
                toast('请输入密钥');
                return;
            }
            // ===== 对称解密占位 =====
            // 替换为真实解密算法，解密后得到 decrypted 字符串
            // 示例：密钥为 "123" 时解密成功
            let decrypted = null;
            try {
                if (key === '123') {
                    decrypted = '己解密\n这是解密后的正文内容（示例）。\n\n你可以在这里写真正的文章内容。';
                } else {
                    throw new Error('密钥错误');
                }
            } catch (e) {
                toast('❌ 解密失败：' + e.message);
                decryptOverlay.classList.remove('active');
                return;
            }

            // 检查首行是否为 "己解密"
            const lines = decrypted.split('\n');
            if (lines.length > 0 && lines[0].trim() === '己解密') {
                const body = lines.slice(1).join('\n');
                const htmlContent = marked.parse(body);
                contentEl.innerHTML = `
                    <div class="article-body">${htmlContent}</div>
                    <div style="margin-top:1.5rem; text-align:center;">
                        <button class="btn btn-secondary" id="backFromDecrypt">← 返回文章列表</button>
                    </div>
                `;
                document.getElementById('backFromDecrypt')?.addEventListener('click', function() {
                    currentArticle = null;
                    renderContent();
                });
                toast('✅ 解密成功');
            } else {
                toast('❌ 解密失败：首行未找到 "己解密"');
            }
            decryptOverlay.classList.remove('active');
        };
        const cancelHandler = function() {
            decryptOverlay.classList.remove('active');
        };

        decryptConfirm.onclick = confirmHandler;
        decryptCancel.onclick = cancelHandler;
        decryptInput.onkeydown = function(e) {
            if (e.key === 'Enter') confirmHandler();
        };
        decryptOverlay.onclick = function(e) {
            if (e.target === decryptOverlay) cancelHandler();
        };
    }

    // ========== 搜索 ==========
    function bindSearch() {
        searchInput.addEventListener('input', function() {
            currentSearch = this.value;
            currentArticle = null;
            renderContent();
        });
    }

    // ========== 系列选择 ==========
    seriesSelect.addEventListener('change', function() {
        currentFilter = this.value;
        currentArticle = null;
        renderContent();
    });

    // ========== 连续点击标题触发解锁 ==========
    function setupTitleClick() {
        const brand = document.querySelector('.void-header .brand .typing-title');
        if (!brand) return;
        brand.style.cursor = 'pointer';
        brand.addEventListener('click', function(e) {
            clickCount++;
            clearTimeout(clickTimer);
            clickTimer = setTimeout(() => { clickCount = 0; }, 800);
            if (clickCount >= CLICK_THRESHOLD) {
                clickCount = 0;
                openUnlockDialog();
            }
        });
    }

    // ========== 解锁弹窗 ==========
    function openUnlockDialog() {
        unlockOverlay.classList.add('active');
        unlockInput.value = '';
        unlockInput.focus();

        const confirmHandler = function() {
            const input = unlockInput.value.trim();
            if (!input) {
                toast('请输入内容');
                return;
            }

            if (input.startsWith('*')) {
                const seriesName = input.slice(1).trim();
                const target = allSeries.find(s => s.type === 'encrypted' && s.name === seriesName);
                if (target) {
                    if (isEncryptedSeriesUnlocked(target.name)) {
                        toast('该系列已解锁');
                    } else {
                        unlockEncryptedSeries(target.name);
                        toast('✅ 系列 "' + target.name + '" 已解锁');
                        refreshView();
                    }
                } else {
                    toast('❌ 未找到名为 "' + seriesName + '" 的加密系列');
                }
            } else {
                if (HIDDEN_PASSWORDS.includes(input)) {
                    if (isHiddenUnlocked()) {
                        toast('隐藏内容已解锁，无需重复操作');
                    } else {
                        setHiddenUnlocked();
                        toast('✅ 隐藏内容已解锁（今日有效）');
                        refreshView();
                    }
                } else {
                    toast('❌ 密码错误');
                }
            }
            unlockOverlay.classList.remove('active');
        };
        const cancelHandler = function() {
            unlockOverlay.classList.remove('active');
        };

        unlockConfirm.onclick = confirmHandler;
        unlockCancel.onclick = cancelHandler;
        unlockInput.onkeydown = function(e) {
            if (e.key === 'Enter') confirmHandler();
        };
        unlockOverlay.onclick = function(e) {
            if (e.target === unlockOverlay) cancelHandler();
        };
    }

    // ========== 刷新视图 ==========
    function refreshView() {
        populateSelect();
        currentArticle = null;
        renderContent();
    }

    // ========== 设置面板（复用首页逻辑） ==========
    function setupSettings() {
        const htmlRoot = document.getElementById('htmlRoot') || document.documentElement;
        const settingsToggle = document.getElementById('settingsToggle');
        const settingsOverlay = document.getElementById('settingsOverlay');
        const settingsClose = document.getElementById('settingsClose');
        const themeOptions = document.getElementById('themeOptions');
        const bgOptions = document.getElementById('bgOptions');

        function loadSettings() {
            try {
                const saved = localStorage.getItem('siteSettings');
                if (saved) return JSON.parse(saved);
            } catch (e) {}
            return { theme: 'default', bg: 'default' };
        }
        function saveSettings(settings) {
            try { localStorage.setItem('siteSettings', JSON.stringify(settings)); } catch (e) {}
        }
        function applySettings(settings) {
            const theme = settings.theme || 'default';
            htmlRoot.removeAttribute('data-theme');
            if (theme !== 'default') htmlRoot.setAttribute('data-theme', theme);
            document.querySelectorAll('#themeOptions .opt-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.theme === theme);
            });
            const bg = settings.bg || 'default';
            htmlRoot.removeAttribute('data-bg');
            if (bg !== 'default') htmlRoot.setAttribute('data-bg', bg);
            document.querySelectorAll('#bgOptions .opt-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.bg === bg);
            });
        }
        function openSettings() {
            applySettings(loadSettings());
            settingsOverlay.classList.add('active');
        }
        function closeSettings() {
            settingsOverlay.classList.remove('active');
        }
        settingsToggle.addEventListener('click', openSettings);
        settingsClose.addEventListener('click', closeSettings);
        settingsOverlay.addEventListener('click', function(e) {
            if (e.target === settingsOverlay) closeSettings();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && settingsOverlay.classLition.contains('active')) closeSettings();
        });
        themeOptions.addEventListener('click', function(e) {
            const btn = e.target.closest('.opt-btn');
            if (!btn) return;
            const settings = loadSettings();
            settings.theme = btn.dataset.theme;
            saveSettings(settings);
            applySettings(settings);
        });
        bgOptions.addEventListener('click', function(e) {
            const btn = e.target.closest('.opt-btn');
            if (!btn) return;
            const settings = loadSettings();
            settings.bg = btn.dataset.bg;
            saveSettings(settings);
            applySettings(settings);
        });
        applySettings(loadSettings());
    }

    // =========== 隐藏/显示UI ==========
    function setupHideUI() {
        const hideToggle = document.getElementById('hideToggle');
        let isHidden = false;
        hideToggle.addEventListener('click', function() {
            isHidden = !isHidden;
            document.body.classList.toggle('ui-hidden', isHidden);
            if (isHidden) {
                this.textContent = '👁️‍🗨️';
                this.classList.add('active');
                this.title = '显示所有UI';
            } else {
                this.textContent = '👁️';
                this.classList.remove('active');
                this.title = '隐藏所月UI，只看背景';
            }
        });
    }

    // ========== 初始化 ==========
    function init() {
        loadIndex().then(() => {
            setupTitleClick();
            setupSettings();
            setupHideUI();
        });
    }

    document.addEventListener('DOMContentLoaded', init);

})();