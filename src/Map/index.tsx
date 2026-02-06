import { useEffect, useRef } from "react";
import mapbox from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

type Props = {
  loadingLocation: boolean;
  userCoords: { lat: number; lng: number } | null;
  handleMapClick: (coords: { lat: number; lng: number }) => void;
  startMarkerRef: React.MutableRefObject<mapboxgl.Marker | null>;
  endMarkerRef: React.MutableRefObject<mapboxgl.Marker | null>;
  mapRef: React.MutableRefObject<mapboxgl.Map | null>;
};

const Map = (props: Props) => {
  const { loadingLocation, userCoords, handleMapClick, startMarkerRef, endMarkerRef, mapRef } = props;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    console.log('userCoords changed:', userCoords);
    if (mapContainerRef.current && !mapRef.current && loadingLocation !== true && userCoords) {
      mapbox.accessToken = import.meta.env.VITE_MAPBOX_API_KEY;
      mapRef.current = new mapbox.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-114.995117, 53.304621],
        zoom: 5,
      });

      mapRef.current.addControl(
        new mapbox.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true
          },
          trackUserLocation: true,
          showUserHeading: true
        })
      );

      // mapRef.current.on('geolocate',(e) => {
      //   setUserCoords({ lat: e.coords.latitude,lng: e.coords.longitude })
      // })

      mapRef.current.addControl(new mapbox.NavigationControl());

      let pressTimer: number | null = null;
      let feedbackMarker: mapboxgl.Marker | null = null;

      const cleanup = () => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
        if (feedbackMarker) {
          feedbackMarker.remove();
          feedbackMarker = null;
        }
      };

      // Mouse down - start timer and show feedback
      mapRef.current.on('mousedown', (e) => {
        cleanup();

        // Create pulsing feedback circle
        const feedbackEl = document.createElement('div');
        feedbackEl.className = 'press-feedback';

        feedbackMarker = new mapbox.Marker({
          element: feedbackEl,
          anchor: 'center'
        })
          .setLngLat(e.lngLat)
          .addTo(mapRef.current!);

        pressTimer = window.setTimeout(() => {
          handleMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
          cleanup();
        }, 500);
      });

      // Cancel on mouseup (finger/click released)
      mapRef.current.on('mouseup', cleanup);

      // Cancel when map starts dragging (not just any mousemove)
      mapRef.current.on('dragstart', cleanup);

      // Touch events for mobile
      mapRef.current.on('touchstart', (e) => {
        cleanup();

        const feedbackEl = document.createElement('div');
        feedbackEl.className = 'press-feedback';

        feedbackMarker = new mapbox.Marker({
          element: feedbackEl,
          anchor: 'center'
        })
          .setLngLat(e.lngLat)
          .addTo(mapRef.current!);

        pressTimer = window.setTimeout(() => {
          handleMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
          cleanup();
        }, 500);
      });

      mapRef.current.on('touchend', cleanup);
      // Also cancel on touch move (dragging on mobile)
      mapRef.current.on('touchmove', cleanup);
    }

    return () => {
      if (startMarkerRef.current) {
        startMarkerRef.current.remove();
      }
      if (endMarkerRef.current) {
        endMarkerRef.current.remove();
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [loadingLocation]);

  return (
    <>
      {loadingLocation ? (
        <div className="spinner" />
      ) : (
        <div ref={mapContainerRef} id="map-container" />
      )}
    </>
  );
};

export default Map;
