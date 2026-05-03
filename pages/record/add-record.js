// pages/record/add-record.js
const app = getApp();

Page({
  data: {
    activeTab: 'recent', // 'recent' | 'custom' | 'favorites'
    searchKeyword: '',
    searchResults: [],
    hasSearched: false,
    lastSearchedKeyword: '',
    recentFoods: [],
    customFoods: [],
    favoriteRecipes: [],
    loading: false,
    searching: false,
    processingImage: false
  },
  
  // 内部状态（不放入data，避免触发渲染）
  _lastRecentSignature: '',
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
          const decorated = app.decorateFoodForDisplay(food, 'standard');
          recent.push({
            ...decorated,
            id: ref.id,
            type: 'standard',
            image_full_url: decorated.image_url ? app.buildImageUrl(decorated.image_url) : ''
          });
        }
      } else if (ref.type === 'custom') {
        const food = app.findCustomFoodById(ref.id);
        if (food) {
          const decorated = app.decorateFoodForDisplay(food, 'custom');
          recent.push({
            ...decorated,
            id: ref.id,
            type: 'custom',
            image_full_url: decorated.image_url ? app.buildImageUrl(decorated.image_url) : ''
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
        const raw = options.date;
        this._entryDate = getApp().toLocalYMD(raw);
        console.log('[add-record onLoad] options.date raw:', raw, 'entryDate:', this._entryDate);
      } else {
        console.log('[add-record onLoad] options.date missing');
      }
    } catch (e) {}

    // 设置动态标题：有传入日期则显示该日期，否则显示今天
    const titleDate = this._entryDate || getApp().toLocalYMD(new Date());
    try { wx.setNavigationBarTitle({ title: titleDate }); } catch (_) {}
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
    const standardVersion = String(app.globalData.foodNutritionLastUpdate || wx.getStorageSync('foodNutritionLastUpdate') || '');
    const customVersion = String(app.globalData.customFoodsLastUpdate || wx.getStorageSync('customFoodsLastUpdate') || '');
    // 除了最近引用变更，也要在营养数据或自定义食物更新后重算展示内容
    const signature = `${(refs || []).map(r => `${r.type}:${r.id}`).join(',')}|std:${standardVersion}|custom:${customVersion}`;
    if (signature === this._lastRecentSignature) {
      if (!silent) console.log('[recent] refs 未变化，跳过刷新');
      return;
    }
    this._lastRecentSignature = signature;
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
    const foodsWithUrl = (localFoods || []).map(f => {
      const decorated = app.decorateFoodForDisplay(f, 'custom');
      return {
        ...decorated,
        type: 'custom',
        image_full_url: decorated.image_url ? app.buildImageUrl(decorated.image_url) : ''
      };
    });
    if (!silent) console.log('[custom] 更新本地自定义食物，数量:', foodsWithUrl.length);
    this.setData({ customFoods: foodsWithUrl });
    // 自定义食物变化会影响最近解析
    this.loadRecentFoods(silent);
  },

  // 本地数据快速刷新（幂等）
  refreshFromLocal() {
    this.loadCustomFoods(true);
    this.loadRecentFoods(true);
    this.loadFavoriteRecipes(true);
  },

  // 读取本地收藏菜谱（与收藏页一致，使用全局缓存）
  loadFavoriteRecipes(silent = true) {
    const app = getApp();
    const favs = app.globalData.favorites || [];
    const list = (favs || []).map(r => ({
      ...r,
      image_full_url: r.image_url ? app.buildImageUrl(r.image_url) : '',
      calorie_display: (r && r.nutrition && r.nutrition.calories != null) ? `${Number(r.nutrition.calories).toFixed(0)}千卡` : ''
    }));
    if (!silent) console.log('[favorites] 本地收藏菜谱数量:', list.length);
    this.setData({ favoriteRecipes: list });
  },

  // 打开收藏菜谱，跳到详情页
  openFavoriteRecipe(e) {
    const recipe = e.currentTarget.dataset.recipe;
    // 带上日期参数：优先入口带入日期，其次从页面栈中获取，兜底今天
    let selectedDate = this._entryDate || getApp().toLocalYMD(new Date());
    try {
      const pages = getCurrentPages();
      const detailListPage = pages.find(p => p.route === 'pages/record/record-detail-list');
      if (detailListPage && detailListPage.data && detailListPage.data.selectedDate) {
        selectedDate = detailListPage.data.selectedDate;
      }
    } catch (_) {}
    wx.navigateTo({ url: `/pages/recipe/recipe?from=favorites&date=${encodeURIComponent(selectedDate)}&recipe=${encodeURIComponent(JSON.stringify(recipe))}` });
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
      searchResults: [], // 清空搜索结果
      hasSearched: false,
      lastSearchedKeyword: ''
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
        searchResults: [],
        hasSearched: false,
        lastSearchedKeyword: ''
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
        searching: false,
        hasSearched: false,
        lastSearchedKeyword: ''
      });
      return;
    }

    const trimmedKeyword = keyword.trim();
    this.setData({
      searching: true,
      searchResults: [],
      hasSearched: true,
      lastSearchedKeyword: trimmedKeyword
    });

    // 搜索标准食物（异步）和自定义食物（同步）
    app.searchFoodNutrition(trimmedKeyword).then(standardResults => {
      // 搜索自定义食物（同步方法）
      const customResults = app.searchCustomFoods(trimmedKeyword);
      
      // 确保结果是数组
      const standardArray = Array.isArray(standardResults) ? standardResults : [];
      const customArray = Array.isArray(customResults) ? customResults : [];

      // 合并结果
      const allResults = [
        ...standardArray.map(item => app.decorateFoodForDisplay(item, 'standard')),
        ...customArray.map(item => app.decorateFoodForDisplay(item, 'custom'))
      ];

      this.setData({
        searchResults: allResults.slice(0, 20), // 限制显示20个结果
        searching: false,
        hasSearched: true
      });
    }).catch(err => {
      console.error('搜索标准食物失败:', err);
      // 即使标准食物搜索失败，也显示自定义食物结果
      const customResults = app.searchCustomFoods(trimmedKeyword);
      const customArray = Array.isArray(customResults) ? customResults : [];
      
      const allResults = customArray.map(item => app.decorateFoodForDisplay(item, 'custom'));

      this.setData({
        searchResults: allResults.slice(0, 20),
        searching: false,
        hasSearched: true
      });
    });
  },

  // 选择食物
  selectFood(e) {
    const { food } = e.currentTarget.dataset;
    
    console.log('选择的食物:', food);
    
    // 确保食物数据格式正确
    const type = food.type || (Object.prototype.hasOwnProperty.call(food, 'nutrition_basis_unit') ? 'custom' : 'standard');
    const processedFood = app.decorateFoodForDisplay(food, type);
    
    // 添加到最近食物
    app.addToRecentFoods(processedFood);
    
    // 获取当前选择的日期（优先从记录详情页面获取，如果没有则从原记录页面获取）
    const pages = getCurrentPages();
    let selectedDate = getApp().toLocalYMD(new Date()); // 默认今天
    
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
    let selectedDate = getApp().toLocalYMD(new Date());
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
    const app = getApp();
    // 先检查登录与OCR剩余次数
    app.checkLoginAndShowModal()
      .then(() => app.checkUserLimits())
      .then((limits) => {
        const used = Number(limits?.daily_ocr_count || 0);
        const cap = Number(limits?.daily_ocr_limit || 3);
        if (used >= cap) {
          wx.showModal({
            title: 'OCR 次数已达上限',
            content: `今日已识别 ${used} 次。明天再来吧！`,
            showCancel: false
          });
          return Promise.reject(new Error('OCR limit reached'));
        }
        const remaining = cap - used;
        wx.showToast({ title: `今日OCR剩余 ${remaining} 次`, icon: 'none', duration: 1500 });
        return true;
      })
      .then(() => {
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
                fail: () => {
                  console.log('用户取消选择');
                }
              });
            }
          }
        });
      })
      .catch((e) => {
        if (e && e.message) console.log('[OCR limit check]', e.message);
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
      app.checkLoginAndShowModal({
        kicker: 'OCR ACCESS',
        content: '请先登录后再使用 OCR 识别功能。',
        confirmText: '登录后识别',
        cancelText: '稍后再说'
      }).then(() => {
        this.uploadImage(filePath);
      }).catch(() => {
        this.setData({ processingImage: false });
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
        console.log('OCR识别返回:', res);
        // 限制触发：状态码 429
        if (res.statusCode && res.statusCode !== 200) {
          wx.hideLoading();
          this.setData({ processingImage: false });
          try {
            const data = JSON.parse(res.data || '{}');
            const msg = data.error || 'OCR识别失败';
            wx.showModal({ title: '识别受限', content: String(msg), showCancel: false });
          } catch (_) {
            wx.showModal({ title: '识别失败', content: '服务暂不可用或已达次数上限', showCancel: false });
          }
          return;
        }
        this.handleUploadResult(res);
      },
      fail: (err) => {
        console.error('OCR识别失败:', err);
        this.handleUploadError(err);
      }
    });
  },

  buildOcrTextBlocks(texts) {
    const rawLines = (texts || []).map((item) => String(item || '').trim()).filter(Boolean);
    const compactLines = rawLines.map((line) => this.normalizeOcrLine(line, true));

    return {
      rawLines,
      compactLines,
      compactText: compactLines.join(''),
      fullText: rawLines.join('\n')
    };
  },

  normalizeOcrLine(line, compact = false) {
    const normalized = String(line || '')
      .replace(/[（]/g, '(')
      .replace(/[）]/g, ')')
      .replace(/[：]/g, ':')
      .replace(/[，]/g, ',')
      .trim();

    return compact
      ? normalized.replace(/\s+/g, '').replace(/:/g, '')
      : normalized.replace(/\s+/g, ' ');
  },

  matchesKeyword(line, keyword) {
    if (!line || !keyword) return false;
    if (keyword instanceof RegExp) {
      return keyword.test(line);
    }
    return String(line).includes(String(keyword));
  },

  matchesAnyKeyword(line, keywords) {
    return (keywords || []).some(keyword => this.matchesKeyword(line, keyword));
  },

  getNutritionKeywordGroups() {
    return [
      ['能量', '热量', /energy/i],
      ['蛋白质', '蛋白'],
      ['脂肪', '总脂肪'],
      ['碳水化合物', '碳水', '总碳水化合物'],
      ['钠', '纳']
    ];
  },

  extractValueByKeywords(compactLines, compactText, keywords, unitPattern) {
    const regex = new RegExp(`(\\d+(?:\\.\\d+)?)(?=(?:${unitPattern}))`, 'i');
    const candidateSources = [...compactLines, compactText];

    for (const source of candidateSources) {
      for (const keyword of keywords) {
        const keywordIndex = source.indexOf(keyword);
        if (keywordIndex === -1) {
          continue;
        }

        const segment = source.slice(keywordIndex, keywordIndex + 48);
        const match = segment.match(regex);
        if (match) {
          return parseFloat(match[1]);
        }
      }
    }

    return null;
  },

  extractValueFromLine(line, unitPattern) {
    if (!line) return null;
    const regex = new RegExp(`(\\d+(?:\\.\\d+)?)(?=(?:${unitPattern}))`, 'i');
    const match = String(line).match(regex);
    return match ? parseFloat(match[1]) : null;
  },

  findKeywordLineIndex(compactLines, keywords) {
    return (compactLines || []).findIndex(line =>
      this.matchesAnyKeyword(line, keywords)
    );
  },

  extractValueFromNutritionTable(compactLines, keywords, unitPattern, keywordGroups) {
    const currentIndex = this.findKeywordLineIndex(compactLines, keywords);
    if (currentIndex === -1) {
      return null;
    }

    const sameLineValue = this.extractValueFromLine(compactLines[currentIndex], unitPattern);
    if (sameLineValue !== null) {
      return sameLineValue;
    }

    const keywordLineIndexes = (keywordGroups || [])
      .map(group => this.findKeywordLineIndex(compactLines, group))
      .filter(index => index !== -1)
      .sort((a, b) => a - b);

    const nextIndex = keywordLineIndexes.find(index => index > currentIndex);
    const prevCandidates = keywordLineIndexes.filter(index => index < currentIndex);
    const prevIndex = prevCandidates.length ? prevCandidates[prevCandidates.length - 1] : -1;
    const hasKeyword = (line) => (keywordGroups || []).some(group =>
      this.matchesAnyKeyword(line, group)
    );

    const collectValues = (start, end, pickLast = false) => {
      const values = [];
      for (let i = start; i <= end; i++) {
        const line = compactLines[i];
        if (!line || /%/.test(line) || hasKeyword(line)) {
          continue;
        }
        const value = this.extractValueFromLine(line, unitPattern);
        if (value !== null) {
          values.push(value);
        }
      }
      if (!values.length) {
        return null;
      }
      return pickLast ? values[values.length - 1] : values[0];
    };

    const forwardValue = collectValues(
      currentIndex + 1,
      nextIndex === undefined ? compactLines.length - 1 : nextIndex - 1,
      false
    );
    if (forwardValue !== null) {
      return forwardValue;
    }

    return collectValues(prevIndex + 1, currentIndex - 1, true);
  },

  detectNutritionBasis(compactText) {
    if (/每(?:100|一百)(?:毫升|ml)/i.test(compactText) || /100(?:毫升|ml)/i.test(compactText)) {
      return {
        unit: 'ml',
        label: '每100ml',
        warning: ''
      };
    }

    if (/每(?:份|一份)/.test(compactText)) {
      return {
        unit: 'serving',
        label: '每份',
        warning: ''
      };
    }

    return {
      unit: 'g',
      label: '每100g',
      warning: compactText ? '未识别到营养基准单位，暂按每100g带入，请手动确认。' : ''
    };
  },

  detectFoodName(rawLines) {
    const skipPattern = /(营养成分|营养信息|项目|参考值|NRV|能量|蛋白质|脂肪|碳水化合物|碳水|钠|每100|100g|100ml|千焦|kJ|kcal|克\(|毫克|%|公司|有限|地址|配料|生产|许可证|电话|储存|标准|产地|保质期|净含量|规格)/i;
    const pureValuePattern = /^\d+(?:\.\d+)?(?:kJ|kcal|g|mg|%|千焦|千卡|克|毫克)$/i;

    for (const line of (rawLines || []).slice(0, 6)) {
      const trimmed = String(line || '').trim();
      const compact = this.normalizeOcrLine(trimmed, true);

      if (!trimmed || skipPattern.test(compact) || pureValuePattern.test(trimmed)) {
        continue;
      }

      if (compact.length < 2 || compact.length > 24) {
        continue;
      }

      return trimmed;
    }

    return '';
  },

  extractFoodNameFromLines(rawLines) {
    for (const line of (rawLines || [])) {
      const trimmed = String(line || '').trim();
      const match = trimmed.match(/(?:产品名称|品名)[:：]\s*(.+)$/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return this.detectFoodName(rawLines);
  },

  findNutritionAnchorIndex(lines) {
    const compactLines = (lines || []).map(line => this.normalizeOcrLine(line, true)).filter(Boolean);
    if (!compactLines.length) {
      return -1;
    }

    let startIndex = compactLines.findIndex(line => /(营养成分表|营养信息|营养成分)/i.test(line));
    if (startIndex !== -1) {
      return startIndex;
    }

    startIndex = compactLines.findIndex(line => /(项目|营养素参考值|nrv|每100|100g|100ml|每份)/i.test(line));
    if (startIndex !== -1) {
      return startIndex;
    }

    const keywordGroups = this.getNutritionKeywordGroups();
    startIndex = compactLines.findIndex(line =>
      keywordGroups.some(group => this.matchesAnyKeyword(line, group))
    );
    if (startIndex !== -1) {
      return startIndex;
    }

    let bestIndex = -1;
    let bestScore = 0;
    for (let i = 0; i < compactLines.length; i++) {
      const window = compactLines.slice(i, i + 6);
      const matchedGroups = keywordGroups.filter(group =>
        window.some(line => this.matchesAnyKeyword(line, group))
      ).length;
      const valueLines = window.filter(line =>
        /\d+(?:\.\d+)?(?:kj|kcal|g|mg|%|千焦|千卡|克|毫克)/i.test(line)
      ).length;
      const score = matchedGroups * 2 + Math.min(valueLines, 3);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    return bestScore >= 4 ? bestIndex : -1;
  },

  extractNutritionSection(rawLines) {
    const lines = (rawLines || []).map(line => String(line || '').trim()).filter(Boolean);
    if (!lines.length) {
      return lines;
    }

    const startIndex = this.findNutritionAnchorIndex(lines);

    if (startIndex === -1) {
      return lines;
    }

    return lines.slice(startIndex);
  },

  buildOcrDetectedValuesText(nutritionData) {
    const lines = [];

    if (nutritionData.energy_value !== null && nutritionData.energy_value !== undefined && nutritionData.energy_value !== '') {
      lines.push(`能量：${nutritionData.energy_value}${nutritionData.energy_unit || ''}`);
    }

    if (nutritionData.protein_g !== null && nutritionData.protein_g !== undefined && nutritionData.protein_g !== '') {
      lines.push(`蛋白质：${nutritionData.protein_g}g`);
    }

    if (nutritionData.fat_g !== null && nutritionData.fat_g !== undefined && nutritionData.fat_g !== '') {
      lines.push(`脂肪：${nutritionData.fat_g}g`);
    }

    if (nutritionData.carbohydrate_g !== null && nutritionData.carbohydrate_g !== undefined && nutritionData.carbohydrate_g !== '') {
      lines.push(`碳水化合物：${nutritionData.carbohydrate_g}g`);
    }

    if (nutritionData.na_mg !== null && nutritionData.na_mg !== undefined && nutritionData.na_mg !== '') {
      lines.push(`钠：${nutritionData.na_mg}mg`);
    }

    return lines.join('\n');
  },

  buildOcrDetectionSummary(nutritionData) {
    const parts = [];

    if (nutritionData.energy_value !== null && nutritionData.energy_value !== undefined && nutritionData.energy_value !== '') {
      parts.push(`能量 ${nutritionData.energy_value}${nutritionData.energy_unit || ''}`);
    }

    if (nutritionData.parsed_field_count) {
      parts.push(`命中 ${nutritionData.parsed_field_count} 项营养字段`);
    }

    return parts.join(' · ');
  },

  getOcrQualityHint(statistics) {
    const avgConfidence = Number(statistics && statistics.avg_confidence);

    if (!avgConfidence) {
      return '';
    }

    if (avgConfidence < 0.85) {
      return '这次识别清晰度一般，请重点核对单位、小数点和钠含量。';
    }

    return '';
  },

  showOcrFallbackOptions(rawText, basisInfo = { unit: 'g', label: '每100g', warning: '' }, qualityHint = '') {
    wx.showActionSheet({
      itemList: ['继续手动录入', '复制识别文字'],
      success: (actionRes) => {
        if (actionRes.tapIndex === 0) {
          this.navigateToCustomFoodWithData({
            food_name: '',
            ocr_source: true,
            ocr_raw_text: rawText,
            nutrition_basis_label: basisInfo.label,
            nutrition_basis_warning: basisInfo.warning || '这次没能自动解析出完整营养字段，请根据识别原文手动补充后再保存。',
            ocr_quality_hint: qualityHint,
            ocr_detection_summary: '这次需要手动确认',
            ocr_detected_values_text: ''
          });
          return;
        }

        wx.setClipboardData({
          data: rawText,
          success: () => {
            wx.showToast({
              title: '已复制识别文字',
              icon: 'success'
            });
          }
        });
      }
    });
  },

  // 处理OCR识别结果
  handleUploadResult(res) {
    console.log('=== 处理OCR识别结果 ===');
    console.log('完整响应:', res);

    wx.hideLoading();
    this.setData({ processingImage: false });

    try {
      const data = JSON.parse(res.data);
      console.log('解析后的数据:', data);

      if (data.success && data.texts && data.texts.length > 0) {
        console.log('识别到的文字:');
        console.log('=== 开始文字内容 ===');
        console.log(data.texts);
        console.log('=== 结束文字内容 ===');

        const textBlocks = this.buildOcrTextBlocks(data.texts);
        const basisInfo = this.detectNutritionBasis(textBlocks.compactText);
        const qualityHint = this.getOcrQualityHint(data.statistics);
        const nutritionData = this.parseNutritionData(data.texts);

        console.log('=== 营养成分解析结果 ===');
        console.log('nutritionData:', nutritionData);

        if (nutritionData) {
          const nextPayload = {
            ...nutritionData,
            ocr_source: true,
            ocr_raw_text: textBlocks.fullText,
            ocr_quality_hint: qualityHint,
            ocr_detection_summary: this.buildOcrDetectionSummary(nutritionData),
            ocr_detected_values_text: this.buildOcrDetectedValuesText(nutritionData)
          };

          console.log('=== 营养成分解析成功，准备进入确认页 ===');
          this.navigateToCustomFoodWithData(nextPayload);
          return;
        }

        console.log(`识别到以下文字内容：\n\n${textBlocks.fullText.substring(0, 500)}${textBlocks.fullText.length > 500 ? '...' : ''}`);
        wx.showToast({
          title: '需要手动确认',
          icon: 'none'
        });
        this.showOcrFallbackOptions(
          textBlocks.fullText,
          basisInfo,
          qualityHint
        );
        return;
      }

      console.log('识别失败或无文字内容');
      wx.showToast({
        title: '未识别到文字',
        icon: 'none'
      });
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
      const fullTextBlocks = this.buildOcrTextBlocks(texts);
      const nutritionSectionLines = this.extractNutritionSection(fullTextBlocks.rawLines);
      const textBlocks = this.buildOcrTextBlocks(nutritionSectionLines);
      console.log('解析文本:', textBlocks.fullText);

      const basisInfo = this.detectNutritionBasis(textBlocks.compactText);
      const keywordGroups = this.getNutritionKeywordGroups();
      const nutritionData = {
        food_name: this.extractFoodNameFromLines(fullTextBlocks.rawLines),
        energy_value: null,
        energy_unit: 'kcal',
        protein_g: null,
        fat_g: null,
        carbohydrate_g: null,
        na_mg: null,
        nutrition_basis_unit: basisInfo.unit,
        nutrition_basis_label: basisInfo.label,
        nutrition_basis_warning: basisInfo.warning,
        parsed_field_count: 0
      };

      const energyKj = this.extractValueFromNutritionTable(
        textBlocks.compactLines,
        ['能量', '热量', /energy/i],
        '千焦\\(kJ\\)|千焦|kJ',
        keywordGroups
      );
      const energyKcal = this.extractValueFromNutritionTable(
        textBlocks.compactLines,
        ['能量', '热量', /energy/i],
        '千卡\\(kcal\\)|千卡|kcal|大卡',
        keywordGroups
      );

      if (energyKj !== null && energyKj !== undefined) {
        nutritionData.energy_value = energyKj;
        nutritionData.energy_unit = 'kJ';
        console.log('解析到能量:', energyKj, 'kJ');
      } else if (energyKcal !== null && energyKcal !== undefined) {
        nutritionData.energy_value = energyKcal;
        nutritionData.energy_unit = 'kcal';
        console.log('解析到能量:', energyKcal, 'kcal');
      }

      nutritionData.protein_g = this.extractValueFromNutritionTable(
        textBlocks.compactLines,
        ['蛋白质', '蛋白'],
        '克\\(g\\)|克|g',
        keywordGroups
      );
      nutritionData.fat_g = this.extractValueFromNutritionTable(
        textBlocks.compactLines,
        ['脂肪', '总脂肪'],
        '克\\(g\\)|克|g',
        keywordGroups
      );
      nutritionData.carbohydrate_g = this.extractValueFromNutritionTable(
        textBlocks.compactLines,
        ['碳水化合物', '碳水', '总碳水化合物'],
        '克\\(g\\)|克|g',
        keywordGroups
      );
      nutritionData.na_mg = this.extractValueFromNutritionTable(
        textBlocks.compactLines,
        ['钠', '纳'],
        '毫克\\(mg\\)|毫克|mg',
        keywordGroups
      );

      if (nutritionData.na_mg === null) {
        const mgCandidates = textBlocks.compactLines
          .filter(line => line && !/%/.test(line))
          .map(line => this.extractValueFromLine(line, '毫克\\(mg\\)|毫克|mg'))
          .filter(value => value !== null);
        if (mgCandidates.length === 1) {
          nutritionData.na_mg = mgCandidates[0];
        }
      }

      nutritionData.parsed_field_count = [
        nutritionData.energy_value !== null && nutritionData.energy_value !== undefined,
        nutritionData.protein_g !== null && nutritionData.protein_g !== undefined,
        nutritionData.fat_g !== null && nutritionData.fat_g !== undefined,
        nutritionData.carbohydrate_g !== null && nutritionData.carbohydrate_g !== undefined,
        nutritionData.na_mg !== null && nutritionData.na_mg !== undefined
      ].filter(Boolean).length;

      if (nutritionData.parsed_field_count >= 2 || nutritionData.energy_value !== null) {
        console.log('解析成功:', nutritionData);
        return nutritionData;
      }

      console.log('未能解析到有效的营养成分数据');
      return null;
    } catch (error) {
      console.error('解析营养成分数据失败:', error);
      return null;
    }
  },

  // 跳转到自定义食物页面并填入数据
  navigateToCustomFoodWithData(nutritionData) {
    console.log('=== 准备跳转到自定义食物页面并填入数据 ===');
    console.log('待填入的营养数据:', nutritionData);

    const energyValue = nutritionData.energy_value !== undefined && nutritionData.energy_value !== null
      ? nutritionData.energy_value
      : '';
    const toPrefillValue = (value) => {
      if (value === undefined || value === null || value === '') return '';
      const num = Number(value);
      return Number.isFinite(num) ? num : '';
    };

    const foodData = {
      food_name: nutritionData.food_name || '',
      energy_value: toPrefillValue(energyValue) !== '' ? String(toPrefillValue(energyValue)) : '',
      energy_unit: nutritionData.energy_unit || 'kcal',
      protein_g: toPrefillValue(nutritionData.protein_g),
      fat_g: toPrefillValue(nutritionData.fat_g),
      carbohydrate_g: toPrefillValue(nutritionData.carbohydrate_g),
      na_mg: toPrefillValue(nutritionData.na_mg),
      // 其他字段设为空，避免把 OCR 未识别出的值误当成 0 保存
      fiber_g: '',
      moisture_g: '',
      vitamin_a_ug: '',
      vitamin_b1_mg: '',
      vitamin_b2_mg: '',
      vitamin_b3_mg: '',
      vitamin_e_mg: '',
      ca_mg: '',
      fe_mg: '',
      vitamin_c_mg: '',
      cholesterol_mg: '',
      nutrition_basis_unit: nutritionData.nutrition_basis_unit || 'g',
      ocr_source: !!nutritionData.ocr_source,
      ocr_basis_label: nutritionData.nutrition_basis_label || '',
      ocr_basis_warning: nutritionData.nutrition_basis_warning || '',
      ocr_quality_hint: nutritionData.ocr_quality_hint || '',
      ocr_detection_summary: nutritionData.ocr_detection_summary || '',
      ocr_detected_values_text: nutritionData.ocr_detected_values_text || '',
      ocr_raw_text: nutritionData.ocr_raw_text || ''
    };

    if (!['g', 'ml'].includes(foodData.nutrition_basis_unit)) {
      const originalBasisLabel = foodData.ocr_basis_label || '每份';
      foodData.nutrition_basis_unit = 'g';
      foodData.ocr_basis_warning = foodData.ocr_basis_warning ||
        `OCR 原标注是${originalBasisLabel}，当前结构只支持每100g或每100ml，请手动确认基准单位后再保存。`;
    }

    const targetUrl = `/pages/record/add-custom-food?food=${encodeURIComponent(JSON.stringify(foodData))}`;
    console.log('=== 准备跳转 ===');
    console.log('目标URL:', targetUrl);
    console.log('foodData:', foodData);

    wx.navigateTo({
      url: targetUrl,
      success: (navigateRes) => {
        console.log('=== 跳转成功 ===');
        console.log('跳转结果:', navigateRes);
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
