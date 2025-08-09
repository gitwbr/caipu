// pages/record/record-detail.js
const app = getApp();

Page({
  data: {
    food: null,
    quantity: '',
    recordTime: '',
    notes: '',
    isEdit: false,
    recordId: null,
    loading: false,
    calculatedNutrition: null, // 新增：用于存储计算后的营养值
    // 数字键盘相关数据
    keypadValue: '', // 当前键盘输入的值
    // 营养信息弹层
    showNutritionPanel: false,
    nutritionTitle: '',
    nutritionItems: []
  },

  onLoad(options) {
    console.log('record-detail onLoad, options:', options);
    console.log('current route:', getCurrentPages());
    
    // 设置默认时间为当前时间（不显示秒）
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5); // 只取 HH:MM 格式
    
    // 获取传递过来的日期，如果没有则使用当前日期
    let recordDate = options.date || new Date().toISOString().split('T')[0];
    
    // 确保日期格式为 YYYY-MM-DD
    if (recordDate && recordDate.includes('T')) {
      // 如果是ISO时间戳格式，提取日期部分
      recordDate = recordDate.split('T')[0];
    }
    
    this.setData({
      recordTime: timeStr,
      recordDate: recordDate // 保存传递过来的日期
    });

    // 检查是否是编辑模式
    if (options.id) {
      this.setData({
        isEdit: true,
        recordId: options.id
      });
      this.loadRecord(options.id);
    } else if (options.food) {
      // 新建记录模式 - 设置默认数量为100g
      try {
        const food = JSON.parse(decodeURIComponent(options.food));
        const origin = options.origin || '';
        this.setData({
          food: food,
          quantity: '100', // 新建记录默认100g
          keypadValue: '100' // 初始化键盘值
        });
        // 如果来源是最近(recent)，即使是自定义食物也不显示编辑按钮
        if (origin === 'recent' && food.type === 'custom') {
          this.setData({ hideCustomEdit: true });
        }
        
        // 计算默认营养值
        this.calculateNutrition('100');
      } catch (e) {
        console.error('解析食物数据失败:', e);
        wx.showToast({
          title: '数据错误',
          icon: 'error'
        });
        wx.navigateBack();
      }
    }
  },



  // 加载记录数据（编辑模式）
  loadRecord(id) {
    this.setData({ loading: true });
    
    // 从本地数据中查找记录
    let records = app.globalData.dietRecords || [];
    
    // 检查数据格式，确保是数组
    if (!Array.isArray(records)) {
      console.error('globalData.dietRecords不是数组，重置为空数组:', records);
      records = [];
    }
    
    const record = records.find(r => r.id == id);
    
    if (record) {
      // 获取食物信息
      let food;
      if (record.record_type === 'quick') {
        // 快速记录
        food = {
          type: 'quick',
          display_name: record.quick_food_name || '快速记录',
          display_energy_kcal: parseFloat(record.quick_energy_kcal) || 0,
          protein_g: parseFloat(record.quick_protein_g) || 0,
          fat_g: parseFloat(record.quick_fat_g) || 0,
          carbohydrate_g: parseFloat(record.quick_carbohydrate_g) || 0
        };
      } else if (record.food_id) {
        // 标准食物
        food = app.findFoodNutritionById(record.food_id);
        if (food) {
          // 初始化键盘值
          const quantity = record.quantity ? record.quantity.toString() : '100';
          this.setData({
            keypadValue: quantity
          });
          food.type = 'standard';
          food.display_name = food.food_name;
        }
      } else if (record.custom_food_id) {
        // 自定义食物
        food = app.findCustomFoodById(record.custom_food_id);
        if (food) {
          food.type = 'custom';
          food.display_name = food.food_name;
        }
      }
      
      if (food) {
        this.setData({
          food: food,
          quantity: record.quantity_g ? record.quantity_g.toString() : '',
          recordTime: record.record_time || '',
          notes: record.notes || '',
          loading: false
        });
        
        // 计算营养值
        if (record.quantity_g) {
          this.calculateNutrition(record.quantity_g.toString());
        }
      } else {
        console.error('未找到对应的食物信息');
        wx.showToast({
          title: '食物信息不存在',
          icon: 'error'
        });
        wx.navigateBack();
      }
    } else {
      console.error('未找到记录:', id);
      wx.showToast({
        title: '记录不存在',
        icon: 'error'
      });
      wx.navigateBack();
    }
  },

  // 数量输入处理
  onQuantityInput(e) {
    const value = e.detail.value;
    this.setData({
      quantity: value
    });
    
    // 实时计算营养值
    if (value && this.data.food) {
      this.calculateNutrition(value);
    }
  },

  // 计算营养值
  calculateNutrition(quantity) {
    if (!this.data.food || !quantity) {
      this.setData({ calculatedNutrition: null });
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      this.setData({ calculatedNutrition: null });
      return;
    }

    const food = this.data.food;
    const ratio = qty / 100; // 按100g比例计算

    const calculatedNutrition = {
      calories: (food.display_energy_kcal * ratio).toFixed(1),
      protein: food.protein_g !== undefined ? (food.protein_g * ratio).toFixed(1) : '0.0',
      fat: food.fat_g !== undefined ? (food.fat_g * ratio).toFixed(1) : '0.0',
      carbohydrate: food.carbohydrate_g !== undefined ? (food.carbohydrate_g * ratio).toFixed(1) : '0.0'
    };

    this.setData({ calculatedNutrition });
  },

  // 时间选择
  onTimeChange(e) {
    this.setData({
      recordTime: e.detail.value
    });
  },

  // 备注输入
  onNotesInput(e) {
    this.setData({
      notes: e.detail.value
    });
  },

  // 保存记录
  saveRecord() {
    if (!this.data.food) {
      wx.showToast({
        title: '请选择食物',
        icon: 'error'
      });
      return;
    }

    if (this.data.food.type !== 'quick' && !this.data.keypadValue && !this.data.quantity) {
      wx.showToast({
        title: '请输入数量',
        icon: 'error'
      });
      return;
    }

    this.setData({ loading: true });

    const recordData = {
      food_id: this.data.food.type === 'standard' ? this.data.food.id : null,
      custom_food_id: this.data.food.type === 'custom' ? this.data.food.id : null,
      quantity_g: this.data.food.type !== 'quick' ? parseFloat(this.data.keypadValue || this.data.quantity) : 0,
      record_time: this.data.recordTime,
      notes: this.data.notes,
      record_date: this.data.recordDate,
      record_type: this.data.food.type === 'quick' ? 'quick' : 'standard'
    };

    if (this.data.food.type === 'quick') {
      recordData.quick_food_name = this.data.food.display_name;
      recordData.quick_energy_kcal = this.data.food.display_energy_kcal;
      recordData.quick_protein_g = this.data.food.protein_g;
      recordData.quick_fat_g = this.data.food.fat_g;
      recordData.quick_carbohydrate_g = this.data.food.carbohydrate_g;
    }

    const doAfter = (resultRecord) => {
      // 重新计算当日热量
      app.calculateDailyCalorieSummary(this.data.recordDate);
      wx.showToast({
        title: this.data.isEdit ? '更新成功' : '保存成功',
        icon: 'success'
      });
      setTimeout(() => {
        // 返回并跳转到记录列表页（按需求直达当天列表）
        const targetDate = this.data.recordDate;
        const highlightId = (resultRecord && resultRecord.id) ? resultRecord.id : (this.data.recordId || '');
        const url = `/pages/record/record-detail-list?date=${encodeURIComponent(targetDate)}&highlightId=${encodeURIComponent(highlightId)}`;
        wx.redirectTo({ url }).catch(() => {
          // 兜底：若 redirectTo 失败则尝试 navigateTo
          wx.navigateTo({ url });
        });
      }, 800);
    };

    if (this.data.isEdit) {
      app.updateDietRecordWithSync(this.data.recordId, recordData)
        .then((updated) => doAfter(updated))
        .catch((err) => {
          console.error('更新失败:', err);
          wx.showToast({ title: '更新失败', icon: 'error' });
        })
        .finally(() => this.setData({ loading: false }));
    } else {
      app.addDietRecordWithSync(recordData)
        .then((created) => doAfter(created))
        .catch((err) => {
          console.error('保存失败:', err);
          wx.showToast({ title: '保存失败', icon: 'error' });
        })
        .finally(() => this.setData({ loading: false }));
    }
  },

  // 点击食物卡片，展示食物营养信息（标准/自定义）
  showFoodNutrition() {
    const foodLocal = this.data.food;
    if (!foodLocal) return;
    // 快速记录不展示完整营养面板
    if (foodLocal.type === 'quick') {
      wx.showToast({ title: '快速记录不含完整营养信息', icon: 'none' });
      return;
    }

    // 优先通过 id 精准查找（标准: food_id，自定义: custom_food_id）
    const recordId = this.data.recordId;
    let foodId = foodLocal.type === 'standard' ? foodLocal.id : null;
    let customFoodId = foodLocal.type === 'custom' ? foodLocal.id : null;
    if ((!foodId && !customFoodId) && recordId) {
      const rec = (app.globalData.dietRecords || []).find(r => r.id == recordId);
      if (rec) {
        if (rec.food_id) foodId = rec.food_id;
        if (rec.custom_food_id) customFoodId = rec.custom_food_id;
      }
    }

    const foodStd = foodId ? app.findFoodNutritionById(foodId) : null;
    const foodCustom = (!foodStd && customFoodId) ? app.findCustomFoodById(customFoodId) : null;
    const info = foodStd || foodCustom || {
      food_name: foodLocal.display_name,
      energy_kcal: foodLocal.display_energy_kcal,
      protein_g: foodLocal.protein_g,
      fat_g: foodLocal.fat_g,
      carbohydrate_g: foodLocal.carbohydrate_g
    };

    if (!info) {
      wx.showToast({ title: '未找到营养数据', icon: 'none' });
      return;
    }

    const items = [];
    const push = (label, val, unit = '', decimals = 1) => {
      if (val === undefined || val === null || val === '') return;
      const num = Number(val);
      items.push({ label, value: isNaN(num) ? val : num.toFixed(decimals), unit });
    };

    // 宏量营养素（每100g）
    push('能量', info.energy_kcal, ' kcal/100g');
    push('蛋白质', info.protein_g, ' g');
    push('脂肪', info.fat_g, ' g');
    push('碳水化合物', info.carbohydrate_g, ' g');
    push('膳食纤维', info.fiber_g, ' g');
    push('水分', info.moisture_g, ' g');

    // 矿物质（每100g）
    push('钠', info.na_mg, ' mg');
    push('钙', info.ca_mg, ' mg');
    push('铁', info.fe_mg, ' mg');

    // 胆固醇（每100g）
    push('胆固醇', info.cholesterol_mg, ' mg');

    // 维生素（每100g）
    push('维生素A', info.vitamin_a_ug, ' µg', 0);
    push('维生素B1', info.vitamin_b1_mg, ' mg');
    push('维生素B2', info.vitamin_b2_mg, ' mg');
    push('维生素B3', info.vitamin_b3_mg, ' mg');
    push('维生素C', info.vitamin_c_mg, ' mg');
    push('维生素E', info.vitamin_e_mg, ' mg');

    this.setData({
      nutritionTitle: info.food_name || foodLocal.display_name || '营养信息',
      nutritionItems: items,
      showNutritionPanel: true
    });
  },

  closeNutritionPanel() {
    this.setData({ showNutritionPanel: false });
  },

  // 删除记录
  deleteRecord() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ loading: true });
          app.deleteDietRecordWithSync(this.data.recordId)
            .then(() => {
              app.calculateDailyCalorieSummary(this.data.recordDate);
              wx.showToast({ title: '删除成功', icon: 'success' });
              setTimeout(() => { wx.navigateBack(); }, 1000);
            })
            .catch((err) => {
              console.error('删除失败:', err);
              wx.showToast({ title: '删除失败', icon: 'error' });
            })
            .finally(() => this.setData({ loading: false }));
        }
      }
    });
  },

  // 编辑自定义食物
  editCustomFood(e) {
    const food = e.currentTarget.dataset.food;
    const foodStr = encodeURIComponent(JSON.stringify(food));
    wx.navigateTo({
      url: `/pages/record/add-custom-food?food=${foodStr}&isEdit=true`
    });
  },

  // 数字键盘事件处理
  onKeypadInput(e) {
    const value = e.currentTarget.dataset.value;
    let currentValue = this.data.keypadValue;
    
    // 如果是数字或小数点
    if (value >= '0' && value <= '9' || value === '.') {
      // 如果是小数点，检查是否已经存在
      if (value === '.' && currentValue.includes('.')) {
        return; // 已有小数点，忽略
      }
      
      // 如果是第一个字符且是小数点，在前面加0
      if (value === '.' && currentValue === '') {
        currentValue = '0';
      }
      
      // 限制总长度（包括小数点）
      if (currentValue.length >= 6) {
        return;
      }
      
      currentValue += value;
    }
    
    this.setData({
      keypadValue: currentValue,
      quantity: currentValue
    });
    
    // 如果有值，计算营养值
    if (currentValue && parseFloat(currentValue) > 0) {
      this.calculateNutrition(currentValue);
    } else {
      this.setData({
        calculatedNutrition: null
      });
    }
  },

  // 清空按钮
  onKeypadClear() {
    this.setData({
      keypadValue: '',
      quantity: '',
      calculatedNutrition: null
    });
  },



});