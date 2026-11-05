# 桑浩翔的博客

基于 Hexo 和 Landscape 主题，通过 GitHub Actions 发布到 GitHub Pages。

## 本地开发

```sh
npm ci
npm run server
```

构建网站：`npm run build`。评论集成检查：`npm test`。

## 开启留言与评论

文章底部和 `/guestbook/` 留言板使用 [Utterances](https://utteranc.es/)。
访客使用 GitHub 账号登录并授权后发表评论，留言保存在此仓库的 GitHub Issues 中。

首次启用需要仓库管理员完成以下配置：

1. 确保仓库为公开仓库，并在 Settings → General → Features 中开启 Issues。
2. 打开 [Utterances GitHub App](https://github.com/apps/utterances)，点击 Install，选择 **Only select repositories**，仅授权 `Big-Fat-Duck.github.io`。
3. 将功能代码推送到 `main`，等待仓库的 Pages workflow 发布完成。
4. 访问任意文章或 `/guestbook/`，登录 GitHub 并发表一条评论，刷新后确认仍然可见。首次评论会自动创建对应的 Issue；其他访客随后可以在同一讨论中留言。

无需配置 Token、客户端密钥、付费服务或自建服务器。管理员可以在仓库 Issues 中管理评论。
未安装应用时，页面组件可以加载，但无法完成首次建帖和站内评论；不要把仅出现评论框视为启用成功。

### 配置

在 `_config.landscape.yml` 中设置：

```yaml
utterances:
  enable: true
  repo: Big-Fat-Duck/Big-Fat-Duck.github.io
  theme: github-light
```

- 设置 `enable: false` 可关闭全部评论。
- 在单篇文章或页面的 front matter 中设置 `comments: false` 可关闭该页评论。
- 首页、归档、分类和标签列表不会加载评论组件。
- 每个页面通过规范化后的固定路径匹配独立讨论，目录地址和 `index.html` 地址共用评论，域名变化不会改变映射；文章路径变化会匹配不同讨论，修改永久链接前请处理旧评论的迁移。
- 评论框无法加载或未启用 JavaScript 时，可使用评论区的 GitHub 链接查看已有讨论。

项目通过 `scripts/comments.js` 和 `layouts/` 扩展 Landscape 的页面模板，未修改 `node_modules`。
安装依赖或重新构建后，评论功能仍会保留。切换主题时，需要为新主题重新接入评论模板。
