// 更新日期: 2026-07-27
// 更新内容:
// 1. 无论是否重定向，只要目标是 AWS S3，就自动补全 x-amz-content-sha256 和 x-amz-date
// 2. 改进Docker镜像路径处理逻辑，支持多种格式: 如 hello-world | library/hello-world | docker.io/library/hello-world
// 3. 解决大陆拉取第三方 Docker 镜像层失败的问题，自动递归处理所有 302/307 跳转，无论跳转到哪个域名，都由 Worker 继续反代，避免客户端直接访问被墙 CDN，从而提升拉取成功率
// 4. 感谢老王，处理了暗黑模式下，输入框的颜色显示问题
// 5. 支持 Git smart-http 协议代理，解决 git clone 时 GitHub 返回 dumb-http 403 错误
// 6. 支持 GitLab 系列域名（gitlab.com 等）的 git clone 加速
// 7. 首页新增 Git Clone 加速功能模块，方便生成加速命令
// 8. 改进链接的拼接逻辑，兼容反向代理下的非 https 以及带有端口号的 host
// 用户配置区域开始 =================================
// 以下变量用于配置代理服务的白名单和安全设置，可根据需求修改。

// ALLOWED_HOSTS: 定义允许代理的域名列表（默认白名单）。
// - 添加新域名：将域名字符串加入数组，如 'docker.io'。
// - 注意：仅支持精确匹配的域名（如 'github.com'），不支持通配符。
// - 只有列出的域名会被处理，未列出的域名将返回 400 错误。
// 示例：const ALLOWED_HOSTS = ['github.com', 'docker.io'];
const ALLOWED_HOSTS = [
  'quay.io',
  'gcr.io',
  'k8s.gcr.io',
  'registry.k8s.io',
  'ghcr.io',
  'docker.cloudsmith.io',
  'registry-1.docker.io',
  'github.com',
  'api.github.com',
  'raw.githubusercontent.com',
  'gist.github.com',
  'gist.githubusercontent.com',
  'gitlab.com',
  'gitlab.freedesktop.org',
  'gitlab.gnome.org',
  'gitlab.kitware.com',
  'gitlab.archlinux.org',
  'gitlab.postmarketos.org'
];

// RESTRICT_PATHS: 控制是否限制 GitHub 和 Docker 请求的路径。
// - 设置为 true：只允许 ALLOWED_PATHS 中定义的路径关键字。
// - 设置为 false：允许 ALLOWED_HOSTS 中的所有路径。
// 示例：const RESTRICT_PATHS = true;
const RESTRICT_PATHS = false;

// ALLOWED_PATHS: 定义 GitHub 和 Docker 的允许路径关键字。
// - 添加新关键字：加入数组，如 'user-id-3' 或 'my-repo'。
// - 用于匹配请求路径（如 'library' 用于 Docker Hub 官方镜像）。
// - 路径检查对大小写不敏感，仅当 RESTRICT_PATHS = true 时生效。
// 示例：const ALLOWED_PATHS = ['library', 'my-user', 'my-repo'];
const ALLOWED_PATHS = [
  'library',   // Docker Hub 官方镜像仓库的命名空间
  'user-id-1',
  'user-id-2',
];

// 用户配置区域结束 =================================

