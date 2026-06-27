declare module '*.css' {
  const content: Record<string, string>
  export default content
}

// Leaflet ships without bundled types; we access it dynamically as `any`.
declare module 'leaflet'
declare module 'leaflet/dist/leaflet.css'
