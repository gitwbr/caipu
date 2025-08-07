// pages/record/add-record.js
const app = getApp();

Page({
  data: {
    activeTab: 'recent', // 'recent' 或 'custom'
    searchKeyword: '',
    searchResults: [],
    recentFoods: [],
    customFoods: [],
    loading: false,
    searching: false,
    processingImage: false
  },

  onLoad() {
    this.loadRecentFoods();
    this.loadCustomFoods();
  },

  onShow() {
    // 页面显示时刷新自定义食物列表
    this.loadCustomFoods();
  },

  // 加载最近食物
  loadRecentFoods() {
    const recentFoods = app.globalData.recentFoods || [];
    this.setData({
      recentFoods: recentFoods.slice(0, 10) // 只显示最近10个
    });
  },

  // 加载自定义食物
  loadCustomFoods() {
    // 只使用本地数据，不进行网络请求
    const localFoods = app.globalData.customFoods || [];
    this.setData({
      customFoods: localFoods
    });
    
    // 可选：在后台静默同步（不影响用户体验）
    setTimeout(() => {
      app.getCustomFoods().then(customFoods => {
        // 更新本地缓存
        app.saveCustomFoodsToLocal(customFoods || []);
        this.setData({
          customFoods: customFoods || []
        });
      }).catch(error => {
        // 静默失败，不影响用户
        console.log('后台同步失败，继续使用本地数据');
      });
    }, 1000); // 延迟1秒执行，避免阻塞页面加载
  },

  // 切换标签页
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab,
      searchResults: [] // 清空搜索结果
    });
  },

  // 搜索输入
  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({
      searchKeyword: keyword
    });

    if (keyword.length >= 2) {
      this.searchFoods(keyword);
    } else {
      this.setData({
        searchResults: []
      });
    }
  },

  // 搜索食物
  searchFoods(keyword) {
    // 安全检查
    if (!keyword || typeof keyword !== 'string') {
      this.setData({
        searchResults: [],
        searching: false
      });
      return;
    }

    this.setData({ searching: true });

    // 搜索标准食物（异步）和自定义食物（同步）
    app.searchFoodNutrition(keyword).then(standardResults => {
      // 搜索自定义食物（同步方法）
      const customResults = app.searchCustomFoods(keyword);
      
      // 确保结果是数组
      const standardArray = Array.isArray(standardResults) ? standardResults : [];
      const customArray = Array.isArray(customResults) ? customResults : [];

      // 合并结果
      const allResults = [
        ...standardArray.map(item => ({
          ...item,
          type: 'standard',
          display_name: item.food_name,
          display_energy_kcal: item.energy_kcal
        })),
        ...customArray.map(item => ({
          ...item,
          type: 'custom',
          display_name: item.food_name,
          display_energy_kcal: item.energy_kcal
        }))
      ];

      this.setData({
        searchResults: allResults.slice(0, 20), // 限制显示20个结果
        searching: false
      });
    }).catch(err => {
      console.error('搜索标准食物失败:', err);
      // 即使标准食物搜索失败，也显示自定义食物结果
      const customResults = app.searchCustomFoods(keyword);
      const customArray = Array.isArray(customResults) ? customResults : [];
      
      const allResults = customArray.map(item => ({
        ...item,
        type: 'custom',
        display_name: item.food_name,
        display_energy_kcal: item.energy_kcal
      }));

      this.setData({
        searchResults: allResults.slice(0, 20),
        searching: false
      });
    });
  },

  // 选择食物
  selectFood(e) {
    const { food } = e.currentTarget.dataset;
    
    console.log('选择的食物:', food);
    
    // 确保食物数据格式正确
    let processedFood = { ...food };
    
    // 如果是自定义食物，需要设置正确的类型和显示字段
    if (food.food_name && !food.display_name) {
      processedFood.type = 'custom';
      processedFood.display_name = food.food_name;
      processedFood.display_energy_kcal = food.energy_kcal;
      processedFood.protein_g = food.protein_g;
      processedFood.fat_g = food.fat_g;
      processedFood.carbohydrate_g = food.carbohydrate_g;
    }
    
    // 添加到最近食物
    app.addToRecentFoods(processedFood);
    
    // 获取当前选择的日期（优先从记录详情页面获取，如果没有则从原记录页面获取）
    const pages = getCurrentPages();
    let selectedDate = new Date().toISOString().split('T')[0]; // 默认今天
    
    // 先尝试从记录详情页面获取日期
    const detailListPage = pages.find(page => page.route === 'pages/record/record-detail-list');
    if (detailListPage && detailListPage.data.selectedDate) {
      selectedDate = detailListPage.data.selectedDate;
    } else {
      // 如果没有找到记录详情页面，尝试从原记录页面获取
      const recordPage = pages.find(page => page.route === 'pages/record/record');
      if (recordPage && recordPage.data.selectedDate) {
        selectedDate = recordPage.data.selectedDate;
      }
    }
    
    console.log('选择的日期:', selectedDate);
    console.log('处理后的食物数据:', processedFood);
    
    // 跳转到记录详情页面，传递食物和日期信息
    wx.navigateTo({
      url: `/pages/record/record-detail?food=${encodeURIComponent(JSON.stringify(processedFood))}&date=${selectedDate}`
    });
  },

  // 添加自定义食物
  addCustomFood() {
    wx.navigateTo({
      url: '/pages/record/add-custom-food'
    });
  },

  // 编辑自定义食物
  editCustomFood(e) {
    const { food } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/record/add-custom-food?food=${encodeURIComponent(JSON.stringify(food))}`
    });
  },

  // 阻止事件冒泡
  stopPropagation(e) {
    // 阻止事件冒泡，防止触发父元素的点击事件
  },

  // 删除自定义食物
  deleteCustomFood(e) {
    const { id } = e.currentTarget.dataset;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个自定义食物吗？',
      success: (res) => {
        if (res.confirm) {
          app.deleteCustomFoodWithSync(id).then(() => {
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            });
            this.loadCustomFoods();
          }).catch(err => {
            // 显示详细的错误信息
            const errorMessage = err.message || '删除失败';
            wx.showModal({
              title: '删除失败',
              content: errorMessage,
              showCancel: false
            });
            console.error('删除自定义食物失败:', err);
          });
        }
      }
    });
  },

  // 拍照功能
  takePhoto() {
    console.log('=== 拍照功能调试 ===');
    
    // 检查相机权限
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting['scope.camera']) {
          // 没有相机权限，请求权限
          wx.authorize({
            scope: 'scope.camera',
            success: () => {
              this.startCamera();
            },
            fail: () => {
              wx.showModal({
                title: '需要相机权限',
                content: '拍照功能需要相机权限，请在设置中开启',
                showCancel: false
              });
            }
          });
        } else {
          // 已有权限，直接拍照
          this.startCamera();
        }
      }
    });
  },

  // 启动相机拍照
  startCamera() {
    console.log('启动相机拍照');
    
    this.setData({ processingImage: true });
    
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      camera: 'back',
      success: (res) => {
        console.log('拍照成功:', res);
        const tempFilePath = res.tempFiles[0].tempFilePath;
        console.log('图片路径:', tempFilePath);
        
        // 上传图片到服务器
        this.uploadImage(tempFilePath);
      },
      fail: (err) => {
        console.error('拍照失败:', err);
        this.setData({ processingImage: false });
        wx.showToast({
          title: '拍照失败',
          icon: 'error'
        });
      }
    });
  },

  // 上传图片到服务器
  uploadImage(filePath) {
    console.log('=== 开始上传图片 ===');
    console.log('图片路径:', filePath);
    
    // 检查登录状态
    if (!app.globalData.isLoggedIn || !app.globalData.token) {
      wx.showModal({
        title: '需要登录',
        content: '请先登录后再使用OCR功能',
        showCancel: false
      });
      return;
    }
    
    // 显示上传中提示
    wx.showLoading({
      title: '识别中...',
      mask: true
    });
    
    // 上传图片到服务器
    wx.uploadFile({
      url: `${app.globalData.serverUrl}/api/baidu-ocr/upload`, // 新的OCR端点
      filePath: filePath,
      name: 'image',
      header: {
        'Authorization': `Bearer ${app.globalData.token}` // 添加认证头
      },
      success: (res) => {
        console.log('上传成功:', res);
        this.handleUploadResult(res);
      },
      fail: (err) => {
        console.error('上传失败:', err);
        this.handleUploadError(err);
      }
    });
  },

  // 处理上传结果
  handleUploadResult(res) {
    console.log('=== 处理上传结果 ===');
    console.log('完整响应:', res);
    
    // 隐藏加载提示
    wx.hideLoading();
    this.setData({ processingImage: false });
    
    try {
      // 解析返回的JSON数据
      const data = JSON.parse(res.data);
      console.log('解析后的数据:', data);
      
      // 检查响应状态
      if (data.success && data.texts && data.texts.length > 0) {
        console.log('识别到的文字:');
        console.log('=== 开始文字内容 ===');
        console.log(data.texts);
        console.log('=== 结束文字内容 ===');
        
        // 合并所有识别的文字
        const fullText = data.texts.join('\n');
        
        // 尝试解析营养成分数据
        const nutritionData = this.parseNutritionData(data.texts);
        console.log('=== 营养成分解析结果 ===');
        console.log('nutritionData:', nutritionData);
        console.log('nutritionData类型:', typeof nutritionData);
        console.log('nutritionData是否为null:', nutritionData === null);
        console.log('nutritionData是否为undefined:', nutritionData === undefined);
        
        console.log('=== 条件判断 ===');
        console.log('if (nutritionData) 的结果:', !!nutritionData);
        console.log('nutritionData的布尔值:', Boolean(nutritionData));
        
        if (nutritionData) {
          console.log('=== 营养成分解析成功，直接跳转到自定义食物页面 ===');
          // 直接跳转到自定义食物页面并填入数据
          this.navigateToCustomFoodWithData(nutritionData);
        } else {
          // 无法解析营养成分，显示原始文字
          wx.showModal({
            title: 'OCR识别结果',
            content: `识别到以下文字内容：\n\n${fullText.substring(0, 500)}${fullText.length > 500 ? '...' : ''}`,
            showCancel: true,
            cancelText: '关闭',
            confirmText: '复制文字',
            success: (modalRes) => {
              if (modalRes.confirm) {
                // 复制到剪贴板
                wx.setClipboardData({
                  data: fullText,
                  success: () => {
                    wx.showToast({
                      title: '已复制到剪贴板',
                      icon: 'success'
                    });
                  }
                });
              }
            }
          });
        }
      } else {
        console.log('识别失败或无文字内容');
        wx.showToast({
          title: '未识别到文字',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('解析响应数据失败:', error);
      console.log('原始响应数据:', res.data);
      wx.showToast({
        title: '解析结果失败',
        icon: 'error'
      });
    }
  },

  // 解析营养成分数据
  parseNutritionData(texts) {
    try {
      const text = texts.join(' ');
      console.log('解析文本:', text);
      
      // 初始化营养数据
      const nutritionData = {
        food_name: '',
        energy_kcal: 0,
        protein_g: 0,
        fat_g: 0,
        carbohydrate_g: 0,
        na_mg: 0
      };
      
             // 解析能量 (保持千焦单位)
       const energyMatch = text.match(/(\d+(?:\.\d+)?)\s*千焦\s*\(kJ\)/);
       if (energyMatch) {
         const energyKj = parseFloat(energyMatch[1]);
         nutritionData.energy_kcal = energyKj; // 保持千焦单位
         console.log('解析到能量:', energyKj, 'kJ');
       }
      
      // 解析蛋白质
      const proteinMatch = text.match(/蛋白质[^\d]*(\d+(?:\.\d+)?)\s*克\s*\(g\)/);
      if (proteinMatch) {
        nutritionData.protein_g = parseFloat(proteinMatch[1]);
        console.log('解析到蛋白质:', nutritionData.protein_g, 'g');
      } else {
        // 尝试匹配包含百分比的格式：蛋白质 29.9克(g) 50%
        const proteinMatch2 = text.match(/蛋白质[^\d]*(\d+(?:\.\d+)?)\s*克\s*\(g\)[^\d]*\d+%/);
        if (proteinMatch2) {
          nutritionData.protein_g = parseFloat(proteinMatch2[1]);
          console.log('解析到蛋白质(含百分比):', nutritionData.protein_g, 'g');
        }
      }
      
      // 解析脂肪
      const fatMatch = text.match(/脂肪[^\d]*(\d+(?:\.\d+)?)\s*克\s*\(g\)/);
      if (fatMatch) {
        nutritionData.fat_g = parseFloat(fatMatch[1]);
        console.log('解析到脂肪:', nutritionData.fat_g, 'g');
      } else {
        // 尝试匹配包含百分比的格式：脂肪 5.2克(g) 百分比%
        const fatMatch2 = text.match(/脂肪[^\d]*(\d+(?:\.\d+)?)\s*克\s*\(g\)[^\d]*\d+%/);
        if (fatMatch2) {
          nutritionData.fat_g = parseFloat(fatMatch2[1]);
          console.log('解析到脂肪(含百分比):', nutritionData.fat_g, 'g');
        }
      }
      
      // 解析碳水化合物
      const carbMatch = text.match(/碳水化合物[^\d]*(\d+(?:\.\d+)?)\s*克\s*\(g\)/);
      if (carbMatch) {
        nutritionData.carbohydrate_g = parseFloat(carbMatch[1]);
        console.log('解析到碳水化合物:', nutritionData.carbohydrate_g, 'g');
      } else {
        // 尝试匹配包含百分比的格式：碳水化合物 9% 44.6克(g)
        const carbMatch2 = text.match(/碳水化合物[^\d]*\d+%[^\d]*(\d+(?:\.\d+)?)\s*克\s*\(g\)/);
        if (carbMatch2) {
          nutritionData.carbohydrate_g = parseFloat(carbMatch2[1]);
          console.log('解析到碳水化合物(含百分比):', nutritionData.carbohydrate_g, 'g');
        }
      }
      
      // 解析钠
      const naMatch = text.match(/钠[^\d]*(\d+(?:\.\d+)?)\s*毫克\s*\(mg\)/);
      if (naMatch) {
        nutritionData.na_mg = parseFloat(naMatch[1]);
        console.log('解析到钠:', nutritionData.na_mg, 'mg');
      } else {
        // 尝试匹配包含百分比的格式：钠 15% 1280毫克(mg)
        const naMatch2 = text.match(/钠[^\d]*\d+%[^\d]*(\d+(?:\.\d+)?)\s*毫克\s*\(mg\)/);
        if (naMatch2) {
          nutritionData.na_mg = parseFloat(naMatch2[1]);
          console.log('解析到钠(含百分比):', nutritionData.na_mg, 'mg');
        }
      }
      
      // 检查是否至少解析到了能量数据
      if (nutritionData.energy_kcal > 0) {
        console.log('解析成功:', nutritionData);
        return nutritionData;
      } else {
        console.log('未能解析到有效的营养成分数据');
        return null;
      }
    } catch (error) {
      console.error('解析营养成分数据失败:', error);
      return null;
    }
  },

  // 跳转到自定义食物页面并填入数据
  navigateToCustomFoodWithData(nutritionData) {
    console.log('=== 准备跳转到自定义食物页面并填入数据 ===');
    console.log('待填入的营养数据:', nutritionData);
    
         // 将营养数据转换为页面需要的格式
     const foodData = {
       food_name: nutritionData.food_name,
       energy_kcal: nutritionData.energy_kcal, // 这里保持千焦单位
       protein_g: nutritionData.protein_g,
       fat_g: nutritionData.fat_g,
       carbohydrate_g: nutritionData.carbohydrate_g,
       na_mg: nutritionData.na_mg,
       // 其他字段设为0
       fiber_g: 0,
       moisture_g: 0,
       vitamin_a_ug: 0,
       vitamin_b1_mg: 0,
       vitamin_b2_mg: 0,
       vitamin_b3_mg: 0,
       vitamin_e_mg: 0,
       ca_mg: 0,
       fe_mg: 0,
       vitamin_c_mg: 0,
       cholesterol_mg: 0
     };
    
    // 跳转到自定义食物页面
    const targetUrl = `/pages/record/add-custom-food?food=${encodeURIComponent(JSON.stringify(foodData))}`;
    console.log('=== 准备跳转 ===');
    console.log('目标URL:', targetUrl);
    console.log('foodData:', foodData);
    
    wx.navigateTo({
      url: targetUrl,
      success: (res) => {
        console.log('=== 跳转成功 ===');
        console.log('跳转结果:', res);
      },
      fail: (err) => {
        console.error('=== 跳转失败 ===');
        console.error('跳转错误:', err);
      }
    });
  },

  // 处理上传错误
  handleUploadError(error) {
    console.error('上传错误处理:', error);
    wx.hideLoading();
    this.setData({ processingImage: false });
    
    wx.showModal({
      title: '上传失败',
      content: '图片上传失败，请检查网络连接或重试。\n\n错误信息: ' + (error.errMsg || error),
      showCancel: false
    });
  }
});