import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = path.dirname(fileURLToPath(import.meta.url))
const settings = JSON.parse(fs.readFileSync(path.join(repo, '.publish.local.json'), 'utf8'))
const source = path.resolve(settings.campaignFolder)
const destination = path.join(repo, 'content')
const prefix = 'Campaigns/Festival of False Bloom/'
const selected = ['Party.md', 'People.md', 'Current Threads.md']
function collect(folder, include) {
  for (const entry of fs.readdirSync(path.join(source, folder), { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const relative = `${folder}/${entry.name}`
    if (relative === 'Sessions/Transcripts' || relative === 'Sessions/Template.md') continue
    if (entry.isDirectory()) collect(relative, include)
    else if (entry.isFile() && include(entry.name)) selected.push(relative)
  }
}
for (const folder of ['People', 'Sessions']) collect(folder, name => name.endsWith('.md'))
collect('Attachments', () => true)
function resolveWiki(target) {
  target = target.replaceAll('\\', '/').replace(prefix, '')
  return selected.find(item => item === target || item === `${target}.md`) ??
    selected.find(item => path.posix.basename(item, '.md') === target || path.posix.basename(item) === target)
}
function exportPath(relative) {
  return relative === 'People.md' ? 'People/index.md' : relative
}
function relativeUrl(current, target, anchor = '') {
  return path.posix.relative(path.posix.dirname(exportPath(current)), exportPath(target))
    .split('/').map(encodeURIComponent).join('/') + anchor
}
function clean(text, current) {
  text = text.replace(/^\*\*Source:\*\*.*$/gm, '**Source:** Session notes and campaign handouts.')
  text = text.replace(/^\*\*(Companion|Nathan's quick reference):\*\*.*\r?\n/gm, '')
  text = text.replace(/\s*·\s*\[\[(?:Campaigns\/Festival of False Bloom\/Reference\/)?Notes Guide(?:\|[^\]]+)?\]\]/g, '')
  // Moving a note to a folder landing page also changes its relative Markdown links.
  text = text.replace(/(!?\[[^\]\n]*\]\()([^\s)]+)(\))/g, (match, opening, url, closing) => {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(url)) return match
    const hash = url.indexOf('#')
    const target = hash < 0 ? url : url.slice(0, hash)
    const anchor = hash < 0 ? '' : url.slice(hash)
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(current), decodeURIComponent(target)))
    return selected.includes(resolved) ? opening + relativeUrl(current, resolved, anchor) + closing : match
  })
  return text.replace(/(!?)\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, embed, reference, alias) => {
    const [target, ...anchor] = reference.split('#')
    const resolved = resolveWiki(target)
    const label = alias || path.posix.basename(target)
    if (!resolved) return label
    const url = relativeUrl(current, resolved,
      anchor.length ? `#${encodeURIComponent(anchor.join('#'))}` : '')
    return `${embed}[${label}](${url})`
  })
}
const outputs = new Map()
for (const relative of selected) {
  const input = path.join(source, relative)
  let data = relative.endsWith('.md') ? clean(fs.readFileSync(input, 'utf8'), relative) : fs.readFileSync(input)
  if (relative === 'People.md') data = '---\ncssclasses: [people-index]\n---\n' + data
  outputs.set(exportPath(relative), data)
}
const sessions = selected.filter(item => item.startsWith('Sessions/') && item.endsWith('.md'))
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
const numbered = sessions.filter(item => /^Session \d+\b/.test(path.posix.basename(item)))
  .sort((a, b) => Number(path.posix.basename(a).match(/\d+/)[0]) - Number(path.posix.basename(b).match(/\d+/)[0]))
const latest = numbered.at(-1)
const text = latest ? fs.readFileSync(path.join(source, latest), 'utf8') : ''
const section = name => text.replaceAll('\r\n', '\n').split(`\n## ${name}\n`)[1]?.split('\n## ')[0]?.trim() || ''
const home = `# Festival of False Bloom

The campaign wiki from the party's perspective. NPC claims and party theories are identified in the notes.

## Campaign references

- **[[Current Threads]]:** Active quests, clues, and next steps.
- **[[People]]:** People and groups the party knows about.
- **[[Party]]:** Players and characters.

## Latest session

${latest ? `[[${latest}|Read ${path.posix.basename(latest, '.md')}]]` : 'No sessions yet.'}

${section('Quick recap')}

## Where we stopped

${section('Where we stopped')}

## Sessions

${sessions.map(item => `- [[${item}|${path.posix.basename(item, '.md')}]]`).join('\n')}
`
outputs.set('index.md', clean(home, 'index.md'))
const manifest = path.join(repo, '.campaign-export.json')
const previous = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, 'utf8')) : []
function safeTarget(relative) {
  const full = path.resolve(destination, relative)
  if (!full.startsWith(destination + path.sep)) throw new Error('Export path outside content: ' + relative)
  return full
}
for (const relative of previous) {
  const target = safeTarget(relative)
  if (!outputs.has(relative) && fs.existsSync(target)) fs.unlinkSync(target)
}
for (const [relative, data] of outputs) {
  const target = safeTarget(relative)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, data)
}
fs.writeFileSync(manifest, JSON.stringify([...outputs.keys()], null, 2))
console.log(`Exported ${outputs.size} campaign files. Vault files were not changed.`)
