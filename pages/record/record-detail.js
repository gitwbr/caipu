// pages/record/record-detail.js
const app = getApp();

Page({
  data: {
    food: null,
    quantity: '',
    quantityUnit: 'g',
    recordDate: '',
    recordTime: '',
    notes: '',
    isEdit: false,
    recordId: null,
    loading: false,
    calculatedNutrition: null,
    keypadValue: '',
    showNutritionPanel: false,
    nutritionTitle: '',
    nutritionItems: [],
    hideCustomEdit: false
  },

  onLoad(options) {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);
    const recordDate = app.toLocalYMD(options.date || new Date());

    this.setData({ recordTime: timeStr, recordDate });
    try {
      wx.setNavigationBarTitle({ title: recordDate });
    } catch (_) {}

    if (options.id) {
      this.setData({
        isEdit: true,
        recordId: options.id
      });
      this.loadRecord(options.id);
      return;
    }

    if (!options.food) {
      return;
    }

    try {
      const rawFood = JSON.parse(decodeURIComponent(options.food));
      const food = app.decorateFoodForDisplay(rawFood, rawFood.type);
      const origin = options.origin || '';
      const quantityUnit = app.getFoodBasisUnit(food);
      this.setData({
        food,
        quantity: food.type === 'quick' ? '' : '100',
        keypadValue: food.type === 'quick' ? '' : '100',
        quantityUnit,
        hideCustomEdit: origin === 'recent' && food.type === 'custom'
      });
      if (food.type !== 'quick') {
        this.calculateNutrition('100');
      } else {
        this.calculateNutrition('');
      }
    } catch (error) {
      console.error('解析食物数据失败:', error);
      wx.showToast({
        title: '数据错误',
        icon: 'error'
      });
      wx.navigateBack();
    }
  },

  loadRecord(id) {
    this.setData({ loading: true });
    const records = Array.isArray(app.globalData.dietRecords) ? app.globalData.dietRecords : [];
    const record = app.normalizeDietRecord(records.find(r => String(r.id) === String(id)));

    if (!record) {
      wx.showToast({ title: '记录不存在', icon: 'error' });
      wx.navigateBack();
      return;
    }

    let food = null;
    if (record.record_type === 'quick' || record.record_type === 'recipe') {
      food = {
        type: 'quick',
        display_name: record.quick_food_name || (record.record_type === 'recipe' ? '菜谱' : '快速记录'),
        display_energy_kcal: Number(record.quick_energy_kcal || 0),
        protein_g: Number(record.quick_protein_g || 0),
        fat_g: Number(record.quick_fat_g || 0),
        carbohydrate_g: Number(record.quick_carbohydrate_g || 0),
        display_basis_label: '100g'
      };
    } else if (record.food_id) {
      const standardFood = app.findFoodNutritionById(record.food_id);
      if (standardFood) {
        food = app.decorateFoodForDisplay(standardFood, 'standard');
      }
    } else if (record.custom_food_id) {
      const customFood = app.findCustomFoodById(record.custom_food_id);
      if (customFood) {
        food = app.decorateFoodForDisplay(customFood, 'custom');
      }
    }

    if (!food) {
      wx.showToast({ title: '食物信息不存在', icon: 'error' });
      wx.navigateBack();
      return;
    }

    const quantityDisplay = app.getDietRecordQuantityDisplay(record, food);
    const quantityValue = quantityDisplay.value === '' ? '' : String(quantityDisplay.value);

    this.setData({
      food,
      quantity: quantityValue,
      keypadValue: quantityValue,
      quantityUnit: quantityDisplay.unit || app.getFoodBasisUnit(food),
      recordTime: record.record_time || this.data.recordTime,
      notes: record.notes || '',
      recordDate: app.toLocalYMD(record.record_date || this.data.recordDate),
      loading: false
    });

    this.calculateNutrition(quantityValue);
  },

  onQuantityInput(e) {
    const value = e.detail.value;
    this.setData({
      quantity: value,
      keypadValue: value
    });
    this.calculateNutrition(value);
  },

  calculateNutrition(quantity) {
    const food = this.data.food;
    if (!food) {
      this.setData({ calculatedNutrition: null });
      return;
    }

    if (food.type === 'quick') {
      this.setData({
        calculatedNutrition: {
          calories: Number(food.display_energy_kcal || 0).toFixed(1),
          protein: Number(food.protein_g || 0).toFixed(1),
          fat: Number(food.fat_g || 0).toFixed(1),
          carbohydrate: Number(food.carbohydrate_g || 0).toFixed(1)
        }
      });
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      this.setData({ calculatedNutrition: null });
      return;
    }

    const ratio = qty / 100;
    this.setData({
      calculatedNutrition: {
        calories: (Number(food.display_energy_kcal || 0) * ratio).toFixed(1),
        protein: (Number(food.protein_g || 0) * ratio).toFixed(1),
        fat: (Number(food.fat_g || 0) * ratio).toFixed(1),
        carbohydrate: (Number(food.carbohydrate_g || 0) * ratio).toFixed(1)
      }
    });
  },

  onTimeChange(e) {
    this.setData({
      recordTime: e.detail.value
    });
  },

  onNotesInput(e) {
    this.setData({
      notes: e.detail.value
    });
  },

  saveRecord() {
    const { food } = this.data;
    if (!food) {
      wx.showToast({ title: '请选择食物', icon: 'error' });
      return;
    }

    const quantityInput = this.data.keypadValue || this.data.quantity;
    if (food.type !== 'quick' && !quantityInput) {
      wx.showToast({ title: '请输入数量', icon: 'error' });
      return;
    }

    const quantityValue = food.type === 'quick' ? null : Number(quantityInput);
    if (food.type !== 'quick' && (!Number.isFinite(quantityValue) || quantityValue <= 0)) {
      wx.showToast({ title: '请输入有效数量', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    const recordType =
      food.type === 'quick'
        ? 'quick'
        : food.type === 'custom'
          ? 'custom'
          : 'standard';

    const recordData = {
      food_id: food.type === 'standard' ? food.id : null,
      custom_food_id: food.type === 'custom' ? food.id : null,
      quantity_value: food.type === 'quick' ? null : quantityValue,
      quantity_unit: food.type === 'quick' ? null : app.getFoodBasisUnit(food),
      record_time: this.data.recordTime,
      notes: this.data.notes,
      record_date: this.data.recordDate,
      record_type: recordType
    };

    if (food.type === 'quick') {
      recordData.quick_food_name = food.display_name;
      recordData.quick_energy_kcal = food.display_energy_kcal;
      recordData.quick_protein_g = food.protein_g;
      recordData.quick_fat_g = food.fat_g;
      recordData.quick_carbohydrate_g = food.carbohydrate_g;
    }

    const doAfter = (resultRecord) => {
      app.calculateDailyCalorieSummary(this.data.recordDate);
      wx.showToast({
        title: this.data.isEdit ? '更新成功' : '保存成功',
        icon: 'success'
      });
      setTimeout(() => {
        const targetDate = this.data.recordDate;
        const highlightId = (resultRecord && resultRecord.id) ? resultRecord.id : (this.data.recordId || '');
        const url = `/pages/record/record-detail-list?date=${encodeURIComponent(targetDate)}&highlightId=${encodeURIComponent(highlightId)}`;
        wx.redirectTo({ url }).catch(() => {
          wx.navigateTo({ url });
        });
      }, 800);
    };

    const request = this.data.isEdit
      ? app.updateDietRecordWithSync(this.data.recordId, recordData)
      : app.addDietRecordWithSync(recordData);

    request
      .then(result => doAfter(result))
      .catch(err => {
        console.error(this.data.isEdit ? '更新失败:' : '保存失败:', err);
        wx.showToast({
          title: err.message || (this.data.isEdit ? '更新失败' : '保存失败'),
          icon: 'none'
        });
      })
      .finally(() => this.setData({ loading: false }));
  },

  showFoodNutrition() {
    const food = this.data.food;
    if (!food) return;
    if (food.type === 'quick') {
      wx.showToast({ title: '快速记录不含完整营养信息', icon: 'none' });
      return;
    }

    const basisLabel = food.display_basis_label || `100${app.getFoodBasisUnit(food)}`;
    const items = [];
    const push = (label, value, unit = '', digits = 1) => {
      if (value === undefined || value === null || value === '') return;
      const num = Number(value);
      items.push({
        label,
        value: Number.isFinite(num) ? num.toFixed(digits) : value,
        unit
      });
    };

    push('能量', food.display_energy_kcal, ` kcal/${basisLabel}`);
    push('蛋白质', food.protein_g, ` g/${basisLabel}`);
    push('脂肪', food.fat_g, ` g/${basisLabel}`);
    push('碳水化合物', food.carbohydrate_g, ` g/${basisLabel}`);
    push('膳食纤维', food.fiber_g, ` g/${basisLabel}`);
    push('水分', food.moisture_g, ` g/${basisLabel}`);
    push('钠', food.na_mg, ` mg/${basisLabel}`);
    push('钙', food.ca_mg, ` mg/${basisLabel}`);
    push('铁', food.fe_mg, ` mg/${basisLabel}`);
    push('胆固醇', food.cholesterol_mg, ` mg/${basisLabel}`);
    push('维生素A', food.vitamin_a_ug, ` ug/${basisLabel}`, 0);
    push('维生素B1', food.vitamin_b1_mg, ` mg/${basisLabel}`);
    push('维生素B2', food.vitamin_b2_mg, ` mg/${basisLabel}`);
    push('维生素B3', food.vitamin_b3_mg, ` mg/${basisLabel}`);
    push('维生素C', food.vitamin_c_mg, ` mg/${basisLabel}`);
    push('维生素E', food.vitamin_e_mg, ` mg/${basisLabel}`);

    this.setData({
      nutritionTitle: food.food_name || food.display_name || '营养信息',
      nutritionItems: items,
      showNutritionPanel: true
    });
  },

  closeNutritionPanel() {
    this.setData({ showNutritionPanel: false });
  },

  deleteRecord() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      success: (res) => {
        if (!res.confirm) return;
        this.setData({ loading: true });
        app.deleteDietRecordWithSync(this.data.recordId)
          .then(() => {
            app.calculateDailyCalorieSummary(this.data.recordDate);
            wx.showToast({ title: '删除成功', icon: 'success' });
            setTimeout(() => {
              wx.navigateBack();
            }, 1000);
          })
          .catch((err) => {
            console.error('删除失败:', err);
            wx.showToast({ title: '删除失败', icon: 'error' });
          })
          .finally(() => this.setData({ loading: false }));
      }
    });
  },

  editCustomFood(e) {
    const food = e.currentTarget.dataset.food;
    const foodStr = encodeURIComponent(JSON.stringify(food));
    wx.navigateTo({
      url: `/pages/record/add-custom-food?food=${foodStr}&isEdit=true`
    });
  },

  onKeypadInput(e) {
    const value = e.currentTarget.dataset.value;
    let currentValue = this.data.keypadValue;

    if ((value >= '0' && value <= '9') || value === '.') {
      if (value === '.' && currentValue.includes('.')) {
        return;
      }
      if (value === '.' && currentValue === '') {
        currentValue = '0';
      }
      if (currentValue.length >= 6) {
        return;
      }
      currentValue += value;
    }

    this.setData({
      keypadValue: currentValue,
      quantity: currentValue
    });
    this.calculateNutrition(currentValue);
  },

  onKeypadClear() {
    this.setData({
      keypadValue: '',
      quantity: '',
      calculatedNutrition: null
    });
  }
});
