export interface Child {
  id: string
  name: string
  birth_date: string | null
  gender: 'male' | 'female' | 'other'
  class_id: string | null
  status: 'active' | 'inactive' | 'leave'
  photo_url: string | null
  guardian_name: string | null
  guardian_phone: string | null
  notes: string | null
  created_at: string
  classes?: Class
}

export interface Class {
  id: string
  name: string
  description: string | null
  capacity: number | null
  created_at: string
  children?: Child[]
}

export interface Activity {
  id: string
  title: string
  description: string | null
  activity_date: string | null
  activity_time: string | null
  class_id: string | null
  type: 'education' | 'therapy' | 'recreation' | 'counseling' | 'other'
  status: 'planned' | 'ongoing' | 'completed' | 'cancelled'
  created_at: string
  classes?: Class
}

export interface AttendanceRecord {
  id: string
  child_id: string
  check_date: string
  status: 'present' | 'absent' | 'late' | 'leave'
  notes: string | null
  created_at: string
  children?: Child
}
