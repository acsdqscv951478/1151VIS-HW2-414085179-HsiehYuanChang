<script setup>
import { onMounted, ref, watch } from 'vue'
import * as d3 from 'd3'
import { COLORS } from '../metrics.js'

const props = defineProps({
  rows: { type: Array, required: true },
  markTop5: { type: Boolean, default: false },
  monthId: { type: String, required: true },
  monthLabel: { type: String, required: true },
  animate: { type: Boolean, default: true },
})

const chartRef = ref(null)
const tip = ref(null)

const width = 760
const margin = { top: 8, right: 132, bottom: 36, left: 128 }
const format = d3.format(',')
const formatPct = d3.format('.1%')
const signed = d3.format('+,')
const signedPct = d3.format('+.1%')

let svg
let x
let y
let grid
let xAxisG
let yAxisG
let xLabel
let ready = false

function barText(row) {
  const count = format(row.households)
  if (row.status === 'new') return `${count}  新進`
  if (row.delta === null) return count
  return `${count}  ${signed(row.delta)}`
}

function showTip(event, row) {
  const lines = [
    `${row.industry} · ${props.monthLabel}第 ${row.rank} 名`,
    `交易戶數 ${format(row.households)}`,
    `占前 20 名 ${formatPct(row.share)}`,
  ]
  if (row.status === 'new') lines.push('8 月未進入前 20 名')
  else if (row.status === 'dropped-next') lines.push('9 月未進入前 20 名')
  else if (row.otherRank) {
    const which = props.monthId === '11509' ? '8' : '9'
    lines.push(`${which} 月為第 ${row.otherRank} 名`)
  }
  if (row.delta !== null) {
    lines.push(`較 8 月 ${signed(row.delta)} 戶（${signedPct(row.deltaPct)}）`)
  }

  tip.value = {
    name: row.name,
    code: row.code,
    lines,
    x: Math.min(event.clientX + 16, window.innerWidth - 260),
    y: Math.min(event.clientY + 16, window.innerHeight - 180),
  }
  svg.selectAll('rect.bar').attr('opacity', item => item.code === row.code ? 1 : 0.38)
}

function hideTip() {
  tip.value = null
  svg.selectAll('rect.bar').attr('opacity', 1)
}

