// pages/record/add-custom-food.js
const app = getApp();

Page({
  data: {
    // 基本信息
    food_id: null, // 编辑模式时使用
    isEditMode: false, // 是否为编辑模式
    food_name: '',
    energy_value: '',
    energy_units: ['kcal', 'kJ'],
    energy_unit_index: 0, // 默认选择kcal
    ocrSource: false,
    ocrBasisLabel: '',
    ocrBasisWarning: '',
    ocrQualityHint: '',
    ocrDetectionSummary: '',
    ocrDetectedValuesText: '',
    ocrRawText: '',
    nutrition_basis_unit: 'g',
    nutritionBasisUnits: ['g', 'ml'],
    nutritionBasisUnitIndex: 0,
    nutritionBasisText: '100g',
    macroBasisText: 'g/100g',
    microBasisText: 'mg/100g',
    
    // 图片相关
    imagePath: '',
    imageUrl: '',
    imageFullUrl: '',
    showImagePreview: false,
    
    // 宏量营养素
    protein_g: '',
    fat_g: '',
    carbohydrate_g: '',
    fiber_g: '',
    moisture_g: '',
    
    // 维生素
    vitamin_a_ug: '',
    vitamin_b1_mg: '',
    vitamin_b2_mg: '',
    vitamin_b3_mg: '',
    vitamin_e_mg: '',
    vitamin_c_mg: '',
    
    // 矿物质
    na_mg: '',
    ca_mg: '',
    fe_mg: '',
    
    // 其他
    cholesterol_mg: '',
    
    // 表单状态
    loading: false,
    submitting: false
  },

  onLoad(options) {
    console.log('=== 自定义食物页面加载 ===');
    
         // 检查是否为编辑模式
     if (options.food) {
       try {
         const food = JSON.parse(decodeURIComponent(options.food));
         console.log('传入的食物数据:', food);
         
         // 检查是否有id字段来判断是否为编辑模式
         if (food.id) {
           console.log('编辑模式：有id字段');
           this.setData({ isEditMode: true });
         } else {
           console.log('新增模式：从OCR或其他来源传入数据');
           this.setData({ isEditMode: false });
         }
         
         this.loadFoodData(food);
       } catch (error) {
        console.error('解析食物数据失败:', error);
        wx.showToast({
          title: '数据加载失败',
          icon: 'error'
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    } else {
      console.log('新增模式');
    }
  },

  formatFieldValue(value) {
    if (value === undefined || value === null || value === '') {
      return '';
    }

    return String(value);
  },

  resolveBasisDisplay(unit = 'g') {
    const normalizedUnit = unit === 'ml' ? 'ml' : 'g';
    return {
      nutritionBasisText: normalizedUnit === 'ml' ? '100ml' : '100g',
      macroBasisText: normalizedUnit === 'ml' ? 'g/100ml' : 'g/100g',
      microBasisText: normalizedUnit === 'ml' ? 'mg/100ml' : 'mg/100g'
    };
  },

  // 加载食物数据到表单（编辑模式）
  loadFoodData(food) {
    console.log('=== 加载食物数据到表单 ===');
    console.log('传入的food对象:', food);
    console.log('food.id:', food.id);
    
    // 优先使用显式传入的能量值与单位，避免再靠数值大小猜测 kJ/kcal
    const hasExplicitEnergyValue = food.energy_value !== undefined && food.energy_value !== null && food.energy_value !== '';
    const energyValue = hasExplicitEnergyValue ? food.energy_value : (food.energy_kcal || '');
    const energyUnit = String(food.energy_unit || 'kcal').toLowerCase();
    const energyUnitIndex = energyUnit === 'kj' ? 1 : 0;
    const basisUnit = food.nutrition_basis_unit === 'ml' ? 'ml' : 'g';
    const basisDisplay = this.resolveBasisDisplay(basisUnit);
    
    this.setData({
      food_id: food.id || null, // 确保food_id不为undefined
      food_name: food.food_name || '',
      energy_value: this.formatFieldValue(energyValue),
      energy_unit_index: energyUnitIndex,
      nutrition_basis_unit: basisUnit,
      nutritionBasisUnitIndex: basisUnit === 'ml' ? 1 : 0,
      protein_g: this.formatFieldValue(food.protein_g),
      fat_g: this.formatFieldValue(food.fat_g),
      carbohydrate_g: this.formatFieldValue(food.carbohydrate_g),
      fiber_g: this.formatFieldValue(food.fiber_g),
      moisture_g: this.formatFieldValue(food.moisture_g),
      vitamin_a_ug: this.formatFieldValue(food.vitamin_a_ug),
      vitamin_b1_mg: this.formatFieldValue(food.vitamin_b1_mg),
      vitamin_b2_mg: this.formatFieldValue(food.vitamin_b2_mg),
      vitamin_b3_mg: this.formatFieldValue(food.vitamin_b3_mg),
      vitamin_e_mg: this.formatFieldValue(food.vitamin_e_mg),
      na_mg: this.formatFieldValue(food.na_mg),
      ca_mg: this.formatFieldValue(food.ca_mg),
      fe_mg: this.formatFieldValue(food.fe_mg),
      vitamin_c_mg: this.formatFieldValue(food.vitamin_c_mg),
      cholesterol_mg: this.formatFieldValue(food.cholesterol_mg),
      imageUrl: food.image_url || '',
      imageFullUrl: food.image_url ? getApp().buildImageUrl(food.image_url) : '',
      showImagePreview: !!food.image_url,
      ocrSource: !!(food.ocr_source || food.ocr_raw_text),
      ocrBasisLabel: food.ocr_basis_label || '',
      ocrBasisWarning: food.ocr_basis_warning || '',
      ocrQualityHint: food.ocr_quality_hint || '',
      ocrDetectionSummary: food.ocr_detection_summary || '',
      ocrDetectedValuesText: food.ocr_detected_values_text || '',
      ocrRawText: food.ocr_raw_text || '',
      ...basisDisplay
    });
    
    console.log('设置后的food_id:', this.data.food_id);
  },

  // 输入框事件处理
  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    
    console.log(`输入字段 ${field}:`, value);
    
    this.setData({
      [field]: value
    });
  },

  // 能量单位选择
  onEnergyUnitChange(e) {
    const index = e.detail.value;
    this.setData({
      energy_unit_index: index
    });
    console.log('选择能量单位:', this.data.energy_units[index]);
  },

  onBasisUnitChange(e) {
    const index = Number(e.detail.value) || 0;
    const basisUnit = this.data.nutritionBasisUnits[index] === 'ml' ? 'ml' : 'g';
    this.setData({
      nutrition_basis_unit: basisUnit,
      nutritionBasisUnitIndex: basisUnit === 'ml' ? 1 : 0,
      ...this.resolveBasisDisplay(basisUnit)
    });
  },

  copyOcrRawText() {
    if (!this.data.ocrRawText) {
      return;
    }

    wx.setClipboardData({
      data: this.data.ocrRawText,
      success: () => {
        wx.showToast({
          title: '已复制识别文字',
          icon: 'success'
        });
      }
    });
  },

  // 拍照
  takePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({
          imagePath: tempFilePath,
          showImagePreview: true
        });
      },
      fail: (error) => {
        if (error && error.errMsg && error.errMsg.includes('cancel')) return;
        console.error('拍照失败:', error);
        wx.showToast({ title: '拍照失败', icon: 'none' });
      }
    });
  },

  // 选择图片
  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({
          imagePath: tempFilePath,
          showImagePreview: true
        });
      },
      fail: (error) => {
        if (error && error.errMsg && error.errMsg.includes('cancel')) return;
        console.error('选择图片失败:', error);
        wx.showToast({ title: '选择图片失败', icon: 'none' });
      }
    });
  },

  // 相机按钮点击：弹出选择来源
  onCameraClick() {
    wx.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.takePhoto();
        } else if (res.tapIndex === 1) {
          this.chooseImage();
        }
      }
    });
  },

  // 预览图片
  previewImage() {
    if (this.data.imagePath) {
      wx.previewImage({
        urls: [this.data.imagePath]
      });
    } else if (this.data.imageFullUrl) {
      wx.previewImage({
        urls: [this.data.imageFullUrl]
      });
    }
  },

  // 删除图片
  removeImage() {
    this.setData({
      imagePath: '',
      imageUrl: '',
      imageFullUrl: '',
      showImagePreview: false
    });
  },

  // 上传图片到服务器
  uploadImage(filePath) {
    return new Promise((resolve, reject) => {
      console.log('=== 开始上传图片 ===');
      console.log('图片路径:', filePath);
      
      const app = getApp();
      
      // 检查登录状态
      if (!app.globalData.isLoggedIn || !app.globalData.token) {
        reject(new Error('请先登录'));
        return;
      }
      
      // 显示上传中提示
      wx.showLoading({
        title: '上传图片中...',
        mask: true
      });
      
      // 上传图片到服务器
      wx.uploadFile({
        url: `${app.globalData.serverUrl}/api/upload-image`,
        filePath: filePath,
        name: 'image',
        formData: {
          userId: app.globalData.userId || app.globalData.userInfo?.id
        },
        header: {
          'Authorization': `Bearer ${app.globalData.token}`
        },
        success: (res) => {
          console.log('上传成功:', res);
          wx.hideLoading();
          
          try {
            const data = JSON.parse(res.data);
            if (data.success && data.imageUrl) {
              resolve(data.imageUrl);
            } else {
              reject(new Error(data.error || '上传失败'));
            }
          } catch (error) {
            reject(new Error('解析响应失败'));
          }
        },
        fail: (err) => {
          console.error('上传失败:', err);
          wx.hideLoading();
          reject(new Error('网络错误'));
        }
      });
    });
  },

  // 验证表单
  validateForm() {
    const { food_name, energy_value } = this.data;
    
    if (!food_name || food_name.trim() === '') {
      wx.showToast({
        title: '请输入食物名称',
        icon: 'none'
      });
      return false;
    }
    
    if (!energy_value || isNaN(parseFloat(energy_value))) {
      wx.showToast({
        title: '请输入有效的能量数值',
        icon: 'none'
      });
      return false;
    }
    
    return true;
  },

  // 提交表单
  onSubmit() {
    console.log('=== 提交自定义食物表单 ===');
    
    if (!this.validateForm()) {
      return;
    }
    
    // 计算能量值（统一转换为kcal）
    const energyValue = parseFloat(this.data.energy_value) || 0;
    const energyUnit = this.data.energy_units[this.data.energy_unit_index];
    const energyKcal = energyUnit === 'kJ' ? energyValue / 4.184 : energyValue; // 1 kcal = 4.184 kJ
    
    // 收集表单数据
    const formData = {
      food_name: this.data.food_name.trim(),
      energy_kcal: energyKcal,
      protein_g: parseFloat(this.data.protein_g) || 0,
      fat_g: parseFloat(this.data.fat_g) || 0,
      carbohydrate_g: parseFloat(this.data.carbohydrate_g) || 0,
      fiber_g: parseFloat(this.data.fiber_g) || 0,
      moisture_g: parseFloat(this.data.moisture_g) || 0,
      vitamin_a_ug: parseFloat(this.data.vitamin_a_ug) || 0,
      vitamin_b1_mg: parseFloat(this.data.vitamin_b1_mg) || 0,
      vitamin_b2_mg: parseFloat(this.data.vitamin_b2_mg) || 0,
      vitamin_b3_mg: parseFloat(this.data.vitamin_b3_mg) || 0,
      vitamin_e_mg: parseFloat(this.data.vitamin_e_mg) || 0,
      na_mg: parseFloat(this.data.na_mg) || 0,
      ca_mg: parseFloat(this.data.ca_mg) || 0,
      fe_mg: parseFloat(this.data.fe_mg) || 0,
      vitamin_c_mg: parseFloat(this.data.vitamin_c_mg) || 0,
      cholesterol_mg: parseFloat(this.data.cholesterol_mg) || 0,
      nutrition_basis_unit: this.data.nutrition_basis_unit
    };
    
    console.log('表单数据:', formData);
    
    // 显示确认对话框
    const originalEnergy = this.data.energy_value;
    const originalUnit = this.data.energy_units[this.data.energy_unit_index];
    const basisText = this.data.nutritionBasisText || '100g';
    // 根据是否有food_id判断是编辑还是新增
    const action = (this.data.isEditMode && this.data.food_id) ? '更新' : '添加';
    const ocrNotes = [this.data.ocrBasisWarning, this.data.ocrQualityHint].filter(Boolean);
    const noteBlock = ocrNotes.length ? `\n\n提醒：${ocrNotes.join(' ')}` : '';
    wx.showModal({
      title: `确认${action}`,
      content: `确定要${action}"${formData.food_name}"吗？\n\n能量: ${originalEnergy} ${originalUnit}/${basisText} (${energyKcal.toFixed(1)} kcal)\n蛋白质: ${formData.protein_g}g\n脂肪: ${formData.fat_g}g\n碳水化合物: ${formData.carbohydrate_g}g${noteBlock}`,
      success: (res) => {
        if (res.confirm) {
          // 检查是否为编辑模式且有food_id
          if (this.data.isEditMode && this.data.food_id) {
            console.log('执行更新操作');
            this.updateCustomFood(formData);
          } else {
            console.log('执行新增操作');
            this.saveCustomFood(formData);
          }
        }
      }
    });
  },

  // 保存自定义食物
  async saveCustomFood(formData) {
    console.log('=== 保存自定义食物 ===');
    console.log('保存的数据:', formData);
    
    this.setData({ submitting: true });
    
    // 检查登录状态
    if (!app.globalData.isLoggedIn || !app.globalData.token) {
      this.setData({ submitting: false });
      try {
        await app.checkLoginAndShowModal({
          kicker: 'CUSTOM FOOD',
          content: '请先登录后再添加自定义食物。',
          confirmText: '登录后继续',
          cancelText: '稍后再说'
        });
        return this.saveCustomFood(formData);
      } catch (_) {
        return;
      }
      return;
    }
    
    try {
      // 如果有新图片，先上传图片
      if (this.data.imagePath) {
        const imageUrl = await this.uploadImage(this.data.imagePath);
        // 存库仅存路径部分
        formData.image_url = getApp().normalizeImageUrlToPath(imageUrl);
      }

      // 统一接口：云端成功后自动保存本地
      const saved = await app.addCustomFoodWithSync(formData);
      wx.showToast({ title: '添加成功', icon: 'success' });
      setTimeout(() => { wx.navigateBack(); }, 1200);
      return saved;
    } catch (error) {
      console.error('保存自定义食物失败:', error);
      this.setData({ submitting: false });
      wx.showModal({
        title: '保存失败',
        content: error.message || '网络错误，请重试',
        showCancel: false
      });
    }
  },

  // 更新自定义食物
  async updateCustomFood(formData) {
    console.log('=== 更新自定义食物 ===');
    console.log('更新的数据:', formData);
    console.log('当前food_id:', this.data.food_id);
    
    // 检查food_id是否存在
    if (!this.data.food_id) {
      console.error('food_id不存在，无法更新');
      wx.showModal({
        title: '更新失败',
        content: '食物ID不存在，无法更新',
        showCancel: false
      });
      return;
    }
    
    this.setData({ submitting: true });
    
    // 检查登录状态
    if (!app.globalData.isLoggedIn || !app.globalData.token) {
      this.setData({ submitting: false });
      try {
        await app.checkLoginAndShowModal({
          kicker: 'CUSTOM FOOD',
          content: '请先登录后再编辑自定义食物。',
          confirmText: '登录后继续',
          cancelText: '稍后再说'
        });
        return this.updateCustomFood(formData);
      } catch (_) {
        return;
      }
      return;
    }
    
    try {
      // 如果有新图片，先上传图片
      if (this.data.imagePath) {
        const imageUrl = await this.uploadImage(this.data.imagePath);
        // 存库仅存路径部分
        formData.image_url = getApp().normalizeImageUrlToPath(imageUrl);
      }

      const updated = await app.updateCustomFoodWithSync(this.data.food_id, formData);
      wx.showToast({ title: '更新成功', icon: 'success' });
      setTimeout(() => { wx.navigateBack(); }, 1200);
      return updated;
    } catch (error) {
      console.error('更新自定义食物失败:', error);
      this.setData({ submitting: false });
      wx.showModal({
        title: '更新失败',
        content: error.message || '网络错误，请重试',
        showCancel: false
      });
    }
  },

  // 清空表单
  onClear() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有输入内容吗？',
      success: (res) => {
        if (res.confirm) {
                     this.setData({
             food_name: '',
             energy_value: '',
             energy_unit_index: 0,
            nutrition_basis_unit: 'g',
            nutritionBasisUnitIndex: 0,
            protein_g: '',
            fat_g: '',
            carbohydrate_g: '',
            fiber_g: '',
            moisture_g: '',
            vitamin_a_ug: '',
            vitamin_b1_mg: '',
            vitamin_b2_mg: '',
            vitamin_b3_mg: '',
            vitamin_e_mg: '',
            na_mg: '',
            ca_mg: '',
            fe_mg: '',
            vitamin_c_mg: '',
            cholesterol_mg: '',
            imagePath: '',
            imageUrl: '',
            imageFullUrl: '',
            showImagePreview: false,
            ocrSource: false,
            ocrBasisLabel: '',
            ocrBasisWarning: '',
            ocrQualityHint: '',
            ocrDetectionSummary: '',
            ocrDetectedValuesText: '',
            ocrRawText: '',
            ...this.resolveBasisDisplay('g')
          });
          
          wx.showToast({
            title: '已清空',
            icon: 'success'
          });
        }
      }
    });
  },


}); 
