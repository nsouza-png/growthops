/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')

const SOURCE_DIR =
  process.argv[2] ||
  'C:\\Users\\n.souza_g4educacao\\Documents\\G4OS GROWTH OPS FULL\\estudos\\analises-calls\\analises'

function walkJsonFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkJsonFiles(full, out)
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) out.push(full)
  }
  return out
}

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v)
}

function checkRange(name, score, errors) {
  if (score == null) return
  if (!isNum(score) || score < 0 || score > 5) {
    errors.push(`${name} fora do range 0..5: ${String(score)}`)
  }
}

function validateOne(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const errors = []
  let obj
  try {
    obj = JSON.parse(raw)
  } catch (err) {
    return { ok: false, filePath, errors: [`JSON inválido: ${String(err)}`] }
  }

  const analysis = obj.analysis || obj
  const block = analysis.scores || analysis.framework_scores || analysis
  const spiced = block.spiced || block.spiced_scores || {}
  const spin = block.spin || block.spin_scores || {}
  const challenger = block.challenger || block.challenger_scores || {}
  const behavior = block.behavior || block.behavior_signals || {}

  if (!analysis) errors.push('Sem bloco analysis')
  if (!Object.keys(spiced).length) errors.push('Sem bloco SPICED')
  if (!Object.keys(spin).length) errors.push('Sem bloco SPIN')
  if (!Object.keys(challenger).length) errors.push('Sem bloco Challenger')
  if (!Object.keys(behavior).length) errors.push('Sem bloco Behavior')

  const spicedTotal = spiced.total ?? spiced.spiced_total
  if (spicedTotal != null && (!isNum(spicedTotal) || spicedTotal < 0 || spicedTotal > 30)) {
    errors.push(`spiced_total fora do range 0..30: ${String(spicedTotal)}`)
  }

  checkRange('spiced_situation', spiced.situation ?? spiced.spiced_situation, errors)
  checkRange('spiced_pain', spiced.pain ?? spiced.spiced_pain, errors)
  checkRange('spiced_impact', spiced.impact ?? spiced.spiced_impact, errors)
  checkRange('spiced_critical_event', spiced.critical_event ?? spiced.spiced_critical_event, errors)
  checkRange('spiced_decision', spiced.decision ?? spiced.spiced_decision, errors)
  checkRange('spiced_delivery', spiced.delivery ?? spiced.spiced_delivery, errors)

  return { ok: errors.length === 0, filePath, errors }
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    throw new Error(`Diretório não encontrado: ${SOURCE_DIR}`)
  }
  const files = walkJsonFiles(SOURCE_DIR)
  if (!files.length) {
    throw new Error(`Nenhum JSON encontrado em: ${SOURCE_DIR}`)
  }

  const results = files.map(validateOne)
  const ok = results.filter((r) => r.ok)
  const bad = results.filter((r) => !r.ok)

  console.log(`Dataset: ${SOURCE_DIR}`)
  console.log(`Arquivos JSON: ${files.length}`)
  console.log(`Válidos: ${ok.length}`)
  console.log(`Com erro: ${bad.length}`)

  if (bad.length) {
    console.log('\nPrimeiros arquivos com erro:')
    for (const item of bad.slice(0, 20)) {
      console.log(`- ${path.relative(SOURCE_DIR, item.filePath)}`)
      for (const e of item.errors.slice(0, 6)) console.log(`  • ${e}`)
    }
    process.exitCode = 2
  }
}

main()
