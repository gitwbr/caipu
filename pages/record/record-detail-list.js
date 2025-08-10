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
    exerciseCalories: 0,
    totalProtein: 0,
    totalFat: 0,
    totalCarbs: 0,
    ringSize: 180,
    records: [],
    loading: false,
    _dateHasRecordMap: null
  },

  onLoad(options) {
    console.log('record-detail-list onLoad, options:', options);
    
    // 获取传递过来的日期与高亮ID，如果没有则使用今天
    let selectedDate = options.date || new Date().toISOString().split('T')[0];
    this.highlightId = options.highlightId ? String(options.highlightId) : '';
    
    // 确保日期格式为 YYYY-MM-DD
    if (selectedDate && selectedDate.includes('T')) {
      // 如果是ISO时间戳格式，提取日期部分
      selectedDate = selectedDate.split('T')[0];
    }
    
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
    
    // 确保日期格式正确
    let dateStr = this.data.selectedDate;
    if (dateStr && dateStr.includes('T')) {
      // 如果是ISO时间戳格式，提取日期部分
      dateStr = dateStr.split('T')[0];
    }
    
    // 使用本地时间处理，避免时区问题
    const dateParts = dateStr.split('-');
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
    // 将记录按时间倒序（record_time 降序），同时间则按创建时间/ID倒序
    dailyRecords.sort((a, b) => {
      const ta = (a.record_time || '').slice(0,5);
      const tb = (b.record_time || '').slice(0,5);
      if (ta && tb) {
        if (ta > tb) return -1;
        if (ta < tb) return 1;
      }
      // 次级排序：created_at 或 id
      const ca = a.created_at || a.id || 0;
      const cb = b.created_at || b.id || 0;
      return String(cb).localeCompare(String(ca));
    });
    
    // 获取食物信息并格式化记录
    const formattedRecords = dailyRecords.map(record => {
      let foodInfo = null;
      let calculatedCalories = '0.0';
      let imageUrl = '';
      
      if (record.record_type === 'quick') {
        // 快速记录
        foodInfo = {
          food_name: record.quick_food_name || '快速记录',
          energy_kcal: parseFloat(record.quick_energy_kcal) || 0,
          protein_g: parseFloat(record.quick_protein_g) || 0,
          fat_g: parseFloat(record.quick_fat_g) || 0,
          carbohydrate_g: parseFloat(record.quick_carbohydrate_g) || 0
        };
        // 快速记录直接使用记录的热量，不需要计算
        calculatedCalories = (parseFloat(record.quick_energy_kcal) || 0).toFixed(1);
        // 快速记录图片直接来自记录表
        imageUrl = record.quick_image_url ? app.buildImageUrl(record.quick_image_url) : '';
      } else if (record.food_id) {
        // 标准食物
        foodInfo = app.findFoodNutritionById(record.food_id);
        if (foodInfo && record.quantity_g) {
          calculatedCalories = ((foodInfo.energy_kcal * record.quantity_g / 100) || 0).toFixed(1);
        }
        if (foodInfo && foodInfo.image_url) {
          imageUrl = app.buildImageUrl(foodInfo.image_url);
        }
      } else if (record.custom_food_id) {
        // 自定义食物
        foodInfo = app.findCustomFoodById(record.custom_food_id);
        if (foodInfo && record.quantity_g) {
          calculatedCalories = ((foodInfo.energy_kcal * record.quantity_g / 100) || 0).toFixed(1);
        }
        if (foodInfo && foodInfo.image_url) {
          imageUrl = app.buildImageUrl(foodInfo.image_url);
        }
      }
      
      return {
        ...record,
        food_name: foodInfo ? foodInfo.food_name : '未知食物',
        energy_kcal: foodInfo ? foodInfo.energy_kcal : 0,
        protein_g: foodInfo ? foodInfo.protein_g : 0,
        fat_g: foodInfo ? foodInfo.fat_g : 0,
        carbohydrate_g: foodInfo ? foodInfo.carbohydrate_g : 0,
        calculated_calories: calculatedCalories,
        image_full_url: imageUrl,
        record_type_display: record.record_type === 'quick' ? '快速记录' : 
                            record.record_type === 'custom' ? '自定义' : '标准'
      };
    });
    
    console.log('格式化后的记录:', formattedRecords);
    
    // 计算已摄入卡路里，保留2位小数
    const consumedCalories = parseFloat(summary.total_calories || 0);
    const consumedCaloriesFormatted = parseFloat(consumedCalories.toFixed(2));

    // 计算剩余卡路里，保留2位小数
    const remainingCalories = Math.max(0, bmr - consumedCaloriesFormatted);
    const remainingCaloriesFormatted = parseFloat(remainingCalories.toFixed(2));

    // 统计宏量营养素总摄入
    let totalProtein = 0, totalFat = 0, totalCarbs = 0;
    for (const r of dailyRecords) {
      if (r.record_type === 'quick') {
        totalProtein += parseFloat(r.quick_protein_g || 0);
        totalFat += parseFloat(r.quick_fat_g || 0);
        totalCarbs += parseFloat(r.quick_carbohydrate_g || 0);
      } else if (r.food_id) {
        const f = app.findFoodNutritionById(r.food_id);
        if (f && r.quantity_g) {
          const ratio = r.quantity_g / 100;
          totalProtein += (parseFloat(f.protein_g || 0) * ratio);
          totalFat += (parseFloat(f.fat_g || 0) * ratio);
          totalCarbs += (parseFloat(f.carbohydrate_g || 0) * ratio);
        }
      } else if (r.custom_food_id) {
        const f = app.findCustomFoodById(r.custom_food_id);
        if (f && r.quantity_g) {
          const ratio = r.quantity_g / 100;
          totalProtein += (parseFloat(f.protein_g || 0) * ratio);
          totalFat += (parseFloat(f.fat_g || 0) * ratio);
          totalCarbs += (parseFloat(f.carbohydrate_g || 0) * ratio);
        }
      }
    }
    totalProtein = parseFloat(totalProtein.toFixed(1));
    totalFat = parseFloat(totalFat.toFixed(1));
    totalCarbs = parseFloat(totalCarbs.toFixed(1));

    this.setData({
      calorieBudget: bmr,
      consumedCalories: consumedCaloriesFormatted,
      remainingCalories: remainingCaloriesFormatted,
      records: formattedRecords,
      totalProtein,
      totalFat,
      totalCarbs,
      loading: false
    }, () => {
      // 在页面渲染完成后再绘制
      setTimeout(() => this.drawRing(consumedCaloriesFormatted, bmr), 50);
      if (this.highlightId) {
        const idStr = this.highlightId;
        const exists = this.data.records.some(r => String(r.id) === idStr);
        if (exists) {
          this.setData({ highlightId: idStr }, () => {
            // 平滑滚动到高亮项
            wx.pageScrollTo({ selector: `#rec-${idStr}`, duration: 300, offsetTop: 0 });
          });
        } else {
          this.highlightId = '';
        }
      }
    });
    
    console.log('页面数据已更新:', this.data);
  },

  // 绘制中间圆环
  drawRing(consumed, target) {
    try {
      const ctx = wx.createCanvasContext('ringCanvas', this);
      console.log('[ring] draw start', { consumed, target, size: this.data.ringSize });
      const size = this.data.ringSize || 180; // 与 wxml width/height 一致
      const dpr = wx.getSystemInfoSync().pixelRatio || 1;
      // 适配高分屏：按像素比缩放坐标系
      ctx.scale(1, 1);
      const center = size / 2;
      const radius = center - 10;
      ctx.clearRect(0, 0, size, size);
      ctx.setLineWidth(10);
      ctx.setStrokeStyle('#eeeeee');
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.stroke();
      const percent = target > 0 ? Math.min(consumed / target, 1) : 0;
      const remaining = (target || 0) - (consumed || 0);
      const progressColor = remaining <= 0 ? '#ff6b6b' : '#4ecdc4';
      ctx.setLineCap('round');
      ctx.setStrokeStyle(progressColor);
      ctx.beginPath();
      ctx.arc(center, center, radius, -Math.PI/2, -Math.PI/2 + Math.PI * 2 * percent, false);
      ctx.stroke();
      ctx.draw(false, () => {
        console.log('[ring] draw done');
      });
    } catch (e) {
      console.error('[ring] draw error', e);
    }
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
    // 构建当月日期 -> 是否有记录 的缓存，避免每格遍历全量记录
    const dateToHasRecord = this._buildDateHasRecordMap(currentYear, currentMonth);
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
        
        // 从缓存获取是否有记录
        const hasRecord = !!dateToHasRecord[dateStr];
        
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

  // 生成某年某月的“日期是否有记录”缓存表
  _buildDateHasRecordMap(year, month) {
    const cacheKey = `${year}-${month}`;
    if (this.data._dateHasRecordMap && this.data._dateHasRecordMap.key === cacheKey) {
      return this.data._dateHasRecordMap.map;
    }
    const map = Object.create(null);
    const records = app.globalData.dietRecords || [];
    for (const record of records) {
      if (!record.record_date) continue;
      let d;
      if (typeof record.record_date === 'string') {
        d = record.record_date.includes('T') ? record.record_date.split('T')[0] : record.record_date;
      } else if (record.record_date instanceof Date) {
        d = record.record_date.toISOString().split('T')[0];
      } else {
        continue;
      }
      // 仅缓存该月的
      if (d.startsWith(`${year}-${String(month).padStart(2,'0')}-`)) {
        map[d] = true;
      }
    }
    this.setData({ _dateHasRecordMap: { key: cacheKey, map } });
    return map;
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
    const date = this.data.selectedDate || new Date().toISOString().split('T')[0];
    wx.navigateTo({ url: `/pages/record/add-record?date=${encodeURIComponent(date)}` });
  },

  // 记录运动 → 跳转到添加运动记录页
  addExercise() {
    const date = this.data.selectedDate || new Date().toISOString().split('T')[0];
    wx.navigateTo({ url: `/pages/exercise/add-exercise?date=${encodeURIComponent(date)}` });
  },

  // 快速记录
  // quickRecord 功能仅保留在其它页面，此页移除

  // 点击记录项
  onRecordTap(e) {
    const { id } = e.currentTarget.dataset;
    const rec = (this.data.records || []).find(r => String(r.id) === String(id));
    if (rec && rec.record_type === 'quick') {
      //wx.showToast({ title: '快速记录不可编辑', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/record/record-detail?id=${id}` });
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