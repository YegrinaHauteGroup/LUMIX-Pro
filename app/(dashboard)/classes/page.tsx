import { redirect } from 'next/navigation'

// 아동 관리 체계와 반 관리 체계는 하나의 통합 페이지(/children)로 합쳐졌습니다.
export default function ClassesPage() {
  redirect('/children')
}
