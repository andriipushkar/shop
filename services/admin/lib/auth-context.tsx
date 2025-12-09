'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import api from './api'

interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const PUBLIC_PATHS = ['/login']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const checkAuth = async () => {
      api.loadToken()
      try {
        const profile = await api.getProfile()
        if (profile.role !== 'admin' && profile.role !== 'manager') {
          throw new Error('Unauthorized')
        }
        setUser(profile)
      } catch {
        if (!PUBLIC_PATHS.includes(pathname)) {
          router.push('/login')
        }
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [pathname, router])

  const login = async (email: string, password: string) => {
    const data = await api.login(email, password)
    if (data.user.role !== 'admin' && data.user.role !== 'manager') {
      api.clearToken()
      throw new Error('Access denied. Admin or manager role required.')
    }
    setUser(data.user)
    router.push('/dashboard')
  }

  const logout = async () => {
    try {
      await api.logout()
    } finally {
      setUser(null)
      router.push('/login')
    }
  }

  if (isLoading && !PUBLIC_PATHS.includes(pathname)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
