import React, { useEffect, useRef } from 'react';
import { map, tileLayer, MapOptions, Layer, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapComponentProps {
    drawnLayers: { [fileName: string]: Layer[] };
    setDrawnLayers: (layers: { [fileName: string]: Layer[] }) => void;
    showTracks: boolean;
    setLeafletMapRef: (map: LeafletMap | null) => void;
}

const MapComponent: React.FC<MapComponentProps> = ({ drawnLayers, setDrawnLayers, showTracks, setLeafletMapRef }) => {
    const mapRef = useRef<HTMLDivElement | null>(null);
    const leafletMapRef = useRef<L.Map | null>(null);

    useEffect(() => {
        if (mapRef.current && !leafletMapRef.current) {
            const options: MapOptions = {
                zoom: 6,
            };

            leafletMapRef.current = map(mapRef.current, options);
            leafletMapRef.current.setView([53.5, -1.5]);

            tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                tileSize: 256,
                zoomOffset: 0,
                minZoom: 1,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                crossOrigin: true
            }).addTo(leafletMapRef.current);

            setLeafletMapRef(leafletMapRef.current);
        }
    }, [setLeafletMapRef]);

    useEffect(() => {
        if (leafletMapRef.current) {
            if (!showTracks) {
                Object.values(drawnLayers).forEach((layers: Layer[]) => layers.forEach((layer: Layer) => leafletMapRef.current?.removeLayer(layer)));
            } else {
                Object.values(drawnLayers).forEach((layers: Layer[]) => layers.forEach((layer: Layer) => leafletMapRef.current?.addLayer(layer)));
            }
        }
    }, [showTracks, drawnLayers]);

    return <div ref={mapRef} className="map-container" style={{ height: '100vh', width: '100%' }}></div>;

};

export default MapComponent;