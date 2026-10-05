import fs from 'node:fs'
import YAML from 'yaml'
const config = YAML.parse(fs.readFileSync('quartz.config.default.yaml', 'utf8'))
Object.assign(config.configuration, {
  pageTitle: 'Festival of False Bloom',
  analytics: null,
  baseUrl: 'trefoiler.github.io/festival-of-false-bloom',
  ignorePatterns: ['private', '.obsidian', 'Personal', 'Reference', 'Session Notes/Transcripts'],
})
config.configuration.theme.fontOrigin = 'local'
config.configuration.theme.typography = { header: 'Georgia', body: 'Arial', code: 'Consolas' }
Object.assign(config.configuration.theme.colors.lightMode, {
  light: '#faf7ef', secondary: '#9b4338', tertiary: '#647351',
})
const disabled = ['graph', 'og-image', 'quartz-fonts', 'content-meta', 'bases-page', 'canvas-page']
for (const plugin of config.plugins) {
  if (disabled.some(name => plugin.source === '@quartz-community/' + name)) plugin.enabled = false
  if (plugin.source === '@quartz-community/hard-line-breaks') plugin.enabled = true
  if (plugin.source === '@quartz-community/footer') plugin.options = { links: {} }
}
fs.writeFileSync('quartz.config.yaml', YAML.stringify(config))
console.log('Configured the campaign website.')
