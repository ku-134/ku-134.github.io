个人站更新 0.3

1. 新增“资源分类”页面（RP.html）
自动拉取并解析 category.txt，动态展示分类资源，告别手动改 HTML 的麻烦。

2. “我的资源”按钮正式启用
首页按钮现在跳转到资源分类页，不再是个摆设。

3. 邮箱更换为 QQ 邮箱
保护隐私，f2010211@163.com → 3074341324@qq.com。

4. 导航栏统一精简
顶部菜单统一为“首页 · 关于”，联系方式由“交朋友”按钮独立引导。

---

项目结构：

```
ku-134.github.io/
├── index.html          # 首页
├── about.html          # 关于我
├── contact.html        # 联系方式
├── RP.html             # 资源分类页（自动拉取 category.txt）
├── style.css           # 全局样式（缓存复用）
├── background.webp     # 背景图片
├── category.txt        # 资源数据（可自由编辑）
└── README.md           # 项目说明
```

---

特别呜谢：DeepSeek