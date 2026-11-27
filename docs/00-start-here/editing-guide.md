# 快速编辑指南

## 从网站直接编辑

1. 打开网站中的任意文章。
2. 滚动到文章底部。
3. 点击 **在 GitHub 上编辑此页**。
4. GitHub 会打开对应的 Markdown 文件。
5. 点击铅笔图标，在线修改。
6. 点击 Commit changes 提交。
7. 等待 GitHub Pages 自动更新。

## 新增文章

1. 在对应主题目录中新建 .md 文件。
2. 复制 templates/technical-note.md 的结构。
3. 打开 docs/_sidebar.md，添加文章链接。
4. 提交后左侧目录就会出现新页面。

## 新增问题记录

1. 进入 docs/08-problems-and-solutions/ 下对应分类。
2. 复制 templates/problem.md。
3. 按日期和简短主题命名。
4. 填写环境、复现步骤、根因、解决方法和验证结果。
5. 更新 docs/08-problems-and-solutions/INDEX.md。
6. 在 docs/_sidebar.md 添加链接。

## 常用 Markdown

~~~markdown
# 一级标题
## 二级标题
**重点内容**
- 列表项目
[链接文字](相对路径.md)

$$
J = \sum_{t=0}^{T} \ell(x_t, u_t)
$$
~~~

GitHub Pages 是公开网站。不要上传企业内部资料、保密论文、敏感机器人日志、密码或 Token。
