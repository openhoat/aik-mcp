import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(
  defineConfig({
    title: 'aik-mcp',
    description: 'AI Knowledge — MCP Server',
    base: '/aik-mcp/',

    head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/aik-mcp/logo.svg' }]],

    themeConfig: {
      logo: '/logo.svg',

      nav: [
        { text: 'Get Started', link: '/guide/getting-started' },
        { text: 'Content Authoring', link: '/guide/content-authoring' },
        { text: 'MCP Tools', link: '/guide/tools' },
        { text: 'Architecture', link: '/guide/architecture' },
        { text: 'Configuration', link: '/guide/configuration' },
        { text: 'Contributing', link: '/guide/contributing' },
      ],

      sidebar: [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Content Authoring', link: '/guide/content-authoring' },
            { text: 'Architecture', link: '/guide/architecture' },
            { text: 'MCP Tools', link: '/guide/tools' },
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'Contributing', link: '/guide/contributing' },
          ],
        },
      ],

      socialLinks: [{ icon: 'github', link: 'https://github.com/openhoat/aik-mcp' }],

      footer: {
        message: 'Released under the MIT License.',
        copyright: 'Copyright © 2026 Olivier Penhoat',
      },

      editLink: {
        pattern: 'https://github.com/openhoat/aik-mcp/edit/main/docs/:path',
        text: 'Edit this page on GitHub',
      },

      search: {
        provider: 'local',
      },
    },
  })
)
