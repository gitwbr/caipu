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
    // 设置默认日期为今天
    const dateStr = getApp().toLocalYMD(new Date());
    console.log('[record onLoad] default date:', dateStr);
    this.setData({
      selectedDate: dateStr
    });
  },

  onShow() {
    // 每次显示页面时检查登录状态
    if (!app.globalData.isLoggedIn) {
      // 弹出登录确认框
      wx.showModal({
        title: '需要登录',
        content: '记录功能需要登录后才能使用，是否立即登录？',
        confirmText: '登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 用户点击登录
            app.wxLogin().then(() => {
              console.log('登录成功，数据已从云端获取并保存到本地');
              this.loadDailyData();
              this.loadWeightSummary();
            }).catch((error) => {
              console.error('登录失败:', error);
              wx.showToast({
                title: '登录失败',
                icon: 'none'
              });
              // 登录失败时使用本地数据
              this.loadDailyData();
            });
          } else {
            // 用户取消登录，跳转到"我的"页面
            console.log('用户取消登录，跳转到"我的"页面');
            wx.switchTab({
              url: '/pages/index/index'
            });
          }
        }
      });
    } else {
      // 已登录，直接使用本地数据
      this.loadDailyData();
      this.loadWeightSummary();
    }
  },

  // 加载指定日期的数据
  loadDailyData() {
    const { selectedDate } = this.data;
    this.setData({ loading: true });

    console.log('=== 记录页面数据调试 ===');
    console.log('当前日期:', selectedDate);
    
    // 获取用户基础代谢率
    const userInfo = wx.getStorageSync('userInfo') || {};
    console.log('用户信息:', userInfo);
    const bmr = userInfo.bmr || 1500; // 直接使用存储的BMR
    console.log('基础代谢率:', bmr);
    
    // 获取当日卡路里汇总
    const summary = app.calculateDailyCalorieSummary(selectedDate);
    console.log('卡路里汇总:', summary);
    
    // 计算已摄入卡路里，保留2位小数
    const consumedCalories = parseFloat(summary.total_calories || 0);
    const consumedCaloriesFormatted = parseFloat(consumedCalories.toFixed(2));
    
    // 统计当日运动消耗（本地优先）
    const allEx = (app.globalData.exerciseRecords || wx.getStorageSync('exerciseRecords') || []);
    const exerciseCalories = (allEx || []).reduce((sum, r) => {
      if (!r.record_date) return sum;
      const d = getApp().toLocalYMD(r.record_date);
      if (d !== selectedDate) return sum;
      return sum + Number(r.calories_burned_kcal || 0);
    }, 0);
    
    // 计算剩余卡路里，保留2位小数
    const remainingCalories = Math.max(0, bmr + exerciseCalories - consumedCaloriesFormatted);
    const remainingCaloriesFormatted = parseFloat(remainingCalories.toFixed(2));
    
    this.setData({
      consumedCalories: consumedCaloriesFormatted,
      exerciseCalories: parseFloat(exerciseCalories.toFixed(1)),
      remainingCalories: remainingCaloriesFormatted,
      loading: false
    });
    
    console.log('页面数据已更新:', this.data);
  },

  // 加载体重汇总（初始/最新/变化）
  loadWeightSummary() {
    if (!app.globalData.isLoggedIn) return;
    app.getWeightSummary().then(summary => {
      const init = summary.initial_weight_kg != null ? Number(summary.initial_weight_kg).toFixed(2) : '--';
      const latest = summary.latest_weight_kg != null ? Number(summary.latest_weight_kg).toFixed(2) : '--';
      const delta = (summary.delta_kg != null) ? Number(summary.delta_kg).toFixed(2) : '--';
      console.log('[weight summary]', {
        initial: init,
        latest: latest,
        delta,
        initialDate: getApp().toLocalYMD(summary.initial_record_date),
        latestDate: getApp().toLocalYMD(summary.latest_record_date)
      });
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
  }
});