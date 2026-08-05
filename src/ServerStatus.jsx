import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { ServerUnreachableError } from './api'

const ServerStatusContext = createContext(null)

export function ServerStatusProvider({ children }) {
  const [serverDown, setServerDown] = useState(false)

  const reportSuccess = useCallback(() => {
    setServerDown(false)
  }, [])

  const reportFailure = useCallback((error) => {
    if (error instanceof ServerUnreachableError || error instanceof TypeError) {
      setServerDown(true)
    }
  }, [])

  const value = useMemo(
    () => ({ serverDown, reportSuccess, reportFailure }),
    [serverDown, reportSuccess, reportFailure],
  )

  return (
    <ServerStatusContext.Provider value={value}>
      {children}
    </ServerStatusContext.Provider>
  )
}

export function useServerStatus() {
  const ctx = useContext(ServerStatusContext)
  if (!ctx) {
    throw new Error('useServerStatus must be used inside ServerStatusProvider')
  }
  return ctx
}