// 闪电 SVG 图标（Base64 编码）
const LIGHTNING_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
</svg>`;

// 首页 HTML
const HOMEPAGE_HTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cloudflare 加速</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(LIGHTNING_SVG)}">
  <script>
    (function () {
      try {
        var stored = localStorage.getItem('theme');
        var theme = stored || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', theme);
      } catch (e) {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    })();
  </script>
  <style>
    :root {
      color-scheme: light dark;
      --accent: #0071e3;
      --accent-active: #0059b3;
      --accent-soft: rgba(0, 113, 227, 0.15);
      --text-primary: #1d1d1f;
      --text-secondary: #6e6e73;
      --surface-glass: rgba(255, 255, 255, 0.72);
      --panel-bg: rgba(255, 255, 255, 0.86);
      --panel-border: rgba(0, 0, 0, 0.06);
      --border-soft: rgba(0, 0, 0, 0.08);
      --border-bright: rgba(255, 255, 255, 0.8);
      --shadow-color: rgba(15, 23, 42, 0.14);
      --chip-bg: rgba(0, 0, 0, 0.05);
      --chip-bg-hover: rgba(0, 0, 0, 0.08);
      --input-bg: #ffffff;
      --code-bg: rgba(0, 0, 0, 0.04);
      --success: #1fa557;
      --error: #e0342a;
    }

    html[data-theme="dark"] {
      --text-primary: #f5f5f7;
      --text-secondary: #a1a1a6;
      --surface-glass: rgba(28, 28, 32, 0.68);
      --panel-bg: rgba(255, 255, 255, 0.06);
      --panel-border: rgba(255, 255, 255, 0.08);
      --border-soft: rgba(255, 255, 255, 0.1);
      --border-bright: rgba(255, 255, 255, 0.16);
      --shadow-color: rgba(0, 0, 0, 0.55);
      --chip-bg: rgba(255, 255, 255, 0.08);
      --chip-bg-hover: rgba(255, 255, 255, 0.14);
      --input-bg: rgba(255, 255, 255, 0.08);
      --code-bg: rgba(255, 255, 255, 0.06);
      --success: #32d74b;
      --error: #ff453a;
    }

    * {
      box-sizing: border-box;
    }

    html {
      background:
        radial-gradient(1100px 760px at 12% -12%, rgba(10, 132, 255, 0.16), transparent 60%),
        radial-gradient(900px 680px at 108% 8%, rgba(175, 82, 222, 0.12), transparent 55%),
        linear-gradient(180deg, #eef1f6, #e3e7ee);
      min-height: 100%;
    }

    html[data-theme="dark"] {
      background:
        radial-gradient(1100px 760px at 12% -12%, rgba(10, 132, 255, 0.22), transparent 60%),
        radial-gradient(900px 680px at 108% 8%, rgba(94, 92, 230, 0.18), transparent 55%),
        linear-gradient(180deg, #000000, #1c1c1e);
    }

    body {
      min-height: 100vh;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", "Microsoft YaHei", Arial, sans-serif;
      color: var(--text-primary);
      -webkit-font-smoothing: antialiased;
    }

    .theme-toggle {
      position: fixed;
      top: 1.25rem;
      right: 1.25rem;
      width: 2.5rem;
      height: 2.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      border: 1px solid var(--border-soft);
      background: var(--surface-glass);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      font-size: 1.1rem;
      cursor: pointer;
      box-shadow: 0 4px 14px var(--shadow-color);
      transition: transform 100ms ease-out;
    }
    .theme-toggle:active {
      transform: scale(0.92);
    }

    @keyframes shell-in {
      from {
        opacity: 0;
        transform: translateY(10px) scale(0.98);
        backdrop-filter: blur(0px) saturate(100%);
        -webkit-backdrop-filter: blur(0px) saturate(100%);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
        backdrop-filter: blur(28px) saturate(180%);
        -webkit-backdrop-filter: blur(28px) saturate(180%);
      }
    }

    .shell {
      width: 100%;
      max-width: 720px;
      padding: 2.25rem;
      border-radius: 28px;
      background: var(--surface-glass);
      backdrop-filter: blur(28px) saturate(180%);
      -webkit-backdrop-filter: blur(28px) saturate(180%);
      border: 1px solid var(--border-soft);
      border-top-color: var(--border-bright);
      box-shadow: 0 24px 70px var(--shadow-color);
      animation: shell-in 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    h1 {
      font-size: clamp(1.6rem, 4vw, 2.1rem);
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.15;
      text-align: center;
      margin: 0 0 2rem;
    }

    .panel {
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 18px;
      padding: 1.5rem;
      transition: transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 200ms ease, border-color 200ms ease;
    }
    .panel + .panel {
      margin-top: 1.25rem;
    }
    @media (hover: hover) {
      .panel:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 26px var(--shadow-color);
        border-color: var(--border-bright);
      }
    }

    h2 {
      font-size: 1.05rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      margin: 0 0 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .panel p {
      margin: 0 0 1rem;
      font-size: 0.9rem;
      line-height: 1.6;
      color: var(--text-secondary);
    }

    .row {
      display: flex;
      gap: 0.6rem;
    }

    input[type="text"] {
      flex: 1;
      min-width: 0;
      font: inherit;
      font-size: 0.92rem;
      padding: 0.7rem 0.9rem;
      border-radius: 12px;
      border: 1px solid var(--border-soft);
      background: var(--input-bg);
      color: var(--text-primary);
      outline: none;
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }
    input[type="text"]::placeholder {
      color: var(--text-secondary);
    }
    input[type="text"]:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 4px var(--accent-soft);
    }

    button {
      font: inherit;
      border: none;
      cursor: pointer;
      border-radius: 12px;
    }
    button:focus-visible {
      outline: none;
      box-shadow: 0 0 0 4px var(--accent-soft);
    }
    .theme-toggle:focus-visible {
      box-shadow: 0 4px 14px var(--shadow-color), 0 0 0 4px var(--accent-soft);
    }

    .btn-primary {
      flex-shrink: 0;
      background: var(--accent);
      color: #ffffff;
      font-size: 0.9rem;
      font-weight: 600;
      padding: 0.7rem 1.25rem;
      transition: transform 100ms ease-out, background-color 150ms ease;
    }
    @media (hover: hover) {
      .btn-primary:hover {
        background: var(--accent-active);
      }
    }
    .btn-primary:active {
      transform: scale(0.97);
      background: var(--accent-active);
    }

    .btn-chip {
      flex: 1;
      background: var(--chip-bg);
      color: var(--text-primary);
      font-size: 0.85rem;
      font-weight: 500;
      padding: 0.55rem 0.9rem;
      transition: transform 100ms ease-out, background-color 150ms ease;
    }
    @media (hover: hover) {
      .btn-chip:hover {
        background: var(--chip-bg-hover);
      }
    }
    .btn-chip:active {
      transform: scale(0.96);
      background: var(--chip-bg-hover);
    }

    .result-text {
      margin: 0.9rem 0 0;
      padding: 0.75rem 0.9rem;
      border-radius: 10px;
      background: var(--code-bg);
      color: var(--success);
      font: 0.85rem/1.5 ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      word-break: break-all;
      overflow-wrap: break-word;
    }

    .btn-row {
      display: flex;
      gap: 0.6rem;
      margin-top: 0.75rem;
    }

    .hidden {
      display: none !important;
    }

    footer {
      margin-top: 1.75rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.65rem;
      text-align: center;
      font-size: 0.8rem;
      color: var(--text-secondary);
    }
    .footer-links {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1.25rem;
      flex-wrap: wrap;
    }
    footer a {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--text-secondary);
      text-decoration: none;
      font-weight: 500;
      transition: color 150ms ease;
    }
    @media (hover: hover) {
      footer a:hover {
        color: var(--accent);
      }
    }
    footer a svg {
      width: 1rem;
      height: 1rem;
      fill: currentColor;
      flex-shrink: 0;
    }

    .toast {
      position: fixed;
      bottom: 1.75rem;
      left: 50%;
      transform: translateX(-50%) translateY(12px) scale(0.96);
      background: var(--success);
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 12px;
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      box-shadow: 0 12px 30px var(--shadow-color);
      opacity: 0;
      font-size: 0.9rem;
      max-width: 90%;
      text-align: center;
      pointer-events: none;
      transition: transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 200ms ease;
    }
    .toast.error {
      background: var(--error);
    }
    .toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0) scale(1);
    }

    @media (max-width: 640px) {
      body { padding: 1rem; }
      .shell { padding: 1.25rem; border-radius: 22px; }
      .panel { padding: 1.1rem; }
      h1 { font-size: 1.4rem; margin-bottom: 1.25rem; }
      h2 { font-size: 1rem; }
      .row { flex-direction: column; }
      .btn-primary { width: 100%; }
      .result-text { font-size: 0.8rem; }
      footer { font-size: 0.75rem; }
    }

    @media (prefers-reduced-motion: reduce) {
      * {
        transition-duration: 0.01ms !important;
        animation-duration: 0.01ms !important;
      }
      .toast {
        transform: translateX(-50%) !important;
      }
      .theme-toggle:active,
      .btn-primary:active,
      .btn-chip:active {
        transform: none !important;
      }
    }

    @media (prefers-reduced-transparency: reduce) {
      .shell, .theme-toggle, .toast {
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
      }
      .shell {
        background: var(--panel-bg);
      }
    }

    @media (prefers-contrast: more) {
      .shell, .theme-toggle, .toast {
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
      }
      .shell {
        background: Canvas;
        border: 1px solid currentColor;
      }
    }
  </style>
</head>
<body>
  <button onclick="toggleTheme()" class="theme-toggle" aria-label="切换主题">
    <span class="sun">☀️</span>
    <span class="moon hidden">🌙</span>
  </button>
  <div class="shell">
    <h1>Cloudflare 加速下载</h1>

    <!-- GitHub 链接转换 -->
    <div class="panel">
      <h2>⚡ GitHub 文件加速 / Git Clone</h2>
      <p>输入 GitHub 文件链接获取加速链接；输入以 .git 结尾的仓库地址则自动生成 git clone 加速命令。</p>
      <div class="row">
        <input
          id="github-url"
          type="text"
          placeholder="请输入 GitHub 文件链接或 .git 仓库地址，例如：https://github.com/user/repo/releases/..."
        >
        <button id="github-submit-btn" class="btn-primary" onclick="convertGithubUrl()">获取加速链接</button>
      </div>
      <p id="github-result" class="result-text hidden"></p>
      <div id="github-buttons" class="btn-row hidden">
        <button class="btn-chip" onclick="copyGithubUrl()">📋 复制</button>
        <button class="btn-chip" onclick="openGithubUrl()">🔗 打开链接</button>
      </div>
    </div>

    <!-- Docker 镜像加速 -->
    <div class="panel">
      <h2>🐳 Docker 镜像加速</h2>
      <p>输入原镜像地址（如 hello-world 或 ghcr.io/user/repo），获取加速拉取命令。</p>
      <div class="row">
        <input
          id="docker-image"
          type="text"
          placeholder="请输入镜像地址，例如：hello-world 或 ghcr.io/user/repo"
        >
        <button class="btn-primary" onclick="convertDockerImage()">获取加速命令</button>
      </div>
      <p id="docker-result" class="result-text hidden"></p>
      <div id="docker-buttons" class="btn-row hidden">
        <button class="btn-chip" onclick="copyDockerCommand()">📋 复制命令</button>
      </div>
    </div>

    <footer>
      <div class="footer-links">
        <a href="https://github.com/keleyaa/Cloudflare-Accel" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
          <span>GitHub 仓库</span>
        </a>
        <a href="https://sub.ml1.one" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1 1 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4 4 0 0 1-.128-1.287z"/><path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243L6.586 4.672z"/></svg>
          <span>订阅转换服务</span>
        </a>
      </div>
      <span>Powered by Cloudflare Workers</span>
    </footer>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    // 动态获取当前域名
    const currentOrigin = window.location.origin;
    const currentHost = window.location.host;

    // 主题切换
    function applyThemeIcon(theme) {
      const sun = document.querySelector('.sun');
      const moon = document.querySelector('.moon');
      if (theme === 'dark') {
        sun.classList.add('hidden');
        moon.classList.remove('hidden');
      } else {
        moon.classList.add('hidden');
        sun.classList.remove('hidden');
      }
    }

    function toggleTheme() {
      const root = document.documentElement;
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try {
        localStorage.setItem('theme', next);
      } catch (e) {}
      applyThemeIcon(next);
    }

    // 初始化主题图标（data-theme 已由 head 内联脚本在首次渲染前设置，避免闪烁）
    applyThemeIcon(document.documentElement.getAttribute('data-theme'));

    // 显示弹窗提示
    let toastTimer = null;
    function showToast(message, isError = false) {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.classList.toggle('error', isError);
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }

    // 复制文本的通用函数
    function copyToClipboard(text) {
      // 尝试使用 navigator.clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text).catch(err => {
          console.error('Clipboard API failed:', err);
          return false;
        });
      }
      // 后备方案：使用 document.execCommand
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        return successful ? Promise.resolve() : Promise.reject(new Error('Copy command failed'));
      } catch (err) {
        document.body.removeChild(textarea);
        return Promise.reject(err);
      }
    }

    // GitHub 链接转换
    let githubAcceleratedUrl = '';
    let githubIsGitMode = false;
    function convertGithubUrl() {
      const input = document.getElementById('github-url').value.trim();
      const result = document.getElementById('github-result');
      const buttons = document.getElementById('github-buttons');
      const submitBtn = document.getElementById('github-submit-btn');
      const copyBtn = buttons.children[0];
      const openBtn = buttons.children[1];
      if (!input) {
        showToast('请输入有效的链接', true);
        result.classList.add('hidden');
        buttons.classList.add('hidden');
        return;
      }
      if (!input.startsWith('https://')) {
        showToast('链接必须以 https:// 开头', true);
        result.classList.add('hidden');
        buttons.classList.add('hidden');
        return;
      }

      // 检测是否以 .git 结尾，如果是则输出 git clone 指令
      if (input.endsWith('.git')) {
        githubIsGitMode = true;
        submitBtn.textContent = '获取加速命令';
        const domainPath = input.substring(8); // 去掉 https://
        const proxyUrl =  currentOrigin + '/https://' + domainPath;
        githubAcceleratedUrl = 'git clone ' + proxyUrl;
        result.textContent = '加速命令: ' + githubAcceleratedUrl;
        result.classList.remove('hidden');
        buttons.classList.remove('hidden');
        copyBtn.textContent = '📋 复制命令';
        // .git 模式隐藏"打开链接"按钮
        if (openBtn) openBtn.classList.add('hidden');
        copyToClipboard(githubAcceleratedUrl).then(() => {
          showToast('已复制到剪贴板');
        }).catch(err => {
          showToast('复制失败: ' + err.message, true);
        });
        return;
      }

      githubIsGitMode = false;
      submitBtn.textContent = '获取加速链接';
      // 保持现有格式：域名/https://原始链接
      githubAcceleratedUrl = currentOrigin + '/https://' + input.substring(8);
      result.textContent = '加速链接: ' + githubAcceleratedUrl;
      result.classList.remove('hidden');
      buttons.classList.remove('hidden');
      copyBtn.textContent = '📋 复制链接';
      // 正常模式显示"打开链接"按钮
      if (openBtn) openBtn.classList.remove('hidden');
      copyToClipboard(githubAcceleratedUrl).then(() => {
        showToast('已复制到剪贴板');
      }).catch(err => {
        showToast('复制失败: ' + err.message, true);
      });
    }

    function copyGithubUrl() {
      copyToClipboard(githubAcceleratedUrl).then(() => {
        showToast('已复制到剪贴板');
      }).catch(err => {
        showToast('复制失败: ' + err.message, true);
      });
    }

    function openGithubUrl() {
      if (!githubIsGitMode) {
        window.open(githubAcceleratedUrl, '_blank');
      }
    }

    // Docker 镜像转换
    let dockerCommand = '';
    function convertDockerImage() {
      const input = document.getElementById('docker-image').value.trim();
      const result = document.getElementById('docker-result');
      const buttons = document.getElementById('docker-buttons');
      if (!input) {
        showToast('请输入有效的镜像地址', true);
        result.classList.add('hidden');
        buttons.classList.add('hidden');
        return;
      }
      dockerCommand = 'docker pull ' + currentHost + '/' + input;
      result.textContent = '加速命令: ' + dockerCommand;
      result.classList.remove('hidden');
      buttons.classList.remove('hidden');
      copyToClipboard(dockerCommand).then(() => {
        showToast('已复制到剪贴板');
      }).catch(err => {
        showToast('复制失败: ' + err.message, true);
      });
    }

    function copyDockerCommand() {
      copyToClipboard(dockerCommand).then(() => {
        showToast('已手动复制到剪贴板');
      }).catch(err => {
        showToast('手动复制失败: ' + err.message, true);
      });
    }
  </script>
</body>
</html>
`;