function render(data, animate, markTop5) {
  const duration = animate ? 750 : 0
  const height = Math.max(260, margin.top + margin.bottom + Math.max(data.length, 1) * 30)
  const t = svg.transition().duration(duration).ease(d3.easeCubicOut)

  svg.attr('viewBox', [0, 0, width, height])
  x.range([margin.left, width - margin.right])
  y.range([margin.top, height - margin.bottom]).domain(data.map(row => row.code))
  x.domain([0, d3.max(data, row => row.households) || 1]).nice()

  const plotHeight = height - margin.top - margin.bottom
  grid.transition(t)
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(5).tickSize(-plotHeight).tickFormat(''))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('line').attr('stroke', '#ececec'))

  const bands = svg.select('.bands')
    .selectAll('rect')
    .data(markTop5 ? data.filter(row => row.rank <= 5) : [], row => row.code)
  bands.join(
    enter => enter.append('rect')
      .attr('x', margin.left)
      .attr('width', width - margin.left - margin.right)
      .attr('y', row => y(row.code))
      .attr('height', y.bandwidth())
      .attr('fill', '#eef3f8')
      .attr('opacity', 0)
      .call(enterSel => enterSel.transition(t).attr('opacity', 1)),
    update => update.call(updateSel => updateSel.transition(t)
      .attr('y', row => y(row.code))
      .attr('height', y.bandwidth())
      .attr('width', width - margin.left - margin.right)),
    exit => exit.call(exitSel => exitSel.transition(t).attr('opacity', 0).remove()),
  )

  svg.select('.bars')
    .selectAll('rect.bar')
    .data(data, row => row.code)
    .join(
      enter => enter.append('rect')
        .attr('class', 'bar')
        .attr('x', x(0))
        .attr('y', row => y(row.code))
        .attr('height', y.bandwidth())
        .attr('width', 0)
        .attr('fill', row => COLORS[row.industry])
        .attr('rx', 2)
        .call(enterSel => enterSel.transition(t)
          .attr('width', row => x(row.households) - x(0))),
      update => update.call(updateSel => updateSel.transition(t)
        .attr('y', row => y(row.code))
        .attr('height', y.bandwidth())
        .attr('width', row => x(row.households) - x(0))
        .attr('fill', row => COLORS[row.industry])),
      exit => exit.call(exitSel => exitSel.transition(t).attr('width', 0).attr('opacity', 0).remove()),
    )

  svg.select('.labels')
    .selectAll('text')
    .data(data, row => row.code)
    .join(
      enter => enter.append('text')
        .attr('x', x(0))
        .attr('y', row => y(row.code) + y.bandwidth() / 2)
        .attr('dy', '0.35em')
        .attr('opacity', 0)
        .text(barText)
        .call(enterSel => enterSel.transition(t)
          .attr('opacity', 1)
          .attr('x', row => x(row.households) + 6)
          .attr('y', row => y(row.code) + y.bandwidth() / 2)),
      update => update.call(updateSel => updateSel.transition(t)
        .attr('x', row => x(row.households) + 6)
        .attr('y', row => y(row.code) + y.bandwidth() / 2)
        .text(barText)),
      exit => exit.call(exitSel => exitSel.transition(t).attr('opacity', 0).remove()),
    )

  xAxisG.transition(t)
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(format))
  yAxisG.transition(t)
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).tickSizeOuter(0).tickFormat(code => {
      const row = data.find(item => item.code === code)
      return row ? `${row.rank}. ${row.name}` : ''
    }))
  xLabel.transition(t)
    .attr('x', (margin.left + width - margin.right) / 2)
    .attr('y', height - 6)

  svg.select('.hits')
    .selectAll('rect')
    .data(data, row => row.code)
    .join('rect')
    .attr('x', 0)
    .attr('width', width)
    .attr('y', row => y(row.code))
    .attr('height', y.bandwidth())
    .attr('fill', 'transparent')
    .on('mousemove', showTip)
}

onMounted(() => {
  svg = d3.select(chartRef.value).append('svg')
  x = d3.scaleLinear()
  y = d3.scaleBand().padding(0.18)
  grid = svg.append('g').attr('class', 'grid')
  svg.append('g').attr('class', 'bands')
  svg.append('g').attr('class', 'bars')
  svg.append('g').attr('class', 'labels')
  xAxisG = svg.append('g').attr('class', 'axis')
  yAxisG = svg.append('g').attr('class', 'axis')
  xLabel = svg.append('text').attr('class', 'x-label').attr('text-anchor', 'middle').text('交易戶數（戶）')
  svg.append('g').attr('class', 'hits')
  svg.on('mouseleave', hideTip)
  ready = true
  render(props.rows, false, props.markTop5)
})

watch(() => [props.rows, props.markTop5, props.animate], () => {
  if (!ready) return
  hideTip()
  render(props.rows, props.animate, props.markTop5)
})
</script>

<template>
  <div ref="chartRef" class="chart"></div>
  <div v-if="tip" class="tip" :style="{ left: `${tip.x}px`, top: `${tip.y}px` }">
    <strong>{{ tip.name }} {{ tip.code }}</strong>
    <p v-for="line in tip.lines" :key="line">{{ line }}</p>
  </div>
</template>

<style scoped>
.chart :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
  font-family: "Microsoft JhengHei", "Noto Sans TC", sans-serif;
}

.chart :deep(.axis text),
.chart :deep(.x-label),
.chart :deep(.labels text) {
  font-size: 12px;
  fill: #333;
}

.chart :deep(.axis path),
.chart :deep(.axis line) {
  stroke: #ccc;
}

.chart :deep(.labels text) {
  pointer-events: none;
}

.tip {
  position: fixed;
  z-index: 30;
  width: 230px;
  padding: 10px 12px;
  background: #1f2430;
  color: #fff;
  border-radius: 8px;
  pointer-events: none;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
}

.tip strong {
  display: block;
  margin-bottom: 4px;
  font-size: 15px;
}

.tip p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}
</style>
