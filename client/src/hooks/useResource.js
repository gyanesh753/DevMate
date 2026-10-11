import { useEffect, useState, useCallback } from 'react'
import { api } from '../lib/api'
export function useResource(path, identity = '') {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const [revision, setRevision] = useState(0)
  const reload = useCallback(() => setRevision((n) => n + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setState({ data: null, loading: true, error: null })
      if (!path) {
        setState({ data: null, loading: false, error: null })
        return
      }
      try {
        const data = await api(path, { signal: controller.signal })
        if (!controller.signal.aborted) setState({ data, loading: false, error: null })
      } catch (error) {
        if (!controller.signal.aborted) setState({ data: null, loading: false, error })
      }
    }
    load()
    return () => controller.abort()
  }, [path, identity, revision])
  return { ...state, reload }
}