async function handleToken(realm, service, scope) {
  const tokenUrl = `${realm}?service=${service}&scope=${scope}`;
  console.log(`Fetching token from: ${tokenUrl}`);
  try {
    const tokenResponse = await fetch(tokenUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!tokenResponse.ok) {
      console.log(`Token request failed: ${tokenResponse.status} ${tokenResponse.statusText}`);
      return null;
    }
    const tokenData = await tokenResponse.json();
    const token = tokenData.token || tokenData.access_token;
    if (!token) {
      console.log('No token found in response');
      return null;
    }
    console.log('Token acquired successfully');
    return token;
  } catch (error) {
    console.log(`Error fetching token: ${error.message}`);
    return null;
  }
}

function isAmazonS3(url) {
  try {
    return new URL(url).hostname.includes('amazonaws.com');
  } catch {
    return false;
  }
}

// 计算请求体的 SHA256 哈希值
async function calculateSHA256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 获取空请求体的 SHA256 哈希值
function getEmptyBodySHA256() {
  return 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
}

// 检测是否为 Git smart-http 协议请求
function isGitRequest(request, targetDomain) {
  // 检查 User-Agent 是否包含 git/
  const ua = request.headers.get('User-Agent') || '';
  if (ua.toLowerCase().includes('git/')) {
    return true;
  }
  // 检查目标域名是否为 Git 托管平台
  const gitDomains = ['github.com', 'api.github.com', 'raw.githubusercontent.com', 'gist.github.com', 'gist.githubusercontent.com', 'gitlab.com', 'gitlab.freedesktop.org', 'gitlab.gnome.org', 'gitlab.kitware.com', 'gitlab.archlinux.org', 'gitlab.postmarketos.org'];
  if (gitDomains.includes(targetDomain)) {
    // 检查路径是否包含 Git 协议特征
    const url = new URL(request.url);
    const path = url.pathname;
    // Git smart-http 使用 /info/refs?service=git-upload-pack 或 /git-upload-pack
    if (path.includes('/info/refs') || path.includes('/git-upload-pack') || path.includes('/git-receive-pack')) {
      return true;
    }
    // 路径包含 .git 也可能是 Git 请求（如 /user/repo.git/...）
    if (path.includes('.git')) {
      return true;
    }
  }
  return false;
}

