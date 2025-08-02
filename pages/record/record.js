// pages/record/record.js
const app = getApp();

Page({
  data: {
    selectedDate: '',
    calorieBudget: 0,
    consumedCalories: 0,
    remainingCalories: 0,
    loading: false
  },

  onLoad() {
    // 设置默认日期为今天
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
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
              url: '/pages/profile/profile'
            });
          }
        }
      });
    } else {
      // 已登录，直接使用本地数据
      this.loadDailyData();
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
    const bmr = this.calculateBMR(userInfo);
    console.log('基础代谢率:', bmr);
    
    // 获取当日卡路里汇总
    const summary = app.calculateDailyCalorieSummary(selectedDate);
    console.log('卡路里汇总:', summary);
    
    // 计算已摄入卡路里，保留2位小数
    const consumedCalories = parseFloat(summary.total_calories || 0);
    const consumedCaloriesFormatted = parseFloat(consumedCalories.toFixed(2));
    
    // 计算剩余卡路里，保留2位小数
    const remainingCalories = Math.max(0, bmr - consumedCaloriesFormatted);
    const remainingCaloriesFormatted = parseFloat(remainingCalories.toFixed(2));
    
    this.setData({
      calorieBudget: bmr,
      consumedCalories: consumedCaloriesFormatted,
      remainingCalories: remainingCaloriesFormatted,
      loading: false
    });
    
    console.log('页面数据已更新:', this.data);
  },

  // 计算基础代谢率 (BMR)
  calculateBMR(userInfo) {
    const { gender, age, height, weight } = userInfo;
    
    if (!gender || !age || !height || !weight) {
      // 用户没有设置身体数据时，返回1500作为基础值
      return 1500;
    }

    // Mifflin-St Jeor 公式
    let bmr;
    if (gender === 'male') {
      bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    return Math.round(bmr);
  },

  // 点击整个区域进入记录详情页面
  onTapRecordArea() {
    wx.navigateTo({
      url: '/pages/record/record-detail-list'
    });
  },

  // 添加记录
  addRecord() {
    wx.navigateTo({
      url: '/pages/record/add-record'
    });
  }
});