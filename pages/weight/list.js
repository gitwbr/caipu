// pages/weight/list.js
const app = getApp();

Page({
  data: {
    records: []
  },

  onShow() {
    this.loadList();
  },

  loadList() {
    if (!app.globalData.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    app.getWeightRecords().then(list => {
      const mapped = (list || []).map(r => {
        const dateStr = getApp().toLocalYMD(r.record_date);
        const timeStr = (r.record_time || '').toString().substring(0,5);
        return {
          ...r,
          display_weight: (Number(r.weight_kg) || 0).toFixed(2),
          display_date: dateStr,
          display_time: timeStr
        };
      });
      this.setData({ records: mapped });
    }).catch(err => {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    });
  },

  onItemTap(e) {
    const id = e.currentTarget.dataset.id;
    const item = (this.data.records || []).find(r => String(r.id) === String(id));
    const query = item ? `?id=${item.id}&weight_kg=${item.weight_kg}&date=${item.display_date}&time=${item.display_time}` : '';
    wx.navigateTo({ url: '/pages/weight/add' + query });
  },

  onAddTap() {
    wx.navigateTo({ url: '/pages/weight/add' });
  }
});


