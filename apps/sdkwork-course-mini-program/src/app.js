const { resolveCourseAppSdkBaseUrl } = require('./config/resolveAppSdkBaseUrl');

App({
  globalData: {
    userInfo: null,
    baseUrl: resolveCourseAppSdkBaseUrl(),
    apiPrefix: '/app/v3/api'
  },

  onLaunch() {
    console.log('App Launch')
  },

  onShow() {
    console.log('App Show')
  },

  onHide() {
    console.log('App Hide')
  },

  // Get user info
  getUserInfo() {
    return new Promise((resolve, reject) => {
      if (this.globalData.userInfo) {
        resolve(this.globalData.userInfo)
      } else {
        wx.getUserProfile({
          desc: '用于完善用户资料',
          success: (res) => {
            this.globalData.userInfo = res.userInfo
            resolve(res.userInfo)
          },
          fail: (err) => {
            reject(err)
          }
        })
      }
    })
  },

  // API request helper
  async request(url, options = {}) {
    const fullUrl = `${this.globalData.baseUrl}${this.globalData.apiPrefix}${url}`
    const token = wx.getStorageSync('token')
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    }
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    return new Promise((resolve, reject) => {
      wx.request({
        url: fullUrl,
        method: options.method || 'GET',
        data: options.data,
        header: headers,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data)
          } else {
            reject(new Error(`Request failed with status ${res.statusCode}`))
          }
        },
        fail: (err) => {
          reject(err)
        }
      })
    })
  }
})
