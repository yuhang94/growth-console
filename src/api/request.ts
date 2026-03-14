import axios from 'axios'
import { ElMessage } from 'element-plus'
import type { Result } from '@/types/api'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 15000,
})

request.interceptors.response.use(
  (response) => {
    const res = response.data as Result<unknown>
    if (res.code !== 0) {
      ElMessage.error(res.message || '请求失败')
      return Promise.reject(new Error(res.message))
    }
    return response
  },
  (error) => {
    const message = error.response?.data?.message || error.message || '网络异常'
    ElMessage.error(message)
    return Promise.reject(error)
  },
)

export default request
