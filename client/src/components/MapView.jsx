import { Circle, MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import icon from 'leaflet/dist/images/marker-icon.png'
import icon2x from 'leaflet/dist/images/marker-icon-2x.png'
import shadow from 'leaflet/dist/images/marker-shadow.png'

const pin = new L.Icon({
  iconUrl: icon,
  iconRetinaUrl: icon2x,
  shadowUrl: shadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

function ClickCatcher({ onPick }) {
  useMapEvents({
    click(event) {
      onPick?.({ lat: event.latlng.lat, lng: event.latlng.lng })
    },
  })
  return null
}

export default function MapView({
  center = [13.05, 80.25],
  zoom = 11,
  markers = [],
  circles = [],
  onPick,
  height = 360,
}) {
  return (
    <MapContainer center={center} zoom={zoom} style={{ height, width: '100%' }} scrollWheelZoom>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickCatcher onPick={onPick} />
      {markers.map((marker) => (
        <Marker key={marker.id} position={[marker.lat, marker.lng]} icon={pin}>
          {marker.label && <Popup>{marker.label}</Popup>}
        </Marker>
      ))}
      {circles.map((circle) => (
        <Circle
          key={circle.id}
          center={[circle.lat, circle.lng]}
          radius={circle.radius || 1800}
          pathOptions={{ color: circle.color || '#0e6b5c', weight: 2, fillOpacity: 0.15 }}
        />
      ))}
    </MapContainer>
  )
}
