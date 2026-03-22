// pages/record/record.js
const app = getApp();

Page({
  data: {
    selectedDate: '',
    // 体重相关数据
    initialWeight: '--',
    latestWeight: '--',
    weightLost: '--',
    // 卡路里相关数据
    consumedCalories: 0,
    exerciseCalories: 0,
    remainingCalories: 0,
    loading: false
  },

  onLoad() {
    const dateStr = getApp().toLocalYMD(new Date());
    this.setData({
      selectedDate: dateStr
    });
  },

  onShow() {
    app.syncTabBar(this);
    if (this._loginPrompting) {
      return;
    }

    if (!app.globalData.isLoggedIn) {
      this._loginPrompting = true;
      app.checkLoginAndShowModal().then(() => {
        this.loadDailyData();
        this.loadWeightSummary();
      }).catch(() => {
        wx.switchTab({
          url: '/pages/index/index'
        });
      }).finally(() => {
        this._loginPrompting = false;
      });
      return;
    }

    this.loadDailyData();
    this.loadWeightSummary();
  },

  // 加载指定日期的数据
  loadDailyData() {
    const { selectedDate } = this.data;
    this.setData({ loading: true });
    
    const userInfo = wx.getStorageSync('userInfo') || {};
    const bmr = userInfo.bmr || 1500; // 直接使用存储的BMR
    
    const summary = app.calculateDailyCalorieSummary(selectedDate);
    
    const consumedCalories = parseFloat(summary.total_calories || 0);
    const consumedCaloriesFormatted = parseFloat(consumedCalories.toFixed(2));
    
    const allEx = (app.globalData.exerciseRecords || wx.getStorageSync('exerciseRecords') || []);
    const exerciseCalories = (allEx || []).reduce((sum, r) => {
      if (!r.record_date) return sum;
      const d = getApp().toLocalYMD(r.record_date);
      if (d !== selectedDate) return sum;
      return sum + Number(r.calories_burned_kcal || 0);
    }, 0);
    
    const remainingCalories = Math.max(0, bmr + exerciseCalories - consumedCaloriesFormatted);
    const remainingCaloriesFormatted = parseFloat(remainingCalories.toFixed(2));
    
    this.setData({
      consumedCalories: consumedCaloriesFormatted,
      exerciseCalories: parseFloat(exerciseCalories.toFixed(1)),
      remainingCalories: remainingCaloriesFormatted,
      loading: false
    });
  },

  // 加载体重汇总（初始/最新/变化）
  loadWeightSummary() {
    if (!app.globalData.isLoggedIn) return;
    app.getWeightSummary().then(summary => {
      const init = summary.initial_weight_kg != null ? Number(summary.initial_weight_kg).toFixed(2) : '--';
      const latest = summary.latest_weight_kg != null ? Number(summary.latest_weight_kg).toFixed(2) : '--';
      const delta = (summary.delta_kg != null) ? Number(summary.delta_kg).toFixed(2) : '--';
      this.setData({ initialWeight: init, latestWeight: latest, weightLost: delta });
    }).catch(() => {
      // 忽略错误，保持占位
    });
  },

  // 点击整个区域进入记录详情页面
  onTapRecordArea() {
    wx.navigateTo({
      url: '/pages/record/record-detail-list'
    });
  },

  // 记录饮食
  addRecord() {
    wx.navigateTo({
      url: '/pages/record/add-record'
    });
  },

  // 记录运动
  addExercise() {
    const { selectedDate } = this.data;
    const date = getApp().toLocalYMD(selectedDate || new Date());
    wx.navigateTo({
      url: `/pages/exercise/add-exercise?date=${date}`
    });
  }
  ,

  // 跳转体重记录列表
  goWeightList() {
    wx.navigateTo({ url: '/pages/weight/list' });
  },

  // 直接新增体重记录
  goWeightAdd() {
    wx.navigateTo({ url: '/pages/weight/add' });
  }
});
