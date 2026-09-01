// 站点全局配置 —— 部署后请修改为你的真实信息
export const SITE = {
  title: 'Ember 余烬',
  tagline: '星火不熄，代码不止',
  description: '一个开发者的个人博客：记录技术、项目与生活。',
  // 部署后核对实际域名
  url: 'https://ember-space.pages.dev',
  author: 'Ember',
  social: {
    github: 'https://github.com/Ember1414',
    email: 'mailto:you@example.com',
  },
};

// giscus 评论配置：在 https://giscus.app 生成后填入。
// repoId / categoryId 留空时，文章页会显示配置提示而不是评论区。
export const GISCUS = {
  repo: 'Ember1414/ember_space',
  repoId: 'R_kgDOUKa2iQ',
  category: 'Announcements',
  categoryId: 'DIC_kwDOUKa2ic4DEoDC',
  mapping: 'pathname',
  reactionsEnabled: '1',
};
