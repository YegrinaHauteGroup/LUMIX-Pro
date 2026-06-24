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
  // ontology — extended properties
  phone: string | null
  address: string | null
  postal_code: string | null
  school_name: string | null
  grade_level: string | null
  learning_level: string | null
  characteristics: string | null
  dietary_notes: string | null
  developmental_notes: string | null
  nationality: string | null
  native_language: string | null
  blood_type: string | null
  height_cm: number | null
  weight_kg: number | null
  enrollment_type: 'general' | 'beneficiary' | null
  primary_teacher_id: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  classes?: Class
}

export interface HealthProfile {
  id: string
  child_id: string
  allergies: string | null
  medications: string | null
  conditions: string | null
}

export interface ChildGuardian {
  id: string
  child_id: string
  guardian_id: string
  relationship: string
  is_primary: boolean
  is_emergency_contact: boolean
  can_pickup: boolean
  note: string | null
  guardian_profiles?: { id: string; guardian_name: string; guardian_phone: string | null }
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
