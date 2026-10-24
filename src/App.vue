<script setup>
import { computed, nextTick, ref } from 'vue'
import * as d3 from 'd3'
import StockBarChart from './components/StockBarChart.vue'
import { COLORS, INDUSTRIES, MONTHS, buildView } from './metrics.js'

const raw = ref([])
const month = ref('11509')
const industry = ref('全部')
const hideTsmc = ref(false)
const playing = ref(false)
const animate = ref(true)

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

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function play() {
  playing.value = true
  animate.value = false
  month.value = '11508'
  industry.value = '全部'
  hideTsmc.value = false
  await nextTick()
  await wait(80)
  animate.value = true
  await wait(900)
  month.value = '11509'
  await wait(800)
  playing.value = false
}
</script>

<template>
  <main>
    <header>
      <h1>定期定額交易戶數前 20 名股票</h1>
      <p class="question">戶數是集中在少數股票，還是散在各產業？電子股看起來很多，是整個產業，還是幾乎都是台積電？</p>
    </header>

    <section v-if="raw.length" class="panel">
      <div class="controls">
        <div class="group">
          <button
            v-for="item in MONTHS"
            :key="item.id"
            :class="{ active: month === item.id }"
            :aria-pressed="month === item.id"
            :disabled="playing"
            @click="month = item.id"
          >{{ item.label }}</button>
          <button class="play" :disabled="playing" @click="play">
            {{ playing ? '播放中…' : '播放 8月 → 9月' }}
          </button>
        </div>
        <div class="group">
          <button
            :class="{ active: industry === '全部' }"
            :disabled="playing"
            @click="industry = '全部'"
          >全部</button>
          <button
            v-for="name in INDUSTRIES"
            :key="name"
            :class="{ active: industry === name }"
            :disabled="playing"
            @click="industry = name"
          >
            <i class="dot" :style="{ background: COLORS[name] }"></i>{{ name }}
          </button>
          <label class="check">
            <input v-model="hideTsmc" type="checkbox" :disabled="playing">
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
      <p class="caption">這三個數字用該月完整的前 20 名計算，篩選產業或隱藏台積電不會改到它們。</p>

      <div class="layout">
        <StockBarChart
          :rows="view.rows"
          :mark-top5="view.markTop5"
          :month-id="month"
          :month-label="monthLabel"
          :animate="animate"
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
          <p class="caption">長條依目前最長的產業縮放。隱藏台積電後，電子會縮短，金融變成最長。</p>
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
        <p v-for="item in view.rankUpButFewer" :key="item.code" class="finding">
          {{ item.name }}排名從第 {{ item.prevRank }} 名升到第 {{ item.rank }} 名，戶數卻從 {{ format(item.prevHouseholds) }} 降到 {{ format(item.households) }}。
          名次往前，是因為有股票跌出前 20 名，不是扣款戶變多。
        </p>
      </div>

      <p class="caveat">
        交易戶數不是報酬率。它只計算這個月有成功扣款的帳戶，同一個人用兩個帳號扣款會算成 2 戶。戶數高只代表用定期定額買的人多，不代表這檔股票比較會賺。
      </p>
      <p class="source">
        資料來源：臺灣證券交易所「定期定額交易戶數統計排行月報表」。8 月與作業一相同；9 月取自證交所開放資料。只保留股票，不含 ETF。產業沿用作業一的分法：電子、金融、其他。廣達與日月光投控歸在電子。
      </p>
    </section>
    <p v-else class="panel">讀取資料中…</p>
  </main>
</template>
