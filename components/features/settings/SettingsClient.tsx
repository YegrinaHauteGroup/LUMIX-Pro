'use client'

import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/utils/supabase/client'
import type { CenterInfo } from '@/lib/center'
import type { User } from '@supabase/supabase-js'
import { Building2, KeyRound, MapPin, Shield, User as UserIcon } from 'lucide-react'
import { useState } from 'react'

interface Props {
  user: User | null
  center: CenterInfo | null
}

export function SettingsClient({ user, center }: Props) {
  const supabase = createClient()

  // Center name
  const [centerName, setCenterName] = useState(center?.name ?? '')
  const [centerLoading, setCenterLoading] = useState(false)
  const [centerMsg, setCenterMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Facility location (#4 — drives the location-based dashboard feed)
  const [address, setAddress] = useState(center?.address ?? '')
  const [regionName, setRegionName] = useState(center?.region_name ?? '')
  const [latitude, setLatitude] = useState(center?.latitude != null ? String(center.latitude) : '')
  const [longitude, setLongitude] = useState(center?.longitude != null ? String(center.longitude) : '')
  const [locLoading, setLocLoading] = useState(false)
  const [locMsg, setLocMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Password
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleCenterSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!center?.id) { setCenterMsg({ type: 'error', text: '센터 정보를 찾을 수 없습니다.' }); return }
    if (!centerName.trim()) { setCenterMsg({ type: 'error', text: '시설 이름을 입력해주세요.' }); return }
    setCenterLoading(true)
    const { error } = await supabase.from('centers').update({ name: centerName.trim() }).eq('id', center.id)
    setCenterLoading(false)
    setCenterMsg(error
      ? { type: 'error', text: error.message }
      : { type: 'success', text: '시설 정보가 저장되었습니다.' }
    )
    setTimeout(() => setCenterMsg(null), 3000)
  }

  const handleLocationSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!center?.id) { setLocMsg({ type: 'error', text: '센터 정보를 찾을 수 없습니다.' }); return }
    const lat = latitude.trim() === '' ? null : Number(latitude)
    const lon = longitude.trim() === '' ? null : Number(longitude)
    if ((lat != null && Number.isNaN(lat)) || (lon != null && Number.isNaN(lon))) {
      setLocMsg({ type: 'error', text: '위도/경도는 숫자로 입력해주세요.' }); return
    }
    setLocLoading(true)
    const { error } = await supabase.from('centers').update({
      address: address.trim() || null,
      region_name: regionName.trim() || null,
      latitude: lat, longitude: lon,
    }).eq('id', center.id)
    if (!error) {
      // refresh the dashboard feed cache for the new location (best-effort)
      supabase.functions.invoke('dashboard_feed', { body: { center_id: center.id } }).catch(() => {})
    }
    setLocLoading(false)
    setLocMsg(error ? { type: 'error', text: error.message } : { type: 'success', text: '시설 위치가 저장되었습니다. 대시보드 정보가 곧 갱신됩니다.' })
    setTimeout(() => setLocMsg(null), 4000)
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw !== confirmPw) { setPwMessage({ type: 'error', text: '새 비밀번호가 일치하지 않습니다.' }); return }
    if (newPw.length < 8) { setPwMessage({ type: 'error', text: '비밀번호는 8자 이상이어야 합니다.' }); return }
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setPwLoading(false)
    if (error) {
      setPwMessage({ type: 'error', text: error.message })
    } else {
      setPwMessage({ type: 'success', text: '비밀번호가 변경되었습니다.' })
      setNewPw(''); setConfirmPw('')
    }
  }

  return (
    <div className="flex-1 p-8 max-w-[1600px] mx-auto w-full space-y-6 overflow-auto">

      {/* Center info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 size={13} className="text-[#8a93a6]" />
            <CardTitle>시설 정보</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {!center ? (
            <div className="border border-[#fdf3e2] bg-[#120e00] px-3 py-3 text-[11px] text-[#b7791f] mb-3">
              센터 정보가 없습니다. 저장 버튼을 클릭하면 자동으로 생성됩니다.
            </div>
          ) : (
            <div className="mb-3">
              <p className="text-[10px] text-[#aab2c2] uppercase tracking-widest mb-1">센터 ID</p>
              <p className="text-[11px] text-[#aab2c2] font-mono">{center.id}</p>
            </div>
          )}
          <form onSubmit={handleCenterSave} className="space-y-3">
            <Input
              label="시설 이름 *"
              placeholder="예: 햇살 아동 센터"
              value={centerName}
              onChange={(e) => setCenterName(e.target.value)}
              required
            />
            {centerMsg && (
              <div className={`px-3 py-3 text-[11px] ${
                centerMsg.type === 'success'
                  ? 'border border-[#e7f7ed] bg-[#e7f7ed] text-emerald-500'
                  : 'border border-[#f7caca] bg-[#fdecec] text-red-400'
              }`}>
                {centerMsg.text}
              </div>
            )}
            <div className="flex justify-end pt-1">
              <Button type="submit" loading={centerLoading}>저장</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Facility location (#4) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin size={13} className="text-[#8a93a6]" />
            <CardTitle>시설 위치</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-[11px] text-[#8a93a6] mb-3 leading-relaxed">
            저장한 위치를 기준으로 대시보드가 날씨·미세먼지·지역 뉴스·보육 정책 정보를 5분마다 자동으로 모아옵니다.
            지도 서비스에서 시설 좌표(위도·경도)를 확인해 입력하세요.
          </p>
          <form onSubmit={handleLocationSave} className="space-y-3">
            <Input label="주소" placeholder="예: 서울특별시 강남구 테헤란로 152"
              value={address} onChange={(e) => setAddress(e.target.value)} />
            <Input label="지역명 (시·군·구)" placeholder="예: 서울특별시 강남구"
              value={regionName} onChange={(e) => setRegionName(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="위도 (latitude)" placeholder="37.4979"
                value={latitude} onChange={(e) => setLatitude(e.target.value)} />
              <Input label="경도 (longitude)" placeholder="127.0276"
                value={longitude} onChange={(e) => setLongitude(e.target.value)} />
            </div>
            {locMsg && (
              <div className={`px-3 py-3 text-[11px] ${
                locMsg.type === 'success'
                  ? 'border border-[#e7f7ed] bg-[#e7f7ed] text-emerald-600'
                  : 'border border-[#f7caca] bg-[#fdecec] text-red-500'
              }`}>
                {locMsg.text}
              </div>
            )}
            <div className="flex justify-end pt-1">
              <Button type="submit" loading={locLoading}>위치 저장</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Account info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserIcon size={13} className="text-[#8a93a6]" />
            <CardTitle>계정 정보</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-[10px] text-[#8a93a6] uppercase tracking-widest mb-1">이메일</p>
            <p className="text-[12px] text-[#1c2740] bg-[#f1f4f9] border border-[#e6eaf2] px-3 py-3">
              {user?.email ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[#8a93a6] uppercase tracking-widest mb-1">계정 ID</p>
            <p className="text-[11px] text-[#8a93a6] bg-[#f1f4f9] border border-[#e6eaf2] px-3 py-3 font-mono">
              {user?.id ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[#8a93a6] uppercase tracking-widest mb-1">마지막 로그인</p>
            <p className="text-[12px] text-[#5a6678] bg-[#f1f4f9] border border-[#e6eaf2] px-3 py-3">
              {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('ko-KR') : '—'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Password change */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound size={13} className="text-[#8a93a6]" />
            <CardTitle>비밀번호 변경</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <Input label="새 비밀번호" type="password" placeholder="8자 이상"
              value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            <Input label="새 비밀번호 확인" type="password" placeholder="비밀번호 재입력"
              value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
            {pwMessage && (
              <div className={`px-3 py-3 text-[11px] ${
                pwMessage.type === 'success'
                  ? 'border border-[#e7f7ed] bg-[#e7f7ed] text-emerald-500'
                  : 'border border-[#f7caca] bg-[#fdecec] text-red-400'
              }`}>
                {pwMessage.text}
              </div>
            )}
            <div className="flex justify-end pt-1">
              <Button type="submit" loading={pwLoading}>변경하기</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* System info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield size={13} className="text-[#8a93a6]" />
            <CardTitle>시스템 정보</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-0">
          {[
            { label: '플랫폼', value: 'LUMIX Pro' },
            { label: '버전', value: 'v1.0.0' },
            { label: 'DB', value: 'Supabase (PostgreSQL)' },
            { label: '지원', value: 'support@lumixpro.kr' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-3 border-b border-[#eef2f8] last:border-0">
              <span className="text-[11px] text-[#8a93a6] uppercase tracking-widest">{label}</span>
              <span className="text-[11px] text-[#5a6678]">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
