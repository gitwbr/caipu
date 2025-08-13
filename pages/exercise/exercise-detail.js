const app = getApp();

Page({
  data: {
    typeId: null,
    method: '',
    recordDate: '',
    record_time: '',
    duration_min: '',
    weight_kg_at_time: '',
    calories_burned_kcal: '',
    record: {},
    typeName: '',
    methodLabel: '',
    dynamicFields: [],
    durationHint: '',
    weightHint: '',
    focusMap: {},
    bottomHints: [],
    saveDisabled: true
  },

  onLoad(options) {
    const { typeId, method, date, id } = options || {};
    console.log('[exercise-detail onLoad] options:', options);
    if (id) {
      this.loadRecord(Number(id));
      return;
    }
    const d = getApp().toLocalYMD(date || new Date());
    this.setData({ typeId: Number(typeId), method: method, recordDate: d, display_date: d, record_time: this._nowHM() });
    try { wx.setNavigationBarTitle({ title: d }); } catch (_) {}
    this.initForm();
  },

  _today() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  },

  _nowHM() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mi}`;
  },

  loadRecord(id) {
    const list = wx.getStorageSync('exerciseRecords') || [];
    const rec = list.find(r => r.id === id) || {};
    const types = wx.getStorageSync('exerciseTypes') || [];
    const typeName = (types.find(t => t.id === rec.type_id) || {}).name || '';
    const methodLabel = this._getMethodLabel(rec.calc_method);
    const { fields: dynamicFields, bottomHints } = this._buildFieldsFromSchema(rec.calc_method, rec);
    const topHints = this._getTopHints(rec.calc_method);
    const bottomHintsText = (bottomHints || []).filter(h => !/^体重/.test(h)).join(' / ');
    const rd = getApp().toLocalYMD(rec.record_date) || this._today();
    const rt = rec.record_time ? String(rec.record_time).slice(0,5) : this._nowHM();
    this.setData({
      typeId: rec.type_id || this.data.typeId,
      method: rec.calc_method || this.data.method,
      recordDate: rd,
      display_date: rd,
      record: rec,
      typeName,
      methodLabel,
      dynamicFields,
      duration_min: String(rec.duration_min || ''),
      weight_kg_at_time: rec.weight_kg_at_time ? String(rec.weight_kg_at_time) : '',
      calories_burned_kcal: rec.calories_burned_kcal ? String(rec.calories_burned_kcal) : '',
      record_time: rt,
      durationHint: topHints.durationHint,
      weightHint: '',
      bottomHints,
      bottomHintsText,
      isIntensityType: ((types.find(t => t.id === rec.type_id) || {}).code === 'strength' || (types.find(t => t.id === rec.type_id) || {}).code === 'hiit')
    }, () => this._recalc());
  },

  _getMethodLabel(method) {
    const map = { acsm_walking:'ACSM 走路', acsm_running:'ACSM 跑步', cycling_speed_table:'骑行-速度', swimming_stroke:'游泳-泳姿配速', met_fixed:'强度/RPE' };
    return map[method] || method;
  },

  initForm() {
    const types = wx.getStorageSync('exerciseTypes') || [];
    const type = types.find(t => t.id === this.data.typeId) || {};
    const methodLabel = this._getMethodLabel(this.data.method);
    const { fields, bottomHints } = this._buildFieldsFromSchema(this.data.method, {});
    const topHints = this._getTopHints(this.data.method);
    // 默认值：时长 30，其它用 schema 最小值；体重使用当前用户体重
    const all = wx.getStorageSync('exerciseCalcMethods') || [];
    const m = all.find(x => x.calc_method === this.data.method && x.type_id === this.data.typeId) || {};
    const s = m.params_schema || {};
    const durationDefault = String(Math.max(30, (s.duration_min && Number(s.duration_min.min)) || 0));
    const userWeight = (app.globalData.userInfo && (app.globalData.userInfo.weight_kg || app.globalData.userInfo.weight)) || '';
    const bottomHintsText = (bottomHints || []).filter(h => !/^体重/.test(h)).join(' / ');
    this.setData({
      typeName: type.name || '',
      methodLabel,
      dynamicFields: fields,
      duration_min: durationDefault,
      record_time: this._nowHM(),
      weight_kg_at_time: userWeight ? String(userWeight) : '',
      durationHint: topHints.durationHint,
      weightHint: '',
      bottomHints,
      bottomHintsText,
      isIntensityType: (type.code === 'strength' || type.code === 'hiit')
    }, () => this._recalc());
  },

  _buildFieldsFromSchema(method, preset) {
    const all = wx.getStorageSync('exerciseCalcMethods') || [];
    const m = all.find(x => x.calc_method === method && x.type_id === (this.data.typeId || preset.type_id));
    const schema = (m && m.params_schema) || {};
    const result = [];
    const hints = [];
    Object.keys(schema).forEach(key => {
      const def = schema[key];
      if (key === 'duration_min' || key === 'weight_kg_at_time') return; // 顶部或单独渲染
      const label = this._getParamCnLabel(key, def);
      if (def.type === 'enum') {
        const options = (def.enum || []).map(v => ({ value: v, label: (def.labels && def.labels[v]) || v }));
    let pre = preset[key];
    // 力量默认中等强度
    if (method === 'met_fixed' && key === 'intensity_level' && (pre === undefined || pre === null || pre === '')) {
      pre = 'moderate';
    }
    let index = undefined;
    if (pre !== undefined && pre !== null && pre !== '') {
      const found = options.findIndex(o => o.value === pre);
      index = found >= 0 ? found : undefined;
    }
        const hint = options.length ? `${label.replace(/（.*?）/, '')}：${options.map(o=>o.label).join(' / ')}` : '';
        if (hint) hints.push(hint);
        result.push({ key, label, type: 'enum', options, index });
      } else {
        let value = preset[key] !== undefined && preset[key] !== null ? String(preset[key]) : (def.min !== undefined ? String(def.min) : '');
        // 新增时默认 RPE 为空；编辑时尊重已有值
        if (method === 'met_fixed' && key === 'rpe' && !preset.id) {
          value = '';
        }
        const hint = this._buildRangeHint(def, label);
        if (hint) hints.push(hint);
        result.push({ key, label, value, placeholder: def.unit || '' });
      }
    });
    // 兜底：若 schema 缺失但方法为走路/跑步，则提供速度/坡度字段
    if (!result.length && (method === 'acsm_walking' || method === 'acsm_running')) {
      result.push({ key: 'speed_kmh', label: '速度（km/h）', value: '', placeholder: 'km/h', hint: '范围：1 ~ 25 km/h' });
      result.push({ key: 'incline_percent', label: '坡度（%）', value: '', placeholder: '%', hint: '范围：0 ~ 20 %' });
      hints.push('速度：1 ~ 25 km/h');
      hints.push('坡度：0 ~ 20 %');
    }
    // 顶部字段的提示一并加入
    const dHint = this._buildRangeHint(schema.duration_min, '时长');
    const wHint = this._buildRangeHint(schema.weight_kg_at_time, '体重');
    if (dHint) hints.unshift(dHint);
    if (wHint) hints.unshift(wHint);
    return { fields: result, bottomHints: hints };
  },

  _getParamCnLabel(key, def) {
    const unit = def && def.unit ? `（${def.unit}）` : '';
    const map = {
      speed_kmh: `速度${unit || '（km/h）'}`,
      avg_speed_kmh: `平均速度${unit || '（km/h）'}`,
      incline_percent: `坡度${unit || '（%）'}`,
      distance_km: `距离${unit || '（km）'}`,
      power_watts: `功率${unit || '（W）'}`,
      stroke: '泳姿',
      pace_sec_per_100m: `配速${unit || '（s/100m）'}`,
      intensity_level: '强度',
      rpe: 'RPE',
      // 顶部单独渲染的：
      duration_min: `时长${unit || '（min）'}`,
      weight_kg_at_time: `体重${unit || '（kg）'}`
    };
    return map[key] || `${key}${unit}`;
  },

  _buildRangeHint(def, labelFor)
  {
    if (!def) return '';
    const unit = def.unit ? def.unit : '';
    const part = (def.min !== undefined && def.max !== undefined) ? `${def.min} ~ ${def.max}` : '';
    if (!part) return '';
    const name = labelFor ? labelFor.replace(/（.*?）/, '') : '';
    return `${name ? name + '：' : ''}${part}${unit ? ' ' + unit : ''}`;
  },

  _getTopHints(method) {
    const all = wx.getStorageSync('exerciseCalcMethods') || [];
    const m = all.find(x => x.calc_method === method && x.type_id === this.data.typeId) || {};
    const s = m.params_schema || {};
    const durationHint = this._buildRangeHint(s.duration_min || { min: 1, max: 300, unit: 'min', step: 1 });
    const weightHint = this._buildRangeHint(s.weight_kg_at_time || { min: 20, max: 200, unit: 'kg', step: 0.5 });
    return { durationHint, weightHint };
  },

  onInput(e) { this.setData({ [e.currentTarget.dataset.key]: e.detail.value }, () => this._recalc()); },
  onTimeChange(e) {
    this.setData({ record_time: e.detail.value });
  },
  onParamInput(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    console.log('[exercise-detail] onParamInput', key, value);
    const val = String(value || '').replace(/[^0-9.\-]/g, '');
    let arr = this.data.dynamicFields.map(f => f.key === key ? { ...f, value: val } : f);
    // 联动：若填写了 RPE，则清空强度
    if (key === 'rpe') {
      arr = arr.map(f => f.key === 'intensity_level' ? { ...f, index: undefined } : f);
    }
    this.setData({ dynamicFields: arr }, () => this._recalc());
  },

  onEnumChange(e) {
    const key = e.currentTarget.dataset.key;
    const idx = Number(e.detail.value);
    console.log('[exercise-detail] onEnumChange', key, idx);
    let arr = this.data.dynamicFields.map(f => f.key === key ? { ...f, index: idx } : f);
    // 联动：选择强度则清空 RPE
    if (key === 'intensity_level') {
      arr = arr.map(f => f.key === 'rpe' ? { ...f, value: '' } : f);
    }
    this.setData({ dynamicFields: arr }, () => this._recalc());
  },

  activateFocus(e) {
    const key = e.currentTarget.dataset.key;
    const map = { ...(this.data.focusMap || {}) };
    map[key] = true;
    this.setData({ focusMap: map });
  },
  onBlur(e) {
    const key = e.currentTarget.dataset.key;
    const map = { ...(this.data.focusMap || {}) };
    map[key] = false;
    this.setData({ focusMap: map });
  },

  _recalc() {
    const method = this.data.method || this.data.record.calc_method;
    const params = {};
    this.data.dynamicFields.forEach(f => {
      if (f.type === 'enum') {
        const hasIndex = typeof f.index === 'number' && !isNaN(f.index);
        if (hasIndex && Array.isArray(f.options)) {
          const opt = f.options[f.index];
          if (opt) params[f.key] = opt.value;
        }
      } else {
        params[f.key] = Number(f.value || 0);
      }
    });
    params.duration_min = Number(this.data.duration_min || 0);
    // 若未填写体重，使用用户资料中的体重
    const userWeight = (app.globalData.userInfo && (app.globalData.userInfo.weight_kg || app.globalData.userInfo.weight)) || 0;
    params.weight_kg_at_time = Number(this.data.weight_kg_at_time || params.weight_kg_at_time || userWeight || 0);
    console.log('[exercise-detail] _recalc method/params ->', method, params);
    const met = this._calcMET(method, params);
    const kcal = met && params.duration_min && params.weight_kg_at_time ? met * 3.5 * params.weight_kg_at_time / 200 * params.duration_min : 0;
    const kcalStr = Number.isFinite(kcal) ? Number(kcal).toFixed(2) : '0.00';
    console.log('[exercise-detail] _recalc result ->', { met, kcal: kcalStr });
    const disabled = !(Number(params.duration_min) > 0 && Number(kcal) > 0);
    this.setData({ calories_burned_kcal: kcalStr, saveDisabled: disabled });
  },

  // 计算 MET（与选择页保持一致）
  _calcMET(method, p) {
    if (!method) return 0;
    try {
      console.log('[exercise-detail] _calcMET start', method, p);
      if (method === 'acsm_walking') {
        const v = Number(p.speed_kmh || 0) * 1000 / 60; // m/min
        const vo2 = 0.1 * v + 1.8 * v * (Number(p.incline_percent || 0) / 100) + 3.5;
        console.log('[exercise-detail] walking v/vo2', v, vo2);
        return vo2 / 3.5;
      }
      if (method === 'acsm_running') {
        const v = Number(p.speed_kmh || 0) * 1000 / 60; // m/min
        const vo2 = 0.2 * v + 0.9 * v * (Number(p.incline_percent || 0) / 100) + 3.5;
        console.log('[exercise-detail] running v/vo2', v, vo2);
        return vo2 / 3.5;
      }
      if (method === 'cycling_speed_table') {
        const speed = Number(p.speed_kmh || 0);
        const table = wx.getStorageSync('cyclingSpeedMap') || [];
        const methods = wx.getStorageSync('exerciseCalcMethods') || [];
        const methodId = (methods.find(m => m.calc_method === 'cycling_speed_table' && (!this.data.typeId || m.type_id === this.data.typeId)) || methods.find(m => m.calc_method === 'cycling_speed_table'))?.id;
        const rows = table.filter(r => r.method_id === methodId);
        console.log('[exercise-detail] cycling table', { speed, methodId, rows: rows.length });
        const hit = rows.find(r => speed >= Number(r.speed_min_kmh) && speed <= Number(r.speed_max_kmh));
        if (!hit) console.warn('[exercise-detail] cycling no hit range');
        return hit ? Number(hit.met) : 0;
      }
      if (method === 'swimming_stroke') {
        const pace = Number(p.pace_sec_per_100m || 0);
        const stroke = p.stroke || 'freestyle';
        const table = wx.getStorageSync('swimmingStrokePaceMap') || [];
        const methods = wx.getStorageSync('exerciseCalcMethods') || [];
        const methodId = (methods.find(m => m.calc_method === 'swimming_stroke' && (!this.data.typeId || m.type_id === this.data.typeId)) || methods.find(m => m.calc_method === 'swimming_stroke'))?.id;
        const rows = table.filter(r => r.method_id === methodId && r.stroke === stroke);
        console.log('[exercise-detail] swim table', { stroke, pace, methodId, rows: rows.length, sample: rows[0] });
        const hit = rows.find(r => pace >= Number(r.pace_min_sec_per_100m) && pace <= Number(r.pace_max_sec_per_100m));
        if (hit) return Number(hit.met);
        if (!rows.length) return 0;
        const min = Math.min.apply(null, rows.map(r => Number(r.pace_min_sec_per_100m)));
        const max = Math.max.apply(null, rows.map(r => Number(r.pace_max_sec_per_100m)));
        console.warn('[exercise-detail] swim no hit range', { min, max, pace, stroke });
        // 若超出映射边界：取最近边界的 MET，避免出现 0
        if (pace < min) {
          const fastest = rows.reduce((acc, r) => (Number(r.pace_min_sec_per_100m) < Number(acc.pace_min_sec_per_100m) ? r : acc), rows[0]);
          return Number(fastest.met);
        }
        if (pace > max) {
          const slowest = rows.reduce((acc, r) => (Number(r.pace_max_sec_per_100m) > Number(acc.pace_max_sec_per_100m) ? r : acc), rows[0]);
          return Number(slowest.met);
        }
        return 0;
      }
      if (method === 'met_fixed') {
        const level = p.intensity_level; // 不设默认，避免覆盖 RPE 输入
        const rpe = Number(p.rpe || 0);
        const table = wx.getStorageSync('strengthIntensityMap') || [];
        const methods = wx.getStorageSync('exerciseCalcMethods') || [];
        const methodId = (methods.find(m => m.calc_method === 'met_fixed' && (!this.data.typeId || m.type_id === this.data.typeId)) || methods.find(m => m.calc_method === 'met_fixed'))?.id;
        const rows = table.filter(r => r.method_id === methodId);
        // 若当前类型（如 HIIT）暂未配置强度/RPE 映射，使用保守兜底
        if (!rows.length) {
          if (level) {
            if (level === 'low') return 3.5;
            if (level === 'moderate') return 5.0;
            if (level === 'high') return 6.0;
          }
          if (rpe) {
            if (rpe <= 5) return 3.5;
            if (rpe <= 7) return 5.0;
            return 6.0;
          }
          return 0;
        }
        let byLevel;
        if (level) {
          byLevel = rows.find(r => r.intensity_level === level);
          if (byLevel) return Number(byLevel.met);
        }
        if (rpe) {
          const byRpe = rows.find(r => r.rpe_min <= rpe && r.rpe_max >= rpe);
          if (byRpe) return Number(byRpe.met);
          // 若 rpe 在映射表之外，则取最近边界
          const minRpe = Math.min.apply(null, rows.map(r => Number(r.rpe_min)));
          const maxRpe = Math.max.apply(null, rows.map(r => Number(r.rpe_max)));
          if (rpe < minRpe) {
            const lowRow = rows.reduce((acc, r) => (r.rpe_min < acc.rpe_min ? r : acc), rows[0]);
            return Number(lowRow.met);
          }
          if (rpe > maxRpe) {
            const highRow = rows.reduce((acc, r) => (r.rpe_max > acc.rpe_max ? r : acc), rows[0]);
            return Number(highRow.met);
          }
        }
        console.warn('[exercise-detail] strength no hit by level/rpe', { level, rpe });
        return 0;
      }
    } catch (e) {
      console.error('calc MET error:', e);
    }
    return 0;
  },

  onCancel() { wx.navigateBack(); },
  async onSave() {
    try {
      if (!Number(this.data.duration_min)) {
        wx.showToast({ title: '请输入有效时长', icon: 'none' });
        return;
      }
      if (!Number(this.data.calories_burned_kcal)) {
        wx.showToast({ title: '参数不足，无法计算卡路里', icon: 'none' });
        return;
      }
      const params = {};
      this.data.dynamicFields.forEach(f => {
        if (f.type === 'enum') {
          const hasIndex = typeof f.index === 'number' && !isNaN(f.index);
          const opt = hasIndex && Array.isArray(f.options) ? f.options[f.index] : null;
          if (opt) params[f.key] = opt.value;
          else params[f.key] = null;
        } else {
          const raw = f.value;
          if (raw === '' || raw === undefined || raw === null) {
            params[f.key] = null;
          } else {
            params[f.key] = Number(raw);
          }
        }
      });
      // 互斥：若选择了强度，则 RPE 置空；若填写了 RPE，则强度置空
      if (params.intensity_level) params.rpe = null;
      if (params.rpe !== null && params.rpe !== undefined && params.rpe !== '' ) params.intensity_level = null;
      const duration_min = Number(this.data.duration_min || 0);
      const weight = Number(params.weight_kg_at_time || this.data.weight_kg_at_time || (app.globalData.userInfo && (app.globalData.userInfo.weight_kg || app.globalData.userInfo.weight)) || 0);
      // 若未填写体重，使用用户体重
      const met_used = this._calcMET(this.data.method || this.data.record.calc_method, { ...params, duration_min, weight_kg_at_time: weight });
      const calories = met_used && duration_min && weight ? met_used * 3.5 * weight / 200 * duration_min : 0;
      const record = {
        type_id: this.data.typeId || this.data.record.type_id,
        calc_method: this.data.method || this.data.record.calc_method,
        duration_min,
        met_used,
        weight_kg_at_time: weight,
        calories_burned_kcal: Number(calories.toFixed(2)),
        record_date: this.data.record.record_date || this.data.recordDate,
        record_time: (this.data.record.record_time || this.data.record_time || this._nowHM())
      };
      // 附带快照
      Object.assign(record, params);
      const isEdit = !!(this.data.record && this.data.record.id);
      let saved;
      if (isEdit) {
        const rid = Number(this.data.record.id);
        if (app && typeof app.updateExerciseRecordWithSync === 'function') {
          saved = await app.updateExerciseRecordWithSync(rid, record);
        } else {
          const list = (wx.getStorageSync('exerciseRecords') || []).map(r => String(r.id) === String(rid) ? { ...r, ...record, id: rid } : r);
          wx.setStorageSync('exerciseRecords', list);
          saved = list.find(r => String(r.id) === String(rid));
        }
      } else {
        if (app && typeof app.addExerciseRecordWithSync === 'function') {
          saved = await app.addExerciseRecordWithSync(record);
        } else {
          const list = wx.getStorageSync('exerciseRecords') || [];
          const temp = { id: Date.now(), ...record };
          list.push(temp);
          wx.setStorageSync('exerciseRecords', list);
          saved = temp;
        }
      }
      wx.showToast({ title:'已保存', icon:'success' });
      try { wx.setStorageSync('exerciseDirty', Date.now()); } catch(_) {}
      const date = getApp().toLocalYMD((saved && saved.record_date) || record.record_date);
      console.log('[exercise-detail save] redirect date:', date, 'saved.record_date:', saved && saved.record_date, 'record.record_date:', record.record_date);
      const hid = saved && saved.id ? `&highlightId=${saved.id}` : '';
      wx.redirectTo({ url: `/pages/record/record-detail-list?date=${date}${hid}` });
    } catch (e) {
      console.error(e);
      wx.showToast({ title:'保存失败', icon:'none' });
    }
  }
});

