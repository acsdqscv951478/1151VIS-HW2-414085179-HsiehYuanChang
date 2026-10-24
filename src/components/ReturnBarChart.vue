<script setup>
import { onMounted, ref, watch } from 'vue'
import * as d3 from 'd3'
import { COLORS } from '../metrics.js'

const props = defineProps({
  rows: { type: Array, required: true },
  animate: { type: Boolean, default: true },
})

const chartRef = ref(null)
const tip = ref(null)

const width = 980
const margin = { top: 8, right: 72, bottom: 36, left: 128 }
const formatPrice = d3.format(',')
const formatPct = d3.format('+.1%')

let svg
let x
let y
let grid
let xAxisG
let yAxisG
let zeroLine
let xLabel
let ready = false

function barX(row) {
  return row.priceReturn >= 0 ? x(0) : x(row.priceReturn)
}

function barWidth(row) {
  return Math.max(0, Math.abs(x(row.priceReturn) - x(0)))
}

function labelX(row) {
  return row.priceReturn >= 0 ? x(row.priceReturn) + 4 : x(row.priceReturn) - 4
}

function labelAnchor(row) {
  return row.priceReturn >= 0 ? 'start' : 'end'
}

function showTip(event, row) {
  tip.value = {
    name: row.name,
    code: row.code,
    lines: [
      `${row.industry} · 戶數第 ${row.rank} 名`,
      `股價報酬率 ${formatPct(row.priceReturn)}`,
      `${row.startDate} 收盤 ${formatPrice(row.startClose)}`,
      `${row.endDate} 收盤 ${formatPrice(row.endClose)}`,
    ],
    x: Math.min(event.clientX + 16, window.innerWidth - 260),
    y: Math.min(event.clientY + 16, window.innerHeight - 160),
  }
  svg.selectAll('rect.bar').attr('opacity', item => item.code === row.code ? 1 : 0.38)
}

function hideTip() {
  tip.value = null
  if (svg) svg.selectAll('rect.bar').attr('opacity', 1)
}

function render(data, animate) {
  const duration = animate ? 750 : 0
  const height = Math.max(260, margin.top + margin.bottom + Math.max(data.length, 1) * 30)
  const t = svg.transition().duration(duration).ease(d3.easeCubicOut)
  const min = Math.min(0, d3.min(data, row => row.priceReturn) ?? 0)
  const max = Math.max(0, d3.max(data, row => row.priceReturn) ?? 0)
  const pad = Math.max((max - min) * 0.18, 0.01)

  svg.attr('viewBox', [0, 0, width, height])
  x.range([margin.left, width - margin.right]).domain([min - pad, max + pad])
  y.range([margin.top, height - margin.bottom]).domain(data.map(row => row.code))

  const plotHeight = height - margin.top - margin.bottom
  grid.transition(t)
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(6).tickSize(-plotHeight).tickFormat(''))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('line').attr('stroke', '#ececec'))

  zeroLine.transition(t)
    .attr('x1', x(0))
    .attr('x2', x(0))
    .attr('y1', margin.top)
    .attr('y2', height - margin.bottom)

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
          .attr('x', barX)
          .attr('width', barWidth)),
      update => update.call(updateSel => updateSel.transition(t)
        .attr('x', barX)
        .attr('y', row => y(row.code))
        .attr('height', y.bandwidth())
        .attr('width', barWidth)
        .attr('fill', row => COLORS[row.industry])),
      exit => exit.call(exitSel => exitSel.transition(t).attr('width', 0).attr('x', x(0)).remove()),
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
        .attr('text-anchor', labelAnchor)
        .text(row => formatPct(row.priceReturn))
        .call(enterSel => enterSel.transition(t)
          .attr('opacity', 1)
          .attr('x', labelX)
          .attr('y', row => y(row.code) + y.bandwidth() / 2)),
      update => update.call(updateSel => updateSel.transition(t)
        .attr('x', labelX)
        .attr('y', row => y(row.code) + y.bandwidth() / 2)
        .attr('text-anchor', labelAnchor)
        .text(row => formatPct(row.priceReturn))),
      exit => exit.call(exitSel => exitSel.transition(t).attr('opacity', 0).remove()),
    )

  xAxisG.transition(t)
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('+.0%')))
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
  zeroLine = svg.append('line').attr('class', 'zero').attr('stroke', '#999')
  svg.append('g').attr('class', 'bars')
  svg.append('g').attr('class', 'labels')
  xAxisG = svg.append('g').attr('class', 'axis')
  yAxisG = svg.append('g').attr('class', 'axis')
  xLabel = svg.append('text').attr('class', 'x-label').attr('text-anchor', 'middle').text('股價報酬率')
  svg.append('g').attr('class', 'hits')
  svg.on('mouseleave', hideTip)
  ready = true
  render(props.rows, false)
})

watch(() => props.rows, () => {
  if (!ready) return
  hideTip()
  render(props.rows, props.animate)
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
  width: 240px;
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
