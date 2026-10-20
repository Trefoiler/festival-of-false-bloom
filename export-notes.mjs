import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

const repo = path.dirname(fileURLToPath(import.meta.url))
const settings = JSON.parse(fs.readFileSync(path.join(repo, '.publish.local.json'), 'utf8'))
const source = path.resolve(settings.campaignFolder)
const destination = path.join(repo, 'content')
const prefix = 'Campaigns/Festival of False Bloom/'
const selected = ['Party Members.md', 'People & Groups.md', 'Current Threads.md']
function collect(folder, include) {
  for (const entry of fs.readdirSync(path.join(source, folder), { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const relative = `${folder}/${entry.name}`
    if (relative === 'Session Notes/Transcripts') continue
    if (entry.isDirectory()) collect(relative, include)
    else if (entry.isFile() && include(entry.name)) selected.push(relative)
  }
}
for (const folder of ['Character References', 'People & Groups', 'Session Notes']) collect(folder, name => name.endsWith('.md'))
collect('Attachments', () => true)
function resolveWiki(target) {
  target = target.replaceAll('\\', '/').replace(prefix, '')
  return selected.find(item => item === target || item === `${target}.md`) ??
    selected.find(item => path.posix.basename(item, '.md') === target || path.posix.basename(item) === target)
}
function exportPath(relative) {
  return relative === 'People & Groups.md' ? 'People & Groups/index.md' : relative
}
function relativeUrl(current, target, anchor = '') {
  // Quartz uses decodeURI, which leaves encoded ampersands unchanged before slugging.
  return path.posix.relative(path.posix.dirname(exportPath(current)), exportPath(target))
    .split('/').map(segment => encodeURIComponent(segment).replaceAll('%26', '&')).join('/') + anchor
}
function publicGordon(text) {
  text = text.replaceAll('\r\n', '\n')
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/)
  if (!frontmatter) throw new Error('Gordon stat frontmatter is missing; refusing to export tracker data.')
  const stats = parseYaml(frontmatter[1])
  const fixedKeys = new Set([
    'ac', 'hp_max', 'hit_dice_max', 'walk_speed', 'fly_speed',
    'force_strike_attack', 'force_strike_damage_bonus', 'dex_save',
    'stealth', 'perception', 'passive_perception',
  ])
  const fixed = key => {
    if (!fixedKeys.has(key) || !Number.isFinite(stats[key])) {
      throw new Error('Unknown or invalid public Gordon stat: ' + key)
    }
    return String(stats[key])
  }
  text = text.slice(frontmatter[0].length)
  const tracker = /^> \[!info\] Live tracker\n(?:>.*\n)*```meta-bind-button\n[\s\S]*?^```\n?/m
  if (!tracker.test(text)) throw new Error('Gordon tracker layout changed; review the public export filter.')
  text = text.replace(tracker,
    `> [!info] Quick stats\n> **AC:** ${fixed('ac')} · **Maximum HP:** ${fixed('hp_max')} · **Hit Dice:** ${fixed('hit_dice_max')}d4\n`)
  const maintenance = /^> \[!info\]- Edit stats & level-up scaling\n(?:>.*(?:\n|$))*/m
  if (!maintenance.test(text)) throw new Error('Gordon maintenance layout changed; review the public export filter.')
  text = text.replace(maintenance, '')
  text = text.replace(/`VIEW\[\{([a-z_]+)\}\]\[math\]`/g, (_, key) => fixed(key))
  text = text.replace(/^> \*\*Reaction tracker:\*\*.*\n/gm, '')
  text = text.replaceAll(' Turn off Reaction available above.', '')
  text = text.replaceAll(' Update current HP in the tracker.', '')
  text = text.replaceAll('; the tracker reset button does not change Hit Dice.', '.')
  if (/\b(?:INPUT|VIEW)\[|meta-bind-button|^temp_hp:|^reaction_available:/m.test(text)) {
    throw new Error('Obsidian tracker data or controls remain in the public Gordon export.')
  }
  return text.replace(/\n{3,}/g, '\n\n').trim() + '\n'
}
function clean(text, current) {
  if (current === 'Character References/Gordon.md') text = publicGordon(text)
  // Quartz renders the page title; keep the original H1 only in Obsidian.
  if (current.startsWith('Character References/')) text = text.replace(/^# [^\r\n]+\r?\n(?:\r?\n)?/, '')
  text = text.replace(/^\*\*Source:\*\*.*$/gm, '**Source:** Session notes and campaign handouts.')
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
      anchor.length ? `#${encodeURIComponent(anchor.join('#')).replaceAll('%26', '&')}` : '')
    return `${embed}[${label}](${url})`
  })
}
const outputs = new Map()
for (const relative of selected) {
  const input = path.join(source, relative)
  let data = relative.endsWith('.md') ? clean(fs.readFileSync(input, 'utf8'), relative) : fs.readFileSync(input)
  if (relative === 'People & Groups.md') data = '---\ncssclasses: [people-index]\n---\n' + data
  if (relative === 'Character References/index.md') data = '---\ntitle: Character References\ncssclasses: [character-index]\n---\n' + data
  outputs.set(exportPath(relative), data)
}
const sessions = selected.filter(item => item.startsWith('Session Notes/') && item.endsWith('.md'))
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
- **[[People & Groups]]:** People and groups the party knows about.
- **[[Party Members]]:** Players and characters.
- **[[Character References/index|Character References]]:** Individual play references and shopping lists.

## Latest session

${latest ? `[[${latest}|Read ${path.posix.basename(latest, '.md')}]]` : 'No sessions yet.'}

${section('Quick recap')}

## Where we stopped

${section('Where we stopped')}

## Session Notes

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