// 为 Git 请求构建正确的代理请求头
function buildGitHeaders(request, targetDomain) {
  const headers = new Headers(request.headers);

  // 设置正确的 Host
  headers.set('Host', targetDomain);

  // 删除可能干扰 Git 协议的 Cloudflare 特定头部
  headers.delete('CF-Connecting-IP');
  headers.delete('CF-IPCountry');
  headers.delete('CF-Ray');
  headers.delete('CF-Visitor');
  headers.delete('CF-Worker');
  headers.delete('X-Forwarded-For');
  headers.delete('X-Real-IP');
  headers.delete('X-Forwarded-Proto');
  headers.delete('X-Forwarded-Host');

  // 删除 AWS S3 相关头部（不相关）
  headers.delete('x-amz-content-sha256');
  headers.delete('x-amz-date');
  headers.delete('x-amz-security-token');
  headers.delete('x-amz-user-agent');

  return headers;
}

function createErrorResponse(request, status, code, message, extraHeaders = {}) {
  const acceptsJson = request.headers.get('Accept')?.includes('application/json');
  const body = acceptsJson
    ? JSON.stringify({ error: { code, message } })
    : `${code}: ${message}\n`;

  return new Response(body, {
    status,
    headers: {
      'Content-Type': acceptsJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      ...extraHeaders
    }
  });
}

