import { useState,useEffect,useRef } from 'react'
import type { FormEvent } from 'react'
import mapbox from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

interface DirectionStep {
  step: number
  instruction: string
  distance: string
}

interface MapboxStep {
  maneuver: {
    instruction: string
  }
  distance: number
}

interface MapboxRoute {
  legs: Array<{
    steps: MapboxStep[]
  }>
  geometry: {
    coordinates: [number, number][]
  }
}

interface MapboxDirectionsResponse {
  routes: MapboxRoute[]
}

function App() {
  const [startLocation,setStartLocation] = useState('')
  const [endLocation,setEndLocation] = useState('')
  const [directions,setDirections] = useState<DirectionStep[] | null>(null)
  const [userCoords,setUserCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [isLoading,setIsLoading] = useState(false)
  const [loadingLocation,setLoadingLocation] = useState<boolean>(true)
  const [currentStep,setCurrentStep] = useState<'start' | 'end' | 'complete'>('start')
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const startMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const endMarkerRef = useRef<mapboxgl.Marker | null>(null)

  // Handle map click to set locations
  const handleMapClick = (coords: { lat: number; lng: number }) => {
    if (!mapRef.current) return

    // Get current step from state ref to avoid stale closure
    setCurrentStep((prevStep) => {
      if (prevStep === 'start') {
        // Remove old start marker if exists
        if (startMarkerRef.current) {
          startMarkerRef.current.remove()
        }

        // Add new start marker (green)
        startMarkerRef.current = new mapbox.Marker({ color: '#00d26a' })
          .setLngLat([coords.lng, coords.lat])
          .addTo(mapRef.current!)

        setStartLocation(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`)
        return 'end'
      } else if (prevStep === 'end') {
        // Remove old end marker if exists
        if (endMarkerRef.current) {
          endMarkerRef.current.remove()
        }

        // Add new end marker (red)
        endMarkerRef.current = new mapbox.Marker({ color: '#ef4444' })
          .setLngLat([coords.lng, coords.lat])
          .addTo(mapRef.current!)

        setEndLocation(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`)
        return 'complete'
      }
      return prevStep
    })
  }

  // Draw route on map
  const drawRoute = (coordinates: [number, number][]) => {
    if (!mapRef.current) return

    const map = mapRef.current

    // Remove existing route if any
    if (map.getSource('route')) {
      map.removeLayer('route')
      map.removeSource('route')
    }

    // Add route source and layer
    map.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        }
      }
    })

    map.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#4a9eff',
        'line-width': 5,
        'line-opacity': 0.8
      }
    })

    // Fit map to show entire route
    const bounds = coordinates.reduce(
      (bounds, coord) => bounds.extend(coord as [number, number]),
      new mapbox.LngLatBounds(coordinates[0], coordinates[0])
    )

    map.fitBounds(bounds, {
      padding: { top: 100, bottom: 100, left: 100, right: 500 }
    })
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!startLocation || !endLocation || !startMarkerRef.current || !endMarkerRef.current) return

    setIsLoading(true)

    try {
      const startLngLat = startMarkerRef.current.getLngLat()
      const endLngLat = endMarkerRef.current.getLngLat()

      // Fetch route from Mapbox Directions API
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${startLngLat.lng},${startLngLat.lat};${endLngLat.lng},${endLngLat.lat}?` +
        new URLSearchParams({
          geometries: 'geojson',
          steps: 'true',
          overview: 'full', // Request full geometry detail instead of simplified
          access_token: import.meta.env.VITE_MAPBOX_API_KEY
        })
      )

      if (!response.ok) {
        throw new Error('Failed to fetch route')
      }

      const data = await response.json() as MapboxDirectionsResponse

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0]

        // Extract only major roads/highways from the steps
        const simplifiedSteps: DirectionStep[] = []
        let stepCounter = 1

        route.legs[0].steps.forEach((step) => {
          const instruction = step.maneuver.instruction.toLowerCase()

          // Look for highway/freeway/major road names
          // Match patterns like "Continue on I-5", "Turn onto Highway 101", etc.
          const roadMatch = instruction.match(/(?:on|onto|along)\s+([^,.]+?)(?:\s|$|,|.)/i)

          // Filter to include only significant roads (highways, interstates, major streets)
          const isSignificant =
            instruction.includes('highway') ||
            instruction.includes('freeway') ||
            instruction.includes('interstate') ||
            instruction.includes('i-') ||
            instruction.includes('route') ||
            instruction.includes('us-') ||
            instruction.includes('sr-') ||
            step.distance > 1000 // Roads longer than 1km are likely significant

          if (roadMatch && isSignificant) {
            const roadName = roadMatch[1].trim()
            simplifiedSteps.push({
              step: stepCounter++,
              instruction: roadName,
              distance: `${(step.distance * 0.000621371).toFixed(1)} mi`
            })
          }
        })

        // If no major roads found, just show start and end
        if (simplifiedSteps.length === 0) {
          simplifiedSteps.push({
            step: 1,
            instruction: 'Direct route',
            distance: `${(route.legs[0].distance * 0.000621371).toFixed(1)} mi`
          })
        }

        setDirections(simplifiedSteps)

        // Draw the actual route geometry
        drawRoute(route.geometry.coordinates)
      }

      setIsLoading(false)
    } catch (error) {
      console.error('Error fetching route:', error)
      setIsLoading(false)
      // Show error to user
      alert('Failed to calculate route. Please try again.')
    }
  }

  const resetSelection = () => {
    setCurrentStep('start')
    setStartLocation('')
    setEndLocation('')
    setDirections(null)
    if (startMarkerRef.current) {
      startMarkerRef.current.remove()
      startMarkerRef.current = null
    }
    if (endMarkerRef.current) {
      endMarkerRef.current.remove()
      endMarkerRef.current = null
    }

    // Remove route from map
    if (mapRef.current && mapRef.current.getSource('route')) {
      mapRef.current.removeLayer('route')
      mapRef.current.removeSource('route')
    }
  }

  const openInGoogleMaps = () => {
    if (!startMarkerRef.current || !endMarkerRef.current) return

    const startLngLat = startMarkerRef.current.getLngLat()
    const endLngLat = endMarkerRef.current.getLngLat()

    const url = `https://www.google.com/maps/dir/?api=1&origin=${startLngLat.lat},${startLngLat.lng}&destination=${endLngLat.lat},${endLngLat.lng}&travelmode=driving`
    window.open(url, '_blank')
  }

  const openInAppleMaps = () => {
    if (!startMarkerRef.current || !endMarkerRef.current) return

    const startLngLat = startMarkerRef.current.getLngLat()
    const endLngLat = endMarkerRef.current.getLngLat()

    const url = `http://maps.apple.com/?saddr=${startLngLat.lat},${startLngLat.lng}&daddr=${endLngLat.lat},${endLngLat.lng}&dirflg=d`
    window.open(url, '_blank')
  }

  useEffect(() => {
    if (!navigator.geolocation) {
      console.log('Geolocation is not supported by your browser')
      return
    }

    const position = navigator.geolocation.getCurrentPosition((position) => {
      setUserCoords({
        lat: position.coords.latitude,
        lng: position.coords.longitude
      })
      setLoadingLocation(false)
    },() => {
      console.log('Unable to retrieve your location')
      setLoadingLocation(false)
    })
    console.log('User location obtained:',position)

    return () => {
      // Cleanup if needed
    }
  },[])

  useEffect(() => {
    console.log('userCoords changed:',userCoords)
    if (mapContainerRef.current && !mapRef.current && loadingLocation !== true && userCoords) {
      mapbox.accessToken = import.meta.env.VITE_MAPBOX_API_KEY
      mapRef.current = new mapbox.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [userCoords.lng,userCoords.lat],
        zoom: 10,
      })

      mapRef.current.addControl(
        new mapbox.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true
          },
          trackUserLocation: true,
          showUserHeading: true
        })
      )

      // mapRef.current.on('geolocate',(e) => {
      //   setUserCoords({ lat: e.coords.latitude,lng: e.coords.longitude })
      // })

      mapRef.current.addControl(new mapbox.NavigationControl())

      let pressTimer: number | null = null
      let feedbackMarker: mapboxgl.Marker | null = null

      const cleanup = () => {
        if (pressTimer) {
          clearTimeout(pressTimer)
          pressTimer = null
        }
        if (feedbackMarker) {
          feedbackMarker.remove()
          feedbackMarker = null
        }
      }

      // Mouse down - start timer and show feedback
      mapRef.current.on('mousedown',(e) => {
        cleanup()

        // Create pulsing feedback circle
        const feedbackEl = document.createElement('div')
        feedbackEl.className = 'press-feedback'

        feedbackMarker = new mapbox.Marker({
          element: feedbackEl,
          anchor: 'center'
        })
          .setLngLat(e.lngLat)
          .addTo(mapRef.current!)

        pressTimer = window.setTimeout(() => {
          handleMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng })
          cleanup()
        },500)
      })

      // Cancel on mouseup (finger/click released)
      mapRef.current.on('mouseup',cleanup)

      // Cancel when map starts dragging (not just any mousemove)
      mapRef.current.on('dragstart',cleanup)

      // Touch events for mobile
      mapRef.current.on('touchstart',(e) => {
        cleanup()

        const feedbackEl = document.createElement('div')
        feedbackEl.className = 'press-feedback'

        feedbackMarker = new mapbox.Marker({
          element: feedbackEl,
          anchor: 'center'
        })
          .setLngLat(e.lngLat)
          .addTo(mapRef.current!)

        pressTimer = window.setTimeout(() => {
          handleMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng })
          cleanup()
        },500)
      })

      mapRef.current.on('touchend',cleanup)
      // Also cancel on touch move (dragging on mobile)
      mapRef.current.on('touchmove',cleanup)
    }

    return () => {
      if (startMarkerRef.current) {
        startMarkerRef.current.remove()
      }
      if (endMarkerRef.current) {
        endMarkerRef.current.remove()
      }
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  },[loadingLocation])

  return (
    <div className="app">
      {/* Fullscreen Map */}
      <section className="map-section">
        {loadingLocation ? <div className="spinner" /> : <div ref={mapContainerRef} id="map-container" />}
      </section>

      {/* Floating Header */}
      <header className="header">
        <h1>Route Finder</h1>
      </header>

      {/* Floating Input Panel */}
      <section className="input-section">
        <div className="step-indicator">
          <div className={`step-badge ${currentStep === 'start' ? 'active' : 'completed'}`}>
            {currentStep === 'start' ? '1' : '✓'}
          </div>
          <span className="step-text">
            {currentStep === 'start' ? 'Click map to set starting point' :
             currentStep === 'end' ? 'Click map to set destination' :
             'Route ready'}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="route-form">
          <div className="input-group">
            <label htmlFor="start">Starting Point</label>
            <input
              type="text"
              id="start"
              placeholder="Click on map or enter address..."
              value={startLocation}
              onChange={(e) => setStartLocation(e.target.value)}
              readOnly
            />
          </div>

          <div className="input-group">
            <label htmlFor="end">Destination</label>
            <input
              type="text"
              id="end"
              placeholder={currentStep === 'start' ? 'Set starting point first...' : 'Click on map or enter address...'}
              value={endLocation}
              onChange={(e) => setEndLocation(e.target.value)}
              disabled={currentStep === 'start'}
              readOnly
            />
          </div>

          <div className="button-group">
            <button type="button" className="reset-btn" onClick={resetSelection}>
              Reset
            </button>
            <button type="submit" className="submit-btn" disabled={isLoading || currentStep !== 'complete'}>
              {isLoading ? 'Finding Route...' : 'Get Directions'}
            </button>
          </div>
        </form>
      </section>

      {/* Floating Directions Panel */}
      <section className="directions-section">
        <div className="directions-header">
          <h2>Directions</h2>
          {directions && !isLoading && (
            <div className="share-buttons">
              <button
                className="share-btn google-maps-btn"
                onClick={openInGoogleMaps}
                title="Open in Google Maps"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
                </svg>
                Google Maps
              </button>
              <button
                className="share-btn apple-maps-btn"
                onClick={openInAppleMaps}
                title="Open in Apple Maps"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" fill="currentColor"/>
                </svg>
                Apple Maps
              </button>
            </div>
          )}
        </div>

        {!directions && !isLoading && (
          <div className="directions-empty">
            <p>Enter a starting point and destination to get directions</p>
          </div>
        )}

        {isLoading && (
          <div className="directions-loading">
            <div className="spinner"></div>
            <p>Calculating route...</p>
          </div>
        )}

        {directions && !isLoading && (
          <div className="directions-list">
            <div className="route-summary">
              <span className="route-from">{startLocation}</span>
              <span className="route-arrow">→</span>
              <span className="route-to">{endLocation}</span>
            </div>

            <ol className="steps">
              {directions.map((dir) => (
                <li key={dir.step} className="step">
                  <span className="step-number">{dir.step}</span>
                  <div className="step-content">
                    <p className="step-instruction">{dir.instruction}</p>
                    {dir.distance && (
                      <span className="step-distance">{dir.distance}</span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </div>
  )
}

export default App