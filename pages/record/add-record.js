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

  // 加载最近食物
  loadRecentFoods() {
    const recentFoods = app.globalData.recentFoods || [];
    this.setData({
      recentFoods: recentFoods.slice(0, 10) // 只显示最近10个
    });
  },

  // 加载自定义食物
  loadCustomFoods() {
    const customFoods = app.getCustomFoods();
    this.setData({
      customFoods: customFoods
    });
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
    
    // 添加到最近食物
    app.addToRecentFoods(food);
    
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
    
    // 跳转到记录详情页面，传递食物和日期信息
    wx.navigateTo({
      url: `/pages/record/record-detail?food=${encodeURIComponent(JSON.stringify(food))}&date=${selectedDate}`
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
      url: `/pages/record/edit-custom-food?food=${encodeURIComponent(JSON.stringify(food))}`
    });
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
            wx.showToast({
              title: '删除失败',
              icon: 'error'
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
        
        // 显示识别结果
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