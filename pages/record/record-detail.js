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
    calculatedNutrition: null // 新增：用于存储计算后的营养值
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
        this.setData({
          food: food,
          quantity: '100' // 新建记录默认100g
        });
        
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
          food.type = 'standard';
          food.display_name = food.food_name;
          food.display_energy_kcal = food.energy_kcal;
        }
      } else if (record.custom_food_id) {
        // 自定义食物
        food = app.findCustomFoodById(record.custom_food_id);
        if (food) {
          food.type = 'custom';
          food.display_name = food.food_name;
          food.display_energy_kcal = food.energy_kcal;
        }
      }

      // 确保日期格式为 YYYY-MM-DD
      let recordDate = record.record_date;
      if (recordDate && typeof recordDate === 'string' && recordDate.includes('T')) {
        // 如果是ISO时间戳格式，提取日期部分
        recordDate = recordDate.split('T')[0];
      }

      this.setData({
        food: food,
        quantity: record.record_type === 'quick' ? '0' : record.quantity_g.toString(),
        recordTime: record.record_time ? record.record_time.substring(0, 5) : record.record_time, // 不显示秒
        recordDate: recordDate, // 添加记录日期
        notes: record.notes || '',
        loading: false
      });
      
      // 计算营养值（快速记录不需要计算，直接使用记录的值）
      if (record.record_type === 'quick') {
        this.setData({
          calculatedNutrition: {
            calories: (parseFloat(record.quick_energy_kcal) || 0).toFixed(1),
            protein: (parseFloat(record.quick_protein_g) || 0).toFixed(1),
            fat: (parseFloat(record.quick_fat_g) || 0).toFixed(1),
            carbohydrate: (parseFloat(record.quick_carbohydrate_g) || 0).toFixed(1)
          }
        });
      } else {
        this.calculateNutrition(record.quantity_g.toString());
      }
    } else {
      wx.showToast({
        title: '记录不存在',
        icon: 'error'
      });
      wx.navigateBack();
    }
  },

  // 数量输入
  onQuantityInput(e) {
    const quantity = e.detail.value;
    this.setData({
      quantity: quantity
    });
    
    // 计算营养值并格式化
    this.calculateNutrition(quantity);
  },

  // 计算营养值
  calculateNutrition(quantity) {
    if (!this.data.food || !quantity) {
      this.setData({
        calculatedNutrition: null
      });
      return;
    }

    const qty = parseFloat(quantity) || 0;
    const food = this.data.food;
    
    const calculatedNutrition = {
      calories: ((food.display_energy_kcal * qty / 100) || 0).toFixed(1),
      protein: ((food.protein_g * qty / 100) || 0).toFixed(1),
      fat: ((food.fat_g * qty / 100) || 0).toFixed(1),
      carbohydrate: ((food.carbohydrate_g * qty / 100) || 0).toFixed(1)
    };

    this.setData({
      calculatedNutrition: calculatedNutrition
    });
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
    const { food, quantity, recordTime, notes, isEdit, recordId, recordDate } = this.data;

    if (!food) {
      wx.showToast({
        title: '食物信息缺失',
        icon: 'error'
      });
      return;
    }

    // 快速记录不需要验证数量
    if (food.type !== 'quick' && (!quantity || parseFloat(quantity) <= 0)) {
      wx.showToast({
        title: '请输入有效数量',
        icon: 'error'
      });
      return;
    }

    this.setData({ loading: true });

    const recordData = {
      record_time: recordTime,
      notes: notes,
      record_date: recordDate // 使用传递过来的日期
    };

    // 根据食物类型设置不同的字段
    if (food.type === 'quick') {
      // 快速记录
      recordData.record_type = 'quick';
      recordData.quick_food_name = food.display_name;
      recordData.quick_energy_kcal = food.display_energy_kcal;
      recordData.quick_protein_g = food.protein_g;
      recordData.quick_fat_g = food.fat_g;
      recordData.quick_carbohydrate_g = food.carbohydrate_g;
      recordData.quantity_g = 0; // 快速记录数量为0
    } else if (food.type === 'standard') {
      // 标准食物
      recordData.food_id = food.id;
      recordData.quantity_g = parseFloat(quantity);
    } else {
      // 自定义食物
      recordData.custom_food_id = food.id;
      recordData.quantity_g = parseFloat(quantity);
    }

    console.log('保存记录数据:', recordData);

    const savePromise = isEdit 
      ? app.updateDietRecordWithSync(recordId, recordData)
      : app.addDietRecordWithSync(recordData);

    savePromise.then(() => {
      wx.showToast({
        title: isEdit ? '更新成功' : '保存成功',
        icon: 'success'
      });
      
      // 延迟跳转，确保Toast显示完成
      setTimeout(() => {
        // 跳转到记录详情页面，传递当前选择的日期
        wx.redirectTo({
          url: `/pages/record/record-detail-list?date=${recordDate}`,
          fail: () => {
            // 如果redirectTo失败，尝试navigateTo
            wx.navigateTo({
              url: `/pages/record/record-detail-list?date=${recordDate}`,
              fail: () => {
                // 最后的备选方案，返回上一页
                wx.navigateBack();
              }
            });
          }
        });
      }, 1500); // 延迟1.5秒跳转
    }).catch(err => {
      wx.showToast({
        title: isEdit ? '更新失败' : '保存失败',
        icon: 'error'
      });
      console.error('保存记录失败:', err);
    }).finally(() => {
      this.setData({ loading: false });
    });
  },

  // 删除记录
  deleteRecord() {
    if (!this.data.isEdit) {
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ loading: true });
          
          app.deleteDietRecordWithSync(this.data.recordId).then(() => {
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            });
            
            // 延迟跳转，确保Toast显示完成
            setTimeout(() => {
              // 跳转到记录详情页面，传递当前选择的日期
              wx.redirectTo({
                url: `/pages/record/record-detail-list?date=${this.data.recordDate}`,
                fail: () => {
                  // 如果redirectTo失败，尝试navigateTo
                  wx.navigateTo({
                    url: `/pages/record/record-detail-list?date=${this.data.recordDate}`,
                    fail: () => {
                      // 最后的备选方案，返回上一页
                      wx.navigateBack();
                    }
                  });
                }
              });
            }, 1500); // 延迟1.5秒跳转
          }).catch(err => {
            wx.showToast({
              title: '删除失败',
              icon: 'error'
            });
            console.error('删除记录失败:', err);
          }).finally(() => {
            this.setData({ loading: false });
          });
        }
      }
    });
  }
});