// UI 文案字典：zh 为默认语言（无前缀路由），en 挂 /en/ 前缀
export type Lang = 'zh' | 'en';

export const ui = {
  zh: {
    'nav.posts': '文章',
    'nav.projects': '项目',
    'nav.search': '搜索',
    'nav.about': '关于',

    'home.intro': '你好，我是',
    'home.links': 'ls ./links',
    'home.about': '关于我',
    'home.latest': '最新文章',
    'home.projects': '我的项目',
    'home.viewAll': '查看全部',
    'status.posts': (n: number) => `${n} 篇文章`,
    'status.tags': (n: number) => `${n} 个标签`,
    'status.up': (d: number) => `已运行 ${d} 天`,

    'posts.count': (n: number) => `共 ${n} 篇`,
    'projects.subtitle': '做过的东西，都在这里',
    'projects.featured': '精选项目',
    'projects.repos': 'GitHub 仓库',
    'projects.allOnGithub': '全部仓库',

    'post.min': (n: number) => `⏱️ 约 ${n} 分钟`,
    'post.updated': (d: string) => `✏️ 更新于 ${d}`,
    'post.toc': '目录',
    'post.comments': '评论',
    'post.prev': (t: string) => `← 较早：${t}`,
    'post.next': (t: string) => `较新：${t} →`,
    'post.noEnglish': '提示：这篇内容暂无英文版，以下为中文原文。',
    'post.older': '较早',
    'post.newer': '较新',

    'search.subtitle': '输入关键词，全文搜索所有内容',
    'search.loading': '索引加载中 …',
    'search.ready': '就绪。输入即可搜索。',
    'search.unavailable': '⚠️ 搜索索引不可用（索引在构建时生成，本地开发模式下不可用）。',
    'search.noResult': (q: string) => `没有找到与「${q}」相关的结果。`,
    'search.found': (n: number) => `找到 ${n} 条结果：`,
    'search.placeholder': '输入关键词 …',
    'search.typeDefault': '内容',

    'about.site': '关于本站',
    'about.status': '当前状态',
    'about.statusValue': '保持好奇，持续构建',
    'about.stack': '技术偏好',
    'about.stackValue': 'TypeScript / Python / Rust，喜欢简单直接的方案',
    'about.location': '坐标',
    'about.locationValue': '地球 · UTC+8',
    'about.contact': '联系方式',
    'about.builtWith': '使用 Astro 构建，部署在 Cloudflare Pages，全球 CDN 加速',
    'about.theme': '主题为手写的暗色终端风格，支持亮色切换，无任何跟踪脚本',
    'about.comments': '评论基于 GitHub Discussions（giscus），搜索由 Pagefind 在浏览器本地完成',
    'about.opensource': '源码开放，欢迎 Fork 后改造成你自己的博客',

    'tag.count': (n: number) => `${n} 篇`,
    'tag.back': '← 返回全部文章',

    'footer.subscribe': '订阅更新 —— 新文章发布时通知你',
    'footer.placeholder': 'you@example.com',
    'footer.subscribeBtn': '订阅',
    'footer.sending': '发送中 …',
    'footer.ok': '订阅成功！感谢关注。',
    'footer.duplicate': '这个邮箱已经订阅过啦。',
    'footer.invalid': '请输入有效的邮箱地址。',
    'footer.serverError': '服务端未配置 KV 存储（SUBSCRIBERS），请在 Cloudflare 后台绑定。',
    'footer.networkError': '网络错误，请稍后再试。',
    'footer.fallbackError': '订阅失败，请稍后再试。',
    'footer.copyright': (author: string, year: number) =>
      `© ${year} ${author} · Built with`,
    'footer.langName': 'EN',

    'giscus.notConfigured': '评论系统（giscus）尚未配置。在 src/consts.ts 中填入 GISCUS.repo / repoId / categoryId 即可启用 —— 配置方法见',
    'giscus.notConfiguredTail': '。',

    'theme.toggle': '切换主题',
  },

  en: {
    'nav.posts': 'Posts',
    'nav.projects': 'Projects',
    'nav.search': 'Search',
    'nav.about': 'About',

    'home.intro': "Hi, I'm",
    'home.links': 'ls ./links',
    'home.about': 'About me',
    'home.latest': 'Latest Posts',
    'home.projects': 'My Projects',
    'home.viewAll': 'View all',
    'status.posts': (n: number) => `${n} posts`,
    'status.tags': (n: number) => `${n} tags`,
    'status.up': (d: number) => `up ${d} days`,

    'posts.count': (n: number) => `${n} posts`,
    'projects.subtitle': 'Things I have built',
    'projects.featured': 'Featured Projects',
    'projects.repos': 'GitHub Repositories',
    'projects.allOnGithub': 'All repositories',

    'post.min': (n: number) => `⏱️ ${n} min read`,
    'post.updated': (d: string) => `✏️ Updated ${d}`,
    'post.toc': 'Contents',
    'post.comments': 'Comments',
    'post.prev': (t: string) => `← Older: ${t}`,
    'post.next': (t: string) => `Newer: ${t} →`,
    'post.noEnglish': 'Note: no English version yet — showing the original Chinese post.',
    'post.older': 'Older',
    'post.newer': 'Newer',

    'search.subtitle': 'Type to search everything on this site',
    'search.loading': 'Loading index …',
    'search.ready': 'Ready. Type to search.',
    'search.unavailable': '⚠️ Search index unavailable (generated at build time; not available in dev mode).',
    'search.noResult': (q: string) => `No results for "${q}".`,
    'search.found': (n: number) => `${n} result(s):`,
    'search.placeholder': 'Type keywords …',
    'search.typeDefault': 'Page',

    'about.site': 'About This Site',
    'about.status': 'Status',
    'about.statusValue': 'Curious and always building',
    'about.stack': 'Stack',
    'about.stackValue': 'TypeScript / Python / Rust — simple over clever',
    'about.location': 'Location',
    'about.locationValue': 'Earth · UTC+8',
    'about.contact': 'Contact',
    'about.builtWith': 'Built with Astro, deployed on Cloudflare Pages with a global CDN',
    'about.theme': 'Hand-crafted dark terminal theme with a light mode, zero tracking scripts',
    'about.comments': 'Comments powered by GitHub Discussions (giscus); search runs fully in your browser via Pagefind',
    'about.opensource': 'Source is open — fork it and make it yours',

    'tag.count': (n: number) => `${n} post(s)`,
    'tag.back': '← All posts',

    'footer.subscribe': 'Subscribe — get notified about new posts',
    'footer.placeholder': 'you@example.com',
    'footer.subscribeBtn': 'Subscribe',
    'footer.sending': 'Sending …',
    'footer.ok': 'Subscribed! Thanks for following.',
    'footer.duplicate': 'This email is already subscribed.',
    'footer.invalid': 'Please enter a valid email address.',
    'footer.serverError': 'KV storage (SUBSCRIBERS) not configured on the server.',
    'footer.networkError': 'Network error, please try again later.',
    'footer.fallbackError': 'Subscription failed, please try again later.',
    'footer.copyright': (author: string, year: number) =>
      `© ${year} ${author} · Built with`,
    'footer.langName': '中',

    'giscus.notConfigured': 'Comments (giscus) are not configured yet. Fill in GISCUS.repo / repoId / categoryId in src/consts.ts to enable — see',
    'giscus.notConfiguredTail': '.',

    'theme.toggle': 'Toggle theme',
  },
} as const;

export type UIKey = keyof (typeof ui)['zh'];

/** 取某语言文案；en 缺失的 key 回退 zh */
export function t(lang: Lang, key: UIKey): string {
  const dict = ui[lang] ?? ui.zh;
  const val = dict[key] ?? ui.zh[key];
  return typeof val === 'function' ? (val as never) : String(val);
}

/** 带参数的文案（函数型 key） */
export function tf(lang: Lang, key: UIKey, ...args: unknown[]): string {
  const dict = ui[lang] ?? ui.zh;
  const val = (dict[key] ?? ui.zh[key]) as (...a: unknown[]) => string;
  return val(...args);
}

export const SITE_I18N: Record<Lang, { tagline: string; description: string }> = {
  zh: {
    tagline: '星火不熄，代码不止',
    description: '一个开发者的个人博客：记录技术、项目与生活。',
  },
  en: {
    tagline: 'Code on, spark on.',
    description: "A developer's personal blog — code, projects, and life.",
  },
};
