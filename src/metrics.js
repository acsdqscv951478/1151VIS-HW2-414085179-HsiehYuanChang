export const MONTHS = [
  { id: '11508', label: '115年8月' },
  { id: '11509', label: '115年9月' },
]

export const INDUSTRIES = ['電子', '金融', '其他']

export const COLORS = {
  電子: '#4e79a7',
  金融: '#f28e2b',
  其他: '#8d8d8d',
}

export function summarize(monthRows) {
  const total = monthRows.reduce((sum, row) => sum + row.households, 0)
  const top5 = [...monthRows]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 5)
    .reduce((sum, row) => sum + row.households, 0)
  const tsmc = monthRows.find(row => row.code === '2330')?.households ?? 0

  const byIndustry = INDUSTRIES.map(industry => {
    const list = monthRows.filter(row => row.industry === industry)
    const without = list.filter(row => row.code !== '2330')
    return {
      industry,
      count: list.length,
      countWithoutTsmc: without.length,
      value: list.reduce((sum, row) => sum + row.households, 0),
      withoutTsmc: without.reduce((sum, row) => sum + row.households, 0),
    }
  })

  return {
    total,
    top5,
    top5Share: total ? top5 / total : 0,
    tsmc,
    tsmcShare: total ? tsmc / total : 0,
    byIndustry,
  }
}

export function buildView(raw, { month, industry, hideTsmc }) {
  const monthRows = raw.filter(row => row.month === month)
  const otherId = month === '11509' ? '11508' : '11509'
  const otherByCode = new Map(
    raw.filter(row => row.month === otherId).map(row => [row.code, row]),
  )
  const summary = summarize(monthRows)
  const total = summary.total

  let rows = monthRows.map(row => {
    const other = otherByCode.get(row.code)
    const delta = month === '11509' && other ? row.households - other.households : null
    let status = 'both'
    if (!other) status = month === '11509' ? 'new' : 'dropped-next'
    return {
      ...row,
      share: total ? row.households / total : 0,
      delta,
      deltaPct: delta !== null && other.households ? delta / other.households : null,
      otherRank: other?.rank ?? null,
      status,
    }
  })

  if (industry !== '全部') rows = rows.filter(row => row.industry === industry)
  if (hideTsmc) rows = rows.filter(row => row.code !== '2330')
  rows.sort((a, b) => b.households - a.households || a.rank - b.rank)

  const august = raw.filter(row => row.month === '11508')
  const september = raw.filter(row => row.month === '11509')
  const augustCodes = new Set(august.map(row => row.code))
  const septemberCodes = new Set(september.map(row => row.code))

  const paired = september.flatMap(row => {
    const previous = august.find(item => item.code === row.code)
    if (!previous) return []
    return [{
      ...row,
      prevRank: previous.rank,
      prevHouseholds: previous.households,
      householdDiff: row.households - previous.households,
      rankGain: previous.rank - row.rank,
    }]
  })

  return {
    rows,
    summary,
    entered: september.filter(row => !augustCodes.has(row.code)),
    exited: august.filter(row => !septemberCodes.has(row.code)),
    gainers: paired.filter(row => row.householdDiff > 0).sort((a, b) => b.householdDiff - a.householdDiff).slice(0, 3),
    losers: paired.filter(row => row.householdDiff < 0).sort((a, b) => a.householdDiff - b.householdDiff).slice(0, 3),
    rankUpButFewer: paired
      .filter(row => row.rankGain > 0 && row.householdDiff < 0)
      .sort((a, b) => b.rankGain - a.rankGain),
    markTop5: industry === '全部' && !hideTsmc && rows.length > 0,
  }
}
