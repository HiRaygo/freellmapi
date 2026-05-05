import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/page-header'
import type { ApiKey, Platform } from '../../../shared/types'

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'google', label: 'Google AI Studio' },
  { value: 'groq', label: 'Groq' },
  { value: 'sensenova', label: 'SenseNova' },
  { value: 'nvidia', label: 'NVIDIA NIM' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'github', label: 'GitHub Models' },
  { value: 'huggingface', label: 'Hugging Face' },
  { value: 'cloudflare', label: 'Cloudflare Workers AI' },
  { value: 'zhipu', label: 'Zhipu AI (Z.ai)' },
  { value: 'moonshot', label: 'Moonshot (Kimi)' },
  { value: 'minimax', label: 'MiniMax' },
]

const statusDot: Record<string, string> = {
  healthy: 'bg-emerald-500',
  rate_limited: 'bg-amber-500',
  invalid: 'bg-rose-500',
  error: 'bg-rose-500',
  unknown: 'bg-muted-foreground/40',
}

const statusLabel: Record<string, string> = {
  healthy: 'healthy',
  rate_limited: 'rate-limited',
  invalid: 'invalid',
  error: 'error',
  unknown: 'unchecked',
}

interface HealthPlatform {
  platform: string
  totalKeys: number
  healthyKeys: number
  rateLimitedKeys: number
  invalidKeys: number
  errorKeys: number
  unknownKeys: number
}

interface HealthData {
  platforms: HealthPlatform[]
  keys: { id: number; platform: string; status: string; lastCheckedAt: string | null }[]
}

function UnifiedKeySection() {
  const queryClient = useQueryClient()
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState(false)

  const { data } = useQuery<{ apiKey: string }>({
    queryKey: ['unified-key'],
    queryFn: () => apiFetch('/api/settings/api-key'),
  })

  const regenerate = useMutation({
    mutationFn: () => apiFetch('/api/settings/api-key/regenerate', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unified-key'] }),
  })

  const apiKey = data?.apiKey ?? ''
  const masked = apiKey ? apiKey.slice(0, 13) + '•'.repeat(32) : '…'

  function copy() {
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h2 className="text-sm font-medium">你的统一API密钥</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            把它作为你的OpenAI <code className="font-mono">api_key</code>; 它会对该代理进行认证请求。
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => regenerate.mutate()}
          disabled={regenerate.isPending}
        >
          重新生成
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <code className="flex-1 font-mono text-xs bg-muted px-3 py-2 rounded-md select-all truncate tabular-nums">
          {showKey ? apiKey : masked}
        </code>
        <Button variant="outline" size="sm" onClick={() => setShowKey(!showKey)}>
          {showKey ? '隐藏' : '显示'}
        </Button>
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? '已复制' : '复制'}
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
        <span className="text-muted-foreground">Base URL</span>
        <code className="font-mono">http://localhost:3001/v1</code>
        <span className="text-muted-foreground">Endpoint</span>
        <code className="font-mono">/v1/chat/completions</code>
      </div>
    </section>
  )
}