function applyCachePolicy(response, request, targetDomain, targetPath, isDockerRequest, isV2Request, v2RequestType, v2RequestTag) {
  if (request.method !== 'GET' || request.headers.has('Authorization') || request.headers.has('Range') || response.status !== 200) {
    return;
  }

  let ttl = 0;
  if (isDockerRequest && isV2Request && v2RequestType === 'manifests') {
    ttl = v2RequestTag?.startsWith('sha256:') ? 3600 : 300;
  }

  if (ttl) {
    response.headers.set('Cache-Control', `public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=60`);
    response.headers.set('CDN-Cache-Control', `max-age=${ttl}, stale-while-revalidate=60`);
  }
}

async function handleRequest(request, redirectCount = 0) {
  const MAX_REDIRECTS = 5; // 最大重定向次数
  const url = new URL(request.url);
  let path = url.pathname;

  // 记录请求信息
  console.log(`Request: ${request.method} ${path}`);

  // 首页路由
  if (path === '/' || path === '') {
    return new Response(HOMEPAGE_HTML, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // 处理 Docker V2 API 或 GitHub 代理请求
  let isV2Request = false;
  let v2RequestType = null; // 'manifests' or 'blobs'
  let v2RequestTag = null;  // tag or digest
  if (path.startsWith('/v2/')) {
    isV2Request = true;
    path = path.replace('/v2/', '');

    // 解析 V2 API 请求类型和标签/摘要
    const pathSegments = path.split('/').filter(part => part);
    if (pathSegments.length >= 3) {
      // 格式如: nginx/manifests/latest 或 nginx/blobs/sha256:xxx
      v2RequestType = pathSegments[pathSegments.length - 2];
      v2RequestTag = pathSegments[pathSegments.length - 1];
      // 提取镜像名称部分（去掉 manifests/tag 或 blobs/digest 部分）
      path = pathSegments.slice(0, pathSegments.length - 2).join('/');
    }
  }

  // 提取目标域名和路径
  const pathParts = path.split('/').filter(part => part);
  if (pathParts.length < 1) {
    return createErrorResponse(request, 400, 'INVALID_REQUEST', 'Target domain or path is required.');
  }

  let targetDomain, targetPath, isDockerRequest = false;

  // 检查路径是否以 https:// 或 http:// 开头
  // 注意：需要包含原始请求的查询参数（如 ?service=git-upload-pack），否则会丢失
  const fullPath = (path.startsWith('/') ? path.substring(1) : path) + url.search;

  if (fullPath.startsWith('https://') || fullPath.startsWith('http://')) {
    // 处理 /https://domain.com/... 或 /http://domain.com/... 格式
    const urlObj = new URL(fullPath);
    targetDomain = urlObj.hostname;
    targetPath = urlObj.pathname.substring(1) + urlObj.search; // 移除开头的斜杠

    // 检查是否为 Docker 请求
    isDockerRequest = ['quay.io', 'gcr.io', 'k8s.gcr.io', 'registry.k8s.io', 'ghcr.io', 'docker.cloudsmith.io', 'registry-1.docker.io', 'docker.io'].includes(targetDomain);

    // 处理 docker.io 域名，转换为 registry-1.docker.io
    if (targetDomain === 'docker.io') {
      targetDomain = 'registry-1.docker.io';
    }


  } else {
    // 处理 Docker 镜像路径的多种格式
    if (pathParts[0] === 'docker.io') {
      // 处理 docker.io/library/nginx 或 docker.io/amilys/embyserver 格式
      isDockerRequest = true;
      targetDomain = 'registry-1.docker.io';

      if (pathParts.length === 2) {
        // 处理 docker.io/nginx 格式，添加 library 命名空间
        targetPath = `library/${pathParts[1]}`;
      } else {
        // 处理 docker.io/amilys/embyserver 或 docker.io/library/nginx 格式
        targetPath = pathParts.slice(1).join('/');
      }
    } else if (ALLOWED_HOSTS.includes(pathParts[0])) {
      // Docker 镜像仓库（如 ghcr.io）或 GitHub 域名（如 github.com）
      targetDomain = pathParts[0];
      targetPath = pathParts.slice(1).join('/') + url.search;
      isDockerRequest = ['quay.io', 'gcr.io', 'k8s.gcr.io', 'registry.k8s.io', 'ghcr.io', 'docker.cloudsmith.io', 'registry-1.docker.io'].includes(targetDomain);
    } else if (pathParts.length >= 1 && pathParts[0] === 'library') {
      // 处理 library/nginx 格式
      isDockerRequest = true;
      targetDomain = 'registry-1.docker.io';
      targetPath = pathParts.join('/');
    } else if (pathParts.length >= 2) {
      // 处理 amilys/embyserver 格式（带命名空间但不是 library）
      isDockerRequest = true;
      targetDomain = 'registry-1.docker.io';
      targetPath = pathParts.join('/');
    } else {
      // 处理单个镜像名称，如 nginx
      isDockerRequest = true;
      targetDomain = 'registry-1.docker.io';
      targetPath = `library/${pathParts.join('/')}`;
    }
  }

  // 默认白名单检查：只允许 ALLOWED_HOSTS 中的域名
  if (!ALLOWED_HOSTS.includes(targetDomain)) {
    console.log(`Blocked: Domain ${targetDomain} not in allowed list`);
    return createErrorResponse(request, 400, 'INVALID_TARGET_DOMAIN', 'The target domain is not allowed.');
  }

  // 路径白名单检查（仅当 RESTRICT_PATHS = true 时）
  if (RESTRICT_PATHS) {
    const checkPath = isDockerRequest ? targetPath : path;
    console.log(`Checking whitelist against path: ${checkPath}`);
    const isPathAllowed = ALLOWED_PATHS.some(pathString =>
      checkPath.toLowerCase().includes(pathString.toLowerCase())
    );
    if (!isPathAllowed) {
      console.log(`Blocked: Path ${checkPath} not in allowed paths`);
      return createErrorResponse(request, 403, 'PATH_NOT_ALLOWED', 'The target path is not allowed.');
    }
  }

  // 构建目标 URL
  let targetUrl;
  if (isDockerRequest) {
    if (isV2Request && v2RequestType && v2RequestTag) {
      // 重构 V2 API URL
      targetUrl = `https://${targetDomain}/v2/${targetPath}/${v2RequestType}/${v2RequestTag}`;
    } else {
      targetUrl = `https://${targetDomain}/${isV2Request ? 'v2/' : ''}${targetPath}`;
    }
  } else {
    targetUrl = `https://${targetDomain}/${targetPath}`;
  }

  // 检测是否为 Git smart-http 请求
  const isGit = isGitRequest(request, targetDomain);

  let newRequestHeaders;
  if (isGit) {
    // Git 请求：使用白名单方式保留关键头部，避免 Cloudflare 添加的额外头部干扰 Git 协议
    newRequestHeaders = buildGitHeaders(request, targetDomain);
  } else {
    newRequestHeaders = new Headers(request.headers);
    newRequestHeaders.set('Host', targetDomain);
    newRequestHeaders.delete('x-amz-content-sha256');
    newRequestHeaders.delete('x-amz-date');
    newRequestHeaders.delete('x-amz-security-token');
    newRequestHeaders.delete('x-amz-user-agent');

    if (isAmazonS3(targetUrl)) {
      newRequestHeaders.set('x-amz-content-sha256', getEmptyBodySHA256());
      newRequestHeaders.set('x-amz-date', new Date().toISOString().replace(/[-:T]/g, '').slice(0, -5) + 'Z');
    }
  }

  try {
    // Git 请求使用 follow 重定向，让 Cloudflare 自动跟随重定向
    // 非 Git 请求使用 manual 重定向以便拦截 307 并自己请求 S3
    const redirectMode = isGit ? 'follow' : 'manual';

    let response = await fetch(targetUrl, {
      method: request.method,
      headers: newRequestHeaders,
      body: request.body,
      redirect: redirectMode
    });
    console.log(`Initial response: ${response.status} ${response.statusText} [git=${isGit}]`);

    // 处理 Docker 认证挑战
    if (isDockerRequest && response.status === 401) {
      const wwwAuth = response.headers.get('WWW-Authenticate');
      if (wwwAuth) {
        const authMatch = wwwAuth.match(/Bearer realm="([^"]+)",service="([^"]*)",scope="([^"]*)"/);
        if (authMatch) {
          const [, realm, service, scope] = authMatch;
          console.log(`Auth challenge: realm=${realm}, service=${service || targetDomain}, scope=${scope}`);

          const token = await handleToken(realm, service || targetDomain, scope);
          if (token) {
            const authHeaders = new Headers(request.headers);
            authHeaders.set('Authorization', `Bearer ${token}`);
            authHeaders.set('Host', targetDomain);
            // 如果目标是 S3，添加必要的 x-amz 头；否则删除可能干扰的头部
            if (isAmazonS3(targetUrl)) {
              authHeaders.set('x-amz-content-sha256', getEmptyBodySHA256());
              authHeaders.set('x-amz-date', new Date().toISOString().replace(/[-:T]/g, '').slice(0, -5) + 'Z');
            } else {
              authHeaders.delete('x-amz-content-sha256');
              authHeaders.delete('x-amz-date');
              authHeaders.delete('x-amz-security-token');
              authHeaders.delete('x-amz-user-agent');
            }

            const authRequest = new Request(targetUrl, {
              method: request.method,
              headers: authHeaders,
              body: request.body,
              redirect: 'manual'
            });
            console.log('Retrying with token');
            response = await fetch(authRequest);
            console.log(`Token response: ${response.status} ${response.statusText}`);
          } else {
            console.log('No token acquired, falling back to anonymous request');
            const anonHeaders = new Headers(request.headers);
            anonHeaders.delete('Authorization');
            anonHeaders.set('Host', targetDomain);
            // 如果目标是 S3，添加必要的 x-amz 头；否则删除可能干扰的头部
            if (isAmazonS3(targetUrl)) {
              anonHeaders.set('x-amz-content-sha256', getEmptyBodySHA256());
              anonHeaders.set('x-amz-date', new Date().toISOString().replace(/[-:T]/g, '').slice(0, -5) + 'Z');
            } else {
              anonHeaders.delete('x-amz-content-sha256');
              anonHeaders.delete('x-amz-date');
              anonHeaders.delete('x-amz-security-token');
              anonHeaders.delete('x-amz-user-agent');
            }

            const anonRequest = new Request(targetUrl, {
              method: request.method,
              headers: anonHeaders,
              body: request.body,
              redirect: 'manual'
            });
            response = await fetch(anonRequest);
            console.log(`Anonymous response: ${response.status} ${response.statusText}`);
          }
        } else {
          console.log('Invalid WWW-Authenticate header');
        }
      } else {
        console.log('No WWW-Authenticate header in 401 response');
      }
    }

    // 处理 S3 重定向（Docker 镜像层）
    if (isDockerRequest && (response.status === 307 || response.status === 302)) {
      const redirectUrl = response.headers.get('Location');
      if (redirectUrl) {
        console.log(`Redirect detected: ${redirectUrl}`);
        const redirectHeaders = new Headers(request.headers);
        redirectHeaders.set('Host', new URL(redirectUrl).hostname);

        // 对于 S3 重定向，添加必要的 AWS 头
        if (isAmazonS3(redirectUrl)) {
          const EMPTY_BODY_SHA256 = getEmptyBodySHA256();
          redirectHeaders.set('x-amz-content-sha256', EMPTY_BODY_SHA256);
          redirectHeaders.set('x-amz-date', new Date().toISOString().replace(/[-:T]/g, '').slice(0, -5) + 'Z');
        }

        if (response.headers.get('Authorization')) {
          redirectHeaders.set('Authorization', response.headers.get('Authorization'));
        }

        const redirectRequest = new Request(redirectUrl, {
          method: request.method,
          headers: redirectHeaders,
          body: request.body,
          redirect: 'manual'
        });
        response = await fetch(redirectRequest);
        console.log(`Redirect response: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          console.log('Redirect request failed, returning original redirect response');
          return new Response(response.body, {
            status: response.status,
            headers: response.headers
          });
        }
      }
    }

    // 复制响应并添加 CORS 头
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');

    if (isDockerRequest) {
      newResponse.headers.set('Docker-Distribution-API-Version', 'registry/2.0');
      // 删除可能存在的重定向头，确保所有请求都通过Worker处理
      newResponse.headers.delete('Location');
    }

    applyCachePolicy(newResponse, request, targetDomain, targetPath, isDockerRequest, isV2Request, v2RequestType, v2RequestTag);

    // Git smart-http 特殊处理：
    // 1. 保留 Location 头（Git 需要处理重定向）
    // 2. 保留原始 Content-Type（如 application/x-git-upload-pack-advertisement）
    // 3. 保留 Transfer-Encoding（Git 需要 chunked 编码）
    if (isGit) {
      // Git 需要原始的响应头，不要删除 Location
      // 确保 Content-Type 不被修改
      const contentType = response.headers.get('Content-Type');
      if (contentType && contentType.includes('x-git-')) {
        // Git smart-http 响应，保持原样
        console.log(`Git smart-http response: ${response.status} ${contentType}`);
      }
    }

    return newResponse;
  } catch (error) {
    console.log(`Fetch error: ${error.message}`);
    return createErrorResponse(request, 502, 'UPSTREAM_REQUEST_FAILED', 'The upstream request failed.');
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 首页不计入配额；所有代理请求按客户端 IP 使用默认限额。
    if (url.pathname !== '/' && url.pathname !== '') {
      const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
      const { success } = await env.RATE_LIMITER.limit({ key: clientIp });
      if (!success) {
        return createErrorResponse(request, 429, 'RATE_LIMITED', 'Too many requests. Please try again later.', {
          'Retry-After': '60'
        });
      }
    }

    return handleRequest(request);
  }
};
