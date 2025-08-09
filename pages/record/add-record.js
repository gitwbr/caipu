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
  
  // 内部状态（不放入data，避免触发渲染）
  _lastRecentKey: '',
  _lastCustomUpdate: '',
  _hasSyncedOnce: false,
  
  // 将最近引用解析为可展示项（查两张表）
  async resolveRecentItems(refs) {
    const app = getApp();
    const recent = [];
    (refs || []).forEach(ref => {
      if (ref.type === 'standard') {
        const food = app.findFoodNutritionById(ref.id);
        if (food) {
          recent.push({
            id: ref.id,
            type: 'standard',
            display_name: food.food_name,
            display_energy_kcal: food.energy_kcal,
            protein_g: food.protein_g,
            fat_g: food.fat_g,
            carbohydrate_g: food.carbohydrate_g,
            image_url: food.image_url,
            image_full_url: food.image_url ? app.buildImageUrl(food.image_url) : ''
          });
        }
      } else if (ref.type === 'custom') {
        const food = app.findCustomFoodById(ref.id);
        if (food) {
          recent.push({
            id: ref.id,
            type: 'custom',
            display_name: food.food_name,
            display_energy_kcal: food.energy_kcal,
            protein_g: food.protein_g,
            fat_g: food.fat_g,
            carbohydrate_g: food.carbohydrate_g,
            image_url: food.image_url,
            image_full_url: food.image_url ? app.buildImageUrl(food.image_url) : ''
          });
        }
      }
    });
    return recent;
  },

  onImgLoad(e) {
    const src = e.currentTarget.dataset.src;
    const origin = e.currentTarget.dataset.origin;
    console.log('[image load]', origin, src);
  },

  onImgError(e) {
    const src = e.currentTarget.dataset.src;
    const origin = e.currentTarget.dataset.origin;
    console.error('[image error]', origin, src, e.detail);
  },

  onLoad() {
    // 读取入口参数中的日期
    try {
      const pages = getCurrentPages();
      const current = pages[pages.length - 1];
      const options = (current && current.options) || {};
      if (options.date) {
        this._entryDate = options.date.includes('T') ? options.date.split('T')[0] : options.date;
      }
    } catch (e) {}
    // 首次进入：仅从本地读取并解析一次，避免多次互相触发
    this.refreshFromLocal();
    // 后台静默同步一次云端自定义食物，完成后若有变更再刷新最近
    this.syncCustomFoodsInBackground();
  },

  onShow() {
    // 返回本页时，增量刷新本地数据（仅在变更时更新）
    this.refreshFromLocal();
  },

  // 加载最近食物
  async loadRecentFoods(silent = true) {
    const refs = app.globalData.recentFoods || [];
    // 基于 type:id 构建签名，避免重复解析/打印
    const key = (refs || []).map(r => `${r.type}:${r.id}`).join(',');
    if (key === this._lastRecentKey) {
      if (!silent) console.log('[recent] refs 未变化，跳过刷新');
      return;
    }
    this._lastRecentKey = key;
    if (!silent) console.log('[recent] refs 变化，长度:', refs.length);
    const resolved = await this.resolveRecentItems(refs.slice(0, 10));
    if (!silent) console.log('[recent] resolved 更新，长度:', resolved.length);
    this.setData({ recentFoods: resolved });
  },

  // 加载自定义食物
  loadCustomFoods(silent = true) {
    // 使用本地数据；仅当最近一次更新时间变化时才刷新UI与最近
    const localFoods = app.globalData.customFoods || [];
    const lastUpdate = app.globalData.customFoodsLastUpdate || '';
    if (lastUpdate === this._lastCustomUpdate) {
      if (!silent) console.log('[custom] 本地自定义食物未变化，跳过刷新');
      return;
    }
    this._lastCustomUpdate = lastUpdate;
    const foodsWithUrl = (localFoods || []).map(f => ({
      ...f,
      image_full_url: f.image_url ? getApp().buildImageUrl(f.image_url) : ''
    }));
    if (!silent) console.log('[custom] 更新本地自定义食物，数量:', foodsWithUrl.length);
    this.setData({ customFoods: foodsWithUrl });
    // 自定义食物变化会影响最近解析
    this.loadRecentFoods(silent);
  },

  // 本地数据快速刷新（幂等）
  refreshFromLocal() {
    this.loadCustomFoods(true);
    this.loadRecentFoods(true);
  },

  // 云端同步（后台一次），只有拿到数据且产生变化时才会写本地并触发刷新
  syncCustomFoodsInBackground() {
    if (this._hasSyncedOnce) return;
    this._hasSyncedOnce = true;
    app.getCustomFoods()
      .then(customFoods => {
        if (Array.isArray(customFoods)) {
          app.saveCustomFoodsToLocal(customFoods || []);
          // saveCustomFoodsToLocal 会更新 globalData 的 lastUpdate
          this.loadCustomFoods(true);
        }
      })
      .catch(() => {
        // 静默失败即可
      });
  },

  // 切换标签页
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    console.log('切换标签页:', tab);
    console.log('当前activeTab:', this.data.activeTab);
    
    this.setData({
      activeTab: tab,
      searchResults: [] // 清空搜索结果
    });
    
    console.log('切换后activeTab:', this.data.activeTab);
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

  // 搜索按钮点击
  onSearchBtnTap() {
    const keyword = this.data.searchKeyword.trim();
    if (keyword.length > 0) {
      this.searchFoods(keyword);
    } else {
      wx.showToast({
        title: '请输入搜索关键词',
        icon: 'none'
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
      // 最近列表需要缩略图，带上（仅存路径）
      if (food.image_url) {
        processedFood.image_url = getApp().normalizeImageUrlToPath(food.image_url);
      }
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
    const origin = this.data.activeTab || 'unknown';
    wx.navigateTo({
      url: `/pages/record/record-detail?food=${encodeURIComponent(JSON.stringify(processedFood))}&date=${selectedDate}&origin=${origin}`
    });
  },

  // 添加自定义食物
  addCustomFood() {
    wx.navigateTo({
      url: '/pages/record/add-custom-food'
    });
  },

  // 底部按钮：快速记录
  goQuickRecord() {
    // 带上当前选中的日期（若能取到记录页/列表页的日期，或入口参数）
    const pages = getCurrentPages();
    let selectedDate = new Date().toISOString().split('T')[0];
    if (this._entryDate) selectedDate = this._entryDate;
    const detailListPage = pages.find(page => page.route === 'pages/record/record-detail-list');
    if (detailListPage && detailListPage.data.selectedDate) {
      selectedDate = detailListPage.data.selectedDate;
    } else {
      const recordPage = pages.find(page => page.route === 'pages/record/record');
      if (recordPage && recordPage.data.selectedDate) {
        selectedDate = recordPage.data.selectedDate;
      }
    }
    wx.navigateTo({ url: `/pages/record/quick-record?date=${encodeURIComponent(selectedDate)}` });
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
    
    wx.showModal({
      title: '营养成分表识别',
      content: '请清晰拍摄营养成分表，确保文字清晰可见，以提高识别准确率。\n\n建议：\n• 保持手机稳定\n• 确保光线充足\n• 避免反光和阴影',
      confirmText: '开始识别',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 用户点击开始识别，显示选择菜单
          wx.showActionSheet({
            itemList: ['拍照', '从相册选择'],
            success: (actionRes) => {
              if (actionRes.tapIndex === 0) {
                // 选择拍照
                this.checkCameraPermission();
              } else if (actionRes.tapIndex === 1) {
                // 选择从相册选择
                this.chooseFromAlbum();
              }
            },
            fail: (err) => {
              console.log('用户取消选择');
            }
          });
        }
      }
    });
  },

  // 检查相机权限
  checkCameraPermission() {
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

  // 从相册选择图片
  chooseFromAlbum() {
    console.log('从相册选择图片');
    
    this.setData({ processingImage: true });
    
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        console.log('选择图片成功:', res);
        const tempFilePath = res.tempFiles[0].tempFilePath;
        console.log('图片路径:', tempFilePath);
        
        // 上传图片进行OCR识别
        this.uploadImage(tempFilePath);
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
        this.setData({ processingImage: false });
        
        // 检查是否是用户取消操作
        if (err.errMsg && err.errMsg.includes('cancel')) {
          console.log('用户取消选择图片');
          // 用户取消，不需要显示错误提示
        } else {
          wx.showToast({
            title: '选择图片失败',
            icon: 'error'
          });
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
        
        // 检查是否是用户取消操作
        if (err.errMsg && err.errMsg.includes('cancel')) {
          console.log('用户取消拍照');
          // 用户取消，不需要显示错误提示
        } else {
          wx.showToast({
            title: '拍照失败',
            icon: 'error'
          });
        }
      }
    });
  },

  // 直接OCR识别图片（不保存到服务器）
  uploadImage(filePath) {
    console.log('=== 开始OCR识别图片 ===');
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
    
    // 显示识别中提示
    wx.showLoading({
      title: '识别中...',
      mask: true
    });
    
    // 直接上传图片进行OCR识别（不保存到服务器）
    wx.uploadFile({
      url: `${app.globalData.serverUrl}/api/baidu-ocr/upload`, // OCR识别端点
      filePath: filePath,
      name: 'image',
      formData: {
        userId: app.globalData.userInfo.id // 添加用户ID
      },
      header: {
        'Authorization': `Bearer ${app.globalData.token}` // 添加认证头
      },
      success: (res) => {
        console.log('OCR识别成功:', res);
        this.handleUploadResult(res);
      },
      fail: (err) => {
        console.error('OCR识别失败:', err);
        this.handleUploadError(err);
      }
    });
  },

  // 处理OCR识别结果
  handleUploadResult(res) {
    console.log('=== 处理OCR识别结果 ===');
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

  // 处理OCR识别错误
  handleUploadError(error) {
    console.error('OCR识别错误处理:', error);
    wx.hideLoading();
    this.setData({ processingImage: false });
    
    wx.showModal({
      title: '识别失败',
      content: 'OCR识别失败，请检查网络连接或重试。\n\n错误信息: ' + (error.errMsg || error),
      showCancel: false
    });
  }
});