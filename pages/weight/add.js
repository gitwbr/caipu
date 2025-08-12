// pages/weight/add.js
const app = getApp();

Page({
  data: {
    id: null,
    record_date: '',
    record_time: '',
    weight_kg: '',
    notes: ''
  },

  onLoad(options) {
    console.log('[weight add onLoad] options:', options);
    const now = new Date();
    const dateStr = getApp().toLocalYMD(now);
    const timeStr = now.toTimeString().substring(0,5);
    const data = {
      id: options.id || null,
      record_date: getApp().toLocalYMD(options?.date || dateStr),
      record_time: options.time ? String(options.time).substring(0,5) : timeStr,
      weight_kg: options.weight_kg ? String(Number(options.weight_kg).toFixed(2)) : '',
      notes: ''
    };
    this.setData(data);
  },

  onDateChange(e) { this.setData({ record_date: e.detail.value }); },
  onTimeChange(e) { this.setData({ record_time: e.detail.value }); },
  onWeightInput(e) { this.setData({ weight_kg: e.detail.value }); },
  onNotesInput(e) { this.setData({ notes: e.detail.value }); },

  onSubmit() {
    if (!app.globalData.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    const weight = Number(this.data.weight_kg);
    if (!Number.isFinite(weight) || weight <= 0) {
      wx.showToast({ title: '请输入有效体重', icon: 'none' });
      return;
    }
    const payload = {
      weight_kg: Number(weight.toFixed(2)),
      record_date: this.data.record_date,
      record_time: this.data.record_time,
      notes: this.data.notes || null
    };
    console.log('[weight add submit] payload:', payload);
    const p = this.data.id ? app.updateWeightRecord(this.data.id, payload) : app.addWeightRecord(payload);
    p.then(() => {
      // 保存体重后刷新用户信息（带BMR/BMI计算）
      return app.getUserInfo().catch(() => {});
    }).then(() => {
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => { wx.navigateBack(); }, 300);
    }).catch(err => {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    });
  },

  onDelete() {
    wx.showModal({
      title: '删除确认',
      content: '确定删除该体重记录吗？',
      success: (res) => {
        if (res.confirm) {
          app.deleteWeightRecord(this.data.id).then(() => {
            wx.showToast({ title: '已删除', icon: 'success' });
            setTimeout(() => { wx.navigateBack(); }, 300);
          }).catch(err => wx.showToast({ title: err.message || '删除失败', icon: 'none' }));
        }
      }
    });
  }
});


