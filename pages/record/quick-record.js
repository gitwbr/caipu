// pages/record/quick-record.js
Page({
  data: {
    food_name: '快速记录',
    energy_kcal: '',
    protein_g: '',
    fat_g: '',
    carbohydrate_g: '',
    notes: '',
    imagePath: '',
    imageUrl: '',
    showImagePreview: false,
    submitting: false,
    loading: false,
    recordDate: '',
    recordTime: ''
  },

  onLoad(options) {
    // 如果有OCR识别的营养数据，自动填入
    if (options.date) {
      const raw = options.date;
      const normalized = getApp().toLocalYMD(raw);
      console.log('[quick-record onLoad] options.date raw:', raw, 'normalized:', normalized);
      this.setData({ recordDate: normalized });
    } else {
      this.setData({ recordDate: getApp().toLocalYMD(new Date()) });
    }
    // 设置默认时间为当前时间（HH:MM）
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);
    this.setData({ recordTime: timeStr });
    if (options.nutritionData) {
      try {
        const nutritionData = JSON.parse(decodeURIComponent(options.nutritionData));
        this.fillNutritionData(nutritionData);
      } catch (error) {
        console.error('解析营养数据失败:', error);
      }
    }
  },

  // 时间选择
  onTimeChange(e) {
    this.setData({ recordTime: e.detail.value });
  },

  // 填入OCR识别的营养数据
  fillNutritionData(nutritionData) {
    const data = {};
    
    if (nutritionData.food_name) {
      data.food_name = nutritionData.food_name;
    }
    
    if (nutritionData.energy_kcal) {
      // 如果能量值大于1000，可能是千焦，转换为千卡
      let energy = parseFloat(nutritionData.energy_kcal);
      if (energy > 1000) {
        energy = energy / 4.184; // 千焦转千卡
      }
      data.energy_kcal = energy.toFixed(1);
    }
    
    if (nutritionData.protein_g) {
      data.protein_g = nutritionData.protein_g;
    }
    
    if (nutritionData.fat_g) {
      data.fat_g = nutritionData.fat_g;
    }
    
    if (nutritionData.carbohydrate_g) {
      data.carbohydrate_g = nutritionData.carbohydrate_g;
    }
    
    this.setData(data);
  },

  // 输入框变化处理
  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    this.setData({
      [field]: value
    });
  },

  // 拍照
  onCameraClick() {
    wx.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success: (res) => {
        if (res.tapIndex === 0) this.takePhoto();
        if (res.tapIndex === 1) this.chooseImage();
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
        console.error('拍照失败:', error);
        wx.showToast({
          title: '拍照失败',
          icon: 'none'
        });
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
        console.error('选择图片失败:', error);
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        });
      }
    });
  },

  // 预览图片
  previewImage() {
    if (this.data.imagePath) {
      wx.previewImage({
        urls: [this.data.imagePath]
      });
    }
  },

  // 删除图片
  removeImage() {
    this.setData({
      imagePath: '',
      imageUrl: '',
      showImagePreview: false
    });
  },

  // 验证表单
  validateForm() {
    const { food_name, energy_kcal } = this.data;
    
    // 如果食物名称为空，使用默认值"快速记录"
    if (!food_name.trim()) {
      this.setData({
        food_name: '快速记录'
      });
    }
    
    if (!energy_kcal || parseFloat(energy_kcal) <= 0) {
      wx.showToast({
        title: '请输入有效热量',
        icon: 'none'
      });
      return false;
    }
    
    return true;
  },

  // 提交表单
  onSubmit() {
    if (!this.validateForm()) {
      return;
    }

    const formData = {
      record_type: 'quick',
      quick_food_name: this.data.food_name.trim() || '快速记录',
      quick_energy_kcal: parseFloat(this.data.energy_kcal),
      quick_protein_g: this.data.protein_g ? parseFloat(this.data.protein_g) : 0,
      quick_fat_g: this.data.fat_g ? parseFloat(this.data.fat_g) : 0,
      quick_carbohydrate_g: this.data.carbohydrate_g ? parseFloat(this.data.carbohydrate_g) : 0,
      quantity_g: 0, // 快速记录不需要重量，设为0
      notes: this.data.notes.trim(),
      record_date: this.data.recordDate,
      record_time: this.data.recordTime,
      quick_image_path: this.data.imagePath // 本地图片路径，用于上传
    };

    // 显示确认对话框
    wx.showModal({
      title: '确认保存',
      content: `确定要保存这条快速记录吗？\n食物：${formData.quick_food_name}\n热量：${formData.quick_energy_kcal} 千卡`,
      success: (res) => {
        if (res.confirm) {
          this.saveQuickRecord(formData);
        }
      }
    });
  },

  // 保存快速记录
  async saveQuickRecord(formData) {
    this.setData({ submitting: true });

    try {
      // 如果有图片，先上传图片
      if (formData.quick_image_path) {
        const imageUrl = await this.uploadImage(formData.quick_image_path);
        formData.quick_image_url = imageUrl;
      }
      
      // 删除本地图片路径，只保留服务器URL
      delete formData.quick_image_path;
      
      console.log('=== 保存快速记录 ===');
      console.log('保存的数据:', formData);
      
      const result = await getApp().addDietRecordWithSync(formData);
      console.log('保存结果:', result);
      
      // 检查dietRecords内容
      const app = getApp();
      console.log('=== dietRecords内容检查 ===');
      console.log('dietRecords长度:', app.globalData.dietRecords.length);
      console.log('dietRecords内容:', app.globalData.dietRecords);
      
      // 查找刚保存的记录
      const savedRecord = app.globalData.dietRecords.find(record => 
        record.record_type === 'quick' && 
        record.quick_food_name === formData.quick_food_name &&
        record.quick_energy_kcal === formData.quick_energy_kcal
      );
      console.log('刚保存的记录:', savedRecord);
      
             wx.showToast({
         title: '保存成功',
         icon: 'success'
       });

       // 跳转到记录详情列表页面
        setTimeout(() => {
          const date = getApp().toLocalYMD(new Date());
          wx.redirectTo({
            url: `/pages/record/record-detail-list?date=${date}`,
           fail: () => {
             // 如果redirectTo失败，尝试navigateTo
             wx.navigateTo({
                url: `/pages/record/record-detail-list?date=${date}`,
               fail: () => {
                 // 最后的备选方案，返回上一页
                 wx.navigateBack();
               }
             });
           }
         });
       }, 1500);

    } catch (error) {
      console.error('保存快速记录失败:', error);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    } finally {
      this.setData({ submitting: false });
    }
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

  // 清空表单
  onClear() {
    this.setData({
      food_name: '',
      energy_kcal: '',
      protein_g: '',
      fat_g: '',
      carbohydrate_g: '',
      notes: '',
      imagePath: '',
      imageUrl: '',
      showImagePreview: false
    });
  }
});