export default function KeysPage() {
  const queryClient = useQueryClient()
  const [platform, setPlatform] = useState<Platform | ''>('')
  const [apiKey, setApiKey] = useState('')
  const [accountId, setAccountId] = useState('')
  const [label, setLabel] = useState('')

  const { data: keys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ['keys'],
    queryFn: () => apiFetch('/api/keys'),
  })

  const { data: healthData } = useQuery<HealthData>({
    queryKey: ['health'],
    queryFn: () => apiFetch('/api/health'),
    refetchInterval: 30000,
  })

  const addKey = useMutation({
    mutationFn: (body: { platform: string; key: string; label?: string }) =>
      apiFetch('/api/keys', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys'] })
      queryClient.invalidateQueries({ queryKey: ['health'] })
      queryClient.invalidateQueries({ queryKey: ['fallback'] })
      setPlatform('')
      setApiKey('')
      setAccountId('')
      setLabel('')
    },
  })

  const deleteKey = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys'] })
      queryClient.invalidateQueries({ queryKey: ['health'] })
    },
  })

  const checkAll = useMutation({
    mutationFn: () => apiFetch('/api/health/check-all', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] })
      queryClient.invalidateQueries({ queryKey: ['keys'] })
    },
  })

  const checkKey = useMutation({
    mutationFn: (keyId: number) => apiFetch(`/api/health/check/${keyId}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] })
      queryClient.invalidateQueries({ queryKey: ['keys'] })
    },
  })

  const needsAccountId = platform === 'cloudflare'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!platform || !apiKey) return
    if (needsAccountId && !accountId) return
    const key = needsAccountId ? `${accountId}:${apiKey}` : apiKey
    addKey.mutate({ platform, key, label: label || undefined })
  }

  const healthKeyMap = new Map<number, { status: string; lastCheckedAt: string | null }>()
  for (const k of healthData?.keys ?? []) healthKeyMap.set(k.id, k)

  const grouped = PLATFORMS.map(p => ({
    ...p,
    keys: keys.filter(k => k.platform === p.value),
  })).filter(p => p.keys.length > 0)

  return (
    <div>
      <PageHeader
        title="密钥"
        description="管理提供商凭证和你的应用连接的统一API密钥"
        actions={
          keys.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => checkAll.mutate()} disabled={checkAll.isPending}>
              {checkAll.isPending ? '检查中…' : '检查'}
            </Button>
          )
        }
      />

      <div className="space-y-8">
        <UnifiedKeySection />

        <section>
          <h2 className="text-sm font-medium mb-3">添加提供商凭证</h2>
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border p-4 bg-card">
            <div className="space-y-1.5">
              <Label className="text-xs">平台</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="选择提供商" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {needsAccountId && (
              <div className="space-y-1.5">
                <Label className="text-xs">账号ID</Label>
                <Input
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  placeholder="a1b2c3d4…"
                  className="w-[200px] font-mono text-xs"
                />
              </div>
            )}
            <div className="space-y-1.5 flex-1 min-w-[240px]">
              <Label className="text-xs">{needsAccountId ? 'API token' : 'API key'}</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={needsAccountId ? 'Bearer token' : '粘贴到这里'}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">标签</Label>
              <Input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="可选"
                className="w-[160px]"
              />
            </div>
            <Button type="submit" size="sm" disabled={!platform || !apiKey || (needsAccountId && !accountId) || addKey.isPending}>
              {addKey.isPending ? '添加中' : '添加'}
            </Button>
          </form>
          {addKey.isError && (
            <p className="text-destructive text-xs mt-2">{(addKey.error as Error).message}</p>
          )}
        </section>

        <section>
          <h2 className="text-sm font-medium mb-3">修改提供商配置</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">加载中</p>
          ) : keys.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                还没有提供者密钥。请在上方添加一个以启动路由。
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map(group => (
                <div key={group.value}>
                  <div className="flex items-baseline justify-between mb-2">
                    <h3 className="text-sm font-medium">{group.label}</h3>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {group.keys.length} 个密钥{group.keys.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="rounded-lg border divide-y bg-card overflow-hidden">
                    {group.keys.map(k => {
                      const h = healthKeyMap.get(k.id)
                      const status = h?.status ?? k.status
                      const lastChecked = h?.lastCheckedAt
                      return (
                        <div key={k.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                          <span className={`size-1.5 rounded-full flex-shrink-0 ${statusDot[status] ?? statusDot.unknown}`} />
                          <code className="text-xs font-mono flex-shrink-0">{k.maskedKey}</code>
                          {k.label && <span className="text-xs text-muted-foreground">{k.label}</span>}
                          <span className="text-xs text-muted-foreground">{statusLabel[status] ?? status}</span>
                          <div className="flex-1" />
                          {lastChecked && (
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                              {new Date(lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          <Button variant="ghost" size="xs" onClick={() => checkKey.mutate(k.id)} disabled={checkKey.isPending}>
                            检查
                          </Button>
                          <Button variant="ghost" size="xs" className="text-muted-foreground hover:text-destructive" onClick={() => deleteKey.mutate(k.id)} disabled={deleteKey.isPending}>
                            删除
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
