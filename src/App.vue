<script setup>
import { computed, ref } from 'vue'
import * as d3 from 'd3'
import StockBarChart from './components/StockBarChart.vue'
import ReturnBarChart from './components/ReturnBarChart.vue'
import { COLORS, INDUSTRIES, MONTHS, buildView } from './metrics.js'

const raw = ref([])
const month = ref('11509')
const industry = ref('全部')
const hideTsmc = ref(false)
const quotes = ref([])

const format = d3.format(',')
const formatPct = d3.format('.1%')
const signed = d3.format('+,')

const view = computed(() => buildView(raw.value, {
  month: month.value,
  industry: industry.value,
  hideTsmc: hideTsmc.value,
}))

const monthLabel = computed(() => MONTHS.find(item => item.id === month.value).label)

const industryBars = computed(() => {
  const items = view.value.summary.byIndustry.map(item => ({
    ...item,
    shown: hideTsmc.value ? item.withoutTsmc : item.value,
    shownCount: hideTsmc.value ? item.countWithoutTsmc : item.count,
  }))
  const max = Math.max(...items.map(item => item.shown), 1)
  return items.map(item => ({ ...item, pct: item.shown / max * 100 }))
})

const finance = computed(() => view.value.summary.byIndustry.find(item => item.industry === '金融'))
const electronics = computed(() => view.value.summary.byIndustry.find(item => item.industry === '電子'))

d3.csv(`${import.meta.env.BASE_URL}data/stocks.csv`, row => ({
  month: row.month,
  rank: +row.rank,
  code: row.code,
  name: row.name,
  households: +row.households,
  industry: row.industry,
})).then(rows => {
  raw.value = rows
})

d3.csv(`${import.meta.env.BASE_URL}data/returns.csv`, row => ({
  code: row.code,
  julClose: +row.jul_close,
  augClose: +row.aug_close,
  sepClose: +row.sep_close,
})).then(rows => {
  quotes.value = rows
})

const periods = {
  11508: { startKey: 'julClose', endKey: 'augClose', startDate: '115/07/31', endDate: '115/08/31' },
  11509: { startKey: 'augClose', endKey: 'sepClose', startDate: '115/08/31', endDate: '115/09/30' },
}

function withReturn(stock) {
  const quote = quotes.value.find(item => item.code === stock.code)
  if (!quote) return null
  const period = periods[month.value]
  const startClose = quote[period.startKey]
  const endClose = quote[period.endKey]
  return {
    ...stock,
    startClose,
    endClose,
    startDate: period.startDate,
    endDate: period.endDate,
    priceReturn: startClose ? endClose / startClose - 1 : 0,
  }
}

const returnRows = computed(() => view.value.rows.flatMap(stock => {
  const row = withReturn(stock)
  return row ? [row] : []
}))
</script>

<template>
  <main>
    <header>
      <h1>定期定額交易戶數前 20 名股票</h1>
    </header>

    <section v-if="raw.length" class="panel">
      <div class="controls">
        <div class="group">
          <button
            v-for="item in MONTHS"
            :key="item.id"
            :class="{ active: month === item.id }"
            :aria-pressed="month === item.id"
            @click="month = item.id"
          >{{ item.label }}</button>
        </div>
        <div class="group">
          <button
            :class="{ active: industry === '全部' }"
            @click="industry = '全部'"
          >全部</button>
          <button
            v-for="name in INDUSTRIES"
            :key="name"
            :class="{ active: industry === name }"
            @click="industry = name"
          >
            <i class="dot" :style="{ background: COLORS[name] }"></i>{{ name }}
          </button>
          <label class="check">
            <input v-model="hideTsmc" type="checkbox">
            隱藏台積電
          </label>
        </div>
      </div>

      <p class="total">{{ monthLabel }}前 20 名合計 {{ format(view.summary.total) }} 戶</p>

      <div class="cards">
        <article>
          <strong>{{ formatPct(view.summary.top5Share) }}</strong>
          <span>前 5 名合計占前 20 名</span>
        </article>
        <article>
          <strong>{{ formatPct(view.summary.tsmcShare) }}</strong>
          <span>台積電單檔占比</span>
        </article>
        <article>
          <strong class="compare">{{ finance.value > electronics.withoutTsmc ? '金融較多' : '電子較多' }}</strong>
          <span>扣掉台積電後，金融 {{ format(finance.value) }} 戶，電子剩 {{ format(electronics.withoutTsmc) }} 戶</span>
        </article>
      </div>

      <div class="layout">
        <StockBarChart
          :rows="view.rows"
          :mark-top5="view.markTop5"
          :month-id="month"
          :month-label="monthLabel"
        />
        <aside>
          <h2>產業合計{{ hideTsmc ? '（已不含台積電）' : '' }}</h2>
          <div v-for="item in industryBars" :key="item.industry" class="ind">
            <div class="ind-name">
              <i class="dot" :style="{ background: COLORS[item.industry] }"></i>
              {{ item.industry }}
              <span>{{ item.shownCount }} 檔</span>
            </div>
            <div class="track">
              <div class="fill" :style="{ width: `${item.pct}%`, background: COLORS[item.industry] }"></div>
            </div>
            <div class="ind-value">{{ format(item.shown) }} 戶</div>
          </div>
        </aside>
      </div>

      <h2>8 月到 9 月</h2>
      <div class="moves">
        <p><b>新進前 20 名：</b>{{ view.entered.map(item => item.name).join('、') }}</p>
        <p><b>跌出前 20 名：</b>{{ view.exited.map(item => item.name).join('、') }}</p>
        <div class="split">
          <div>
            <h3>戶數增加較多</h3>
            <ul>
              <li v-for="item in view.gainers" :key="item.code">
                {{ item.name }} {{ signed(item.householdDiff) }} 戶（第 {{ item.prevRank }} 名 → 第 {{ item.rank }} 名）
              </li>
            </ul>
          </div>
          <div>
            <h3>戶數減少較多</h3>
            <ul>
              <li v-for="item in view.losers" :key="item.code">
                {{ item.name }} {{ signed(item.householdDiff) }} 戶（第 {{ item.prevRank }} 名 → 第 {{ item.rank }} 名）
              </li>
            </ul>
          </div>
        </div>
      </div>

      <h2>{{ monthLabel }}股價報酬率</h2>
      <ReturnBarChart :rows="returnRows" />

      <p class="source">資料來源：臺灣證券交易所定期定額交易戶數月報（僅股票）與個股日成交收盤價。</p>
    </section>
    <p v-else class="panel">讀取資料中…</p>
  </main>
</template>
