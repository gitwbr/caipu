// pages/record/record-detail-list.js
const app = getApp();

Page({
  data: {
    selectedDate: '',
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    calendarDays: [],
    showCalendar: false,
    formattedDate: '',
    weekdayText: '',
    calorieBudget: 0,
    consumedCalories: 0,
    remainingCalories: 0,
    records: [],
    loading: false
  },

  onLoad(options) {
    console.log('record-detail-list onLoad, options:', options);
    
    // 获取传递过来的日期，如果没有则使用今天
    const selectedDate = options.date || new Date().toISOString().split('T')[0];
    
    // 解析当前年月
    const dateParts = selectedDate.split('-');
    const currentYear = parseInt(dateParts[0]);
    const currentMonth = parseInt(dateParts[1]);
    
    this.setData({
      selectedDate: selectedDate,
      currentYear: currentYear,
      currentMonth: currentMonth
    });
    
    console.log('设置的日期:', selectedDate);
    this.formatDateDisplay();
    this.generateCalendar();
  },

  // 返回上一页
  goBack() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({
          url: '/pages/record/record'
        });
      }
    });
  },

  // 格式化日期显示
  formatDateDisplay() {
    console.log('=== 格式化日期调试 ===');
    console.log('当前selectedDate:', this.data.selectedDate);
    
    // 使用本地时间处理，避免时区问题
    const dateParts = this.data.selectedDate.split('-');
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]);
    const day = parseInt(dateParts[2]);
    
    console.log('解析的年份:', year);
    console.log('解析的月份:', month);
    console.log('解析的日期:', day);
    
    const date = new Date(year, month - 1, day); // 月份要减1，因为Date构造函数月份从0开始
    console.log('创建的Date对象:', date);
    console.log('Date对象本地时间:', date.toLocaleString());
    console.log('Date对象月份:', date.getMonth() + 1);
    console.log('Date对象日期:', date.getDate());
    console.log('Date对象星期:', date.getDay());
    
    const monthStr = (date.getMonth() + 1).toString().padStart(2, '0');
    const dayStr = date.getDate().toString().padStart(2, '0');
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[date.getDay()];
    
    console.log('格式化后的月份:', monthStr);
    console.log('格式化后的日期:', dayStr);
    console.log('格式化后的星期:', weekday);
    
    this.setData({
      formattedDate: `${monthStr}/${dayStr}`,
      weekdayText: weekday
    });
    
    console.log('设置后的formattedDate:', `${monthStr}/${dayStr}`);
    console.log('设置后的weekdayText:', weekday);
  },

  // 显示日历
  showCalendar() {
    this.setData({ showCalendar: true });
  },

  // 隐藏日历
  hideCalendar() {
    this.setData({ showCalendar: false });
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
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

  // 从云端同步数据（已废弃，改为登录时一次性获取）
  syncDataFromCloud() {
    // 这个方法现在不需要了，因为登录时已经获取了所有数据
    console.log('直接使用本地数据，无需同步');
    this.loadDailyData();
  },

  // 加载指定日期的数据
  loadDailyData() {
    const { selectedDate } = this.data;
    this.setData({ loading: true });

    console.log('=== 记录详情页面数据调试 ===');
    console.log('当前日期:', selectedDate);
    
    // 获取用户基础代谢率
    const userInfo = wx.getStorageSync('userInfo') || {};
    console.log('用户信息:', userInfo);
    const bmr = userInfo.bmr || 1500; // 直接使用存储的BMR
    console.log('基础代谢率:', bmr);
    
    // 获取当日卡路里汇总
    const summary = app.calculateDailyCalorieSummary(selectedDate);
    console.log('卡路里汇总:', summary);
    
    // 直接从本地获取所有记录
    let allRecords = app.globalData.dietRecords || [];
    
    // 检查数据格式，确保是数组
    if (!Array.isArray(allRecords)) {
      console.error('globalData.dietRecords不是数组:', allRecords);
      allRecords = [];
    }
    
    console.log('本地所有记录数量:', allRecords.length);
    
    // 筛选指定日期的记录
    const dailyRecords = allRecords.filter(record => {
      // 检查record_date是否存在
      if (!record.record_date) {
        console.log(`记录${record.id}的record_date为undefined或null，跳过`);
        return false;
      }
      
      // 处理不同的日期格式
      let recordDate;
      if (typeof record.record_date === 'string') {
        if (record.record_date.includes('T')) {
          // ISO格式: "2025-08-01T00:00:00.000Z"
          recordDate = record.record_date.split('T')[0];
        } else {
          // 简单格式: "2025-08-01"
          recordDate = record.record_date;
        }
      } else if (record.record_date instanceof Date) {
        // Date对象
        recordDate = record.record_date.toISOString().split('T')[0];
      } else {
        console.log(`记录${record.id}的record_date格式未知:`, record.record_date);
        return false;
      }
      
      const isMatch = recordDate === selectedDate;
      if (isMatch) {
        console.log(`找到匹配记录: ${record.id}, 日期: ${recordDate}`);
      }
      return isMatch;
    });
    
    console.log(`日期 ${selectedDate} 的记录数量:`, dailyRecords.length);
    
    // 获取食物信息并格式化记录
    const formattedRecords = dailyRecords.map(record => {
      let foodInfo = null;
      
      if (record.food_id) {
        // 标准食物
        foodInfo = app.findFoodNutritionById(record.food_id);
      } else if (record.custom_food_id) {
        // 自定义食物
        foodInfo = app.findCustomFoodById(record.custom_food_id);
      }
      
      // 计算卡路里
      const calculatedCalories = foodInfo && record.quantity_g 
        ? ((foodInfo.energy_kcal * record.quantity_g / 100) || 0).toFixed(1)
        : '0.0';
      
      return {
        ...record,
        food_name: foodInfo ? foodInfo.food_name : '未知食物',
        energy_kcal: foodInfo ? foodInfo.energy_kcal : 0,
        calculated_calories: calculatedCalories
      };
    });
    
    console.log('格式化后的记录:', formattedRecords);
    
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
      records: formattedRecords,
      loading: false
    });
    
    console.log('页面数据已更新:', this.data);
  },

  // 生成日历数据
  generateCalendar() {
    const { currentYear, currentMonth } = this.data;
    console.log('生成日历 - 年份:', currentYear, '月份:', currentMonth);
    
    // 获取当月第一天是星期几
    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const firstDayWeek = firstDayOfMonth.getDay(); // 0是周日，1是周一...
    
    // 获取当月总天数
    const lastDayOfMonth = new Date(currentYear, currentMonth, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    
    console.log('当月第一天星期:', firstDayWeek);
    console.log('当月总天数:', daysInMonth);
    
    const calendarDays = [];
    const today = new Date();
    
    // 计算上个月需要显示的天数
    const prevMonthDays = firstDayWeek;
    
    // 生成日历数据
    let dayCount = 1;
    let nextMonthDay = 1;
    
    for (let week = 0; week < 6; week++) {
      for (let day = 0; day < 7; day++) {
        let currentDay, isOtherMonth, dateStr;
        
        if (week === 0 && day < firstDayWeek) {
          // 上个月的天数
          const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
          const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
          const prevMonthLastDay = new Date(prevYear, prevMonth, 0).getDate();
          currentDay = prevMonthLastDay - firstDayWeek + day + 1;
          isOtherMonth = true;
          dateStr = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-${currentDay.toString().padStart(2, '0')}`;
        } else if (dayCount <= daysInMonth) {
          // 当月的天数
          currentDay = dayCount;
          isOtherMonth = false;
          dateStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${currentDay.toString().padStart(2, '0')}`;
          dayCount++;
        } else {
          // 下个月的天数
          const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
          const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
          currentDay = nextMonthDay;
          isOtherMonth = true;
          dateStr = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-${currentDay.toString().padStart(2, '0')}`;
          nextMonthDay++;
        }
        
        const isSelected = dateStr === this.data.selectedDate;
        
        // 格式化今天的日期
        const todayYear = today.getFullYear();
        const todayMonth = (today.getMonth() + 1).toString().padStart(2, '0');
        const todayDay = today.getDate().toString().padStart(2, '0');
        const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;
        const isToday = dateStr === todayStr;
        
        // 检查是否有记录
        const hasRecord = this.checkHasRecord(dateStr);
        
        calendarDays.push({
          date: dateStr,
          day: currentDay,
          isOtherMonth: isOtherMonth,
          isSelected: isSelected,
          isToday: isToday,
          hasRecord: hasRecord
        });
      }
    }
    
    console.log('生成的日历数据:', calendarDays);
    this.setData({ calendarDays });
  },

  // 检查指定日期是否有记录
  checkHasRecord(dateStr) {
    const records = app.globalData.dietRecords || [];
    return records.some(record => {
      if (!record.record_date) return false;
      let recordDate;
      if (typeof record.record_date === 'string') {
        if (record.record_date.includes('T')) {
          recordDate = record.record_date.split('T')[0];
        } else {
          recordDate = record.record_date;
        }
      } else if (record.record_date instanceof Date) {
        recordDate = record.record_date.toISOString().split('T')[0];
      } else {
        return false;
      }
      return recordDate === dateStr;
    });
  },

  // 选择日期
  selectDate(e) {
    const { date } = e.currentTarget.dataset;
    console.log('=== 日期选择调试 ===');
    console.log('传入的日期:', date);
    console.log('传入日期类型:', typeof date);
    
    const dateObj = new Date(date);
    console.log('Date对象:', dateObj);
    console.log('Date对象本地时间:', dateObj.toLocaleString());
    console.log('Date对象ISO时间:', dateObj.toISOString());
    console.log('Date对象本地日期:', dateObj.toLocaleDateString());
    
    this.setData({ 
      selectedDate: date,
      showCalendar: false
    });
    
    console.log('设置后的selectedDate:', this.data.selectedDate);
    this.formatDateDisplay();
    this.generateCalendar();
    this.loadDailyData();
  },

  // 上个月
  prevMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 1) {
      currentYear--;
      currentMonth = 12;
    } else {
      currentMonth--;
    }
    
    this.setData({ currentYear, currentMonth });
    this.generateCalendar();
  },

  // 下个月
  nextMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 12) {
      currentYear++;
      currentMonth = 1;
    } else {
      currentMonth++;
    }
    
    this.setData({ currentYear, currentMonth });
    this.generateCalendar();
  },

  // 日期选择器变化
  onDateChange(e) {
    console.log('日期选择:', e.detail.value);
    this.setData({
      selectedDate: e.detail.value
    });
    console.log('切换到日期:', e.detail.value);
    this.loadDailyData();
  },

  // 添加记录
  addRecord() {
    wx.navigateTo({
      url: '/pages/record/add-record'
    });
  },

  // 点击记录项
  onRecordTap(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/record/record-detail?id=${id}`
    });
  },

  // 删除记录
  deleteRecord(e) {
    const { id } = e.currentTarget.dataset;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      success: (res) => {
        if (res.confirm) {
          app.deleteDietRecordWithSync(id).then(() => {
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            });
            this.loadDailyData();
          }).catch(err => {
            wx.showToast({
              title: '删除失败',
              icon: 'error'
            });
            console.error('删除记录失败:', err);
          });
        }
      }
    });
  }
}); 