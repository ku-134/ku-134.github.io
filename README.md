# 个人站更新 0.6：

**1. 修复 RP 页面缓存问题**  
为 `category.txt` 请求添加时间戳参数（`?t=Date.now()`），强制浏览器每次拉取最新文件，确保更新后即时生效。

**2. 清理 style.css 冗余样式**  
因弹窗样式已内置于 RP.html，移除 style.css 中相关的弹窗代码，避免冲突与冗余。

---

**项目结构：**

```

ku-134.github.io/
├── index.html          # 首页（新增占位按钮）
├── about.html          # 关于我
├── contact.html        # 联系方式
├── RP.html             # 资源分类页（手动拉取 + 新导航）
├── style.css           # 全局样式（含弹窗样式）
├── background.webp     # 背景图片
├── category.txt        # 资源数据（名称 | 描述 | 链接 | 类型）
└── README.md           # 项目说明

```

---

*特别呜谢：DeepSeek*