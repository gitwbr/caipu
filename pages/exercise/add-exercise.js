const app = getApp();

Page({
  data: {
    recordDate: '',
    // 列表数据：每种运动一条（已根据“每类型一种方法”整理）
    items: []
  },

  onLoad(options) {
    const date = options?.date || this._today();
    this.setData({ recordDate: date });
    this.initList();
  },

  _today() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  },

  initList() {
    const types = wx.getStorageSync('exerciseTypes') || [];
    const methods = wx.getStorageSync('exerciseCalcMethods') || [];
    const pairs = [];
    const preferred = {
      walking: 'acsm_walking',
      running: 'acsm_running',
      cycling: 'cycling_speed_table',
      swimming: 'swimming_stroke',
      strength: 'met_fixed',
      hiit: 'met_fixed',
      yoga: 'met_fixed'
    };
    for (const t of types) {
      const m = methods.find(x => x.type_id === t.id && (!preferred[t.code] || x.calc_method === preferred[t.code])) || methods.find(x => x.type_id === t.id);
      if (!m) continue;
      pairs.push({
        id: `${t.id}_${m.id}`,
        type_id: t.id,
        type_name: t.name,
        calc_method: m.calc_method,
        method_label: this._getMethodLabel(m.calc_method)
      });
    }
    // 排序：固定顺序
    const order = ['walking','running','cycling','swimming','strength','hiit','yoga'];
    pairs.sort((a,b)=> order.indexOf((types.find(t=>t.id===a.type_id)||{}).code) - order.indexOf((types.find(t=>t.id===b.type_id)||{}).code));
    this.setData({ items: pairs });
  },

  _getMethodLabel(method) {
    const map = {
      acsm_walking: 'ACSM 走路',
      acsm_running: 'ACSM 跑步',
      cycling_speed_table: '骑行-速度',
      swimming_stroke: '游泳-泳姿配速',
      met_fixed: '强度/RPE'
    };
    return map[method] || method;
  },

  // 列表模式无此步骤

  // 选择某个运动 → 跳转详情页填写参数
  onSelect(e) {
    const { typeId, method } = e.currentTarget.dataset;
    const q = `typeId=${typeId}&method=${method}&date=${this.data.recordDate}`;
    wx.navigateTo({ url: `/pages/exercise/exercise-detail?${q}` });
  },

  // 旧计算保留备用（目前改到详情页执行）
  _calcMET(method, p) {
    if (!method) return 0;
    if (method === 'acsm_walking') {
      const v = Number(p.speed_kmh || 0) * 1000 / 60; // m/min
      const vo2 = 0.1 * v + 1.8 * v * (Number(p.incline_percent || 0) / 100) + 3.5;
      return vo2 / 3.5;
    }
    if (method === 'acsm_running') {
      const v = Number(p.speed_kmh || 0) * 1000 / 60; // m/min
      const vo2 = 0.2 * v + 0.9 * v * (Number(p.incline_percent || 0) / 100) + 3.5;
      return vo2 / 3.5;
    }
    if (method === 'cycling_speed_table') {
      const speed = Number(p.speed_kmh || 0);
      const table = wx.getStorageSync('cyclingSpeedMap') || [];
      const methodId = (wx.getStorageSync('exerciseCalcMethods') || []).find(m => m.calc_method === 'cycling_speed_table')?.id;
      const rows = table.filter(r => r.method_id === methodId);
      const hit = rows.find(r => speed >= r.speed_min_kmh && speed <= r.speed_max_kmh);
      return hit ? Number(hit.met) : 0;
    }
    if (method === 'swimming_stroke') {
      const pace = Number(p.pace_sec_per_100m || 0);
      const stroke = p.stroke || 'freestyle';
      const table = wx.getStorageSync('swimmingStrokePaceMap') || [];
      const methodId = (wx.getStorageSync('exerciseCalcMethods') || []).find(m => m.calc_method === 'swimming_stroke')?.id;
      const rows = table.filter(r => r.method_id === methodId && r.stroke === stroke);
      const hit = rows.find(r => pace >= r.pace_min_sec_per_100m && pace <= r.pace_max_sec_per_100m);
      return hit ? Number(hit.met) : 0;
    }
    if (method === 'met_fixed') {
      const level = p.intensity_level || 'moderate';
      const rpe = Number(p.rpe || 0);
      const table = wx.getStorageSync('strengthIntensityMap') || [];
      const methodId = (wx.getStorageSync('exerciseCalcMethods') || []).find(m => m.calc_method === 'met_fixed')?.id;
      const rows = table.filter(r => r.method_id === methodId);
      const byLevel = rows.find(r => r.intensity_level === level);
      if (byLevel) return Number(byLevel.met);
      const byRpe = rows.find(r => r.rpe_min <= rpe && r.rpe_max >= rpe);
      return byRpe ? Number(byRpe.met) : 0;
    }
    return 0;
  }
});


