export function summarizeLcov(text, ownsSource) {
  text = text.replaceAll('\r\n', '\n')
  const totals = { files: 0, lines: 0, coveredLines: 0, functions: 0, coveredFunctions: 0 }
  for (const record of text.split('end_of_record')) {
    const name = record
      .match(/^SF:(.+)$/m)?.[1]
      ?.trim()
      .replaceAll('\\', '/')
    if (!name || !ownsSource(name)) continue
    totals.files++
    const number = (key) => Number(record.match(new RegExp(`^${key}:(\\d+)$`, 'm'))?.[1] || 0)
    totals.lines += number('LF')
    totals.coveredLines += number('LH')
    totals.functions += number('FNF')
    totals.coveredFunctions += number('FNH')
  }
  if (!totals.files || !totals.lines)
    throw new Error('Coverage report has no owned production source records')
  return {
    ...totals,
    linePercent: Math.floor((totals.coveredLines / totals.lines) * 10000) / 100,
    functionPercent: totals.functions
      ? Math.floor((totals.coveredFunctions / totals.functions) * 10000) / 100
      : 100,
  }
}

export function checkBaseline(actual, baseline) {
  return ['linePercent', 'functionPercent', 'files'].filter((key) => actual[key] < baseline[key])
}
