import './App.css';
import 'leaflet/dist/leaflet.css'; // Import Leaflet CSS
import React, { useEffect, useRef } from 'react';
import { Map as LeafletMap, TileLayer } from 'leaflet';
import ReactSlider from "react-slider";

const App: React.FC = () => {
    const mapRef = useRef<HTMLDivElement>(null);
    const leafletMapRef = useRef<LeafletMap | null>(null);

    useEffect(() => {
        if (mapRef.current && !leafletMapRef.current) {
            leafletMapRef.current = new LeafletMap(mapRef.current).setView([51.505, -0.09], 13);

            new TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(leafletMapRef.current);
        }
    }, []);

    return (
        <div className="app-container">
            <header className="header">
                <h1>VATSIM Replay Map</h1>
                <nav>
                    <div className="nav-title">File Visibility</div>
                </nav>
            </header>

            <div ref={mapRef} className="map-container"></div> {/* Map container */}

            <footer className="toolbar">
                <div className="replay-system"></div>
                <div className="slider-container">
                    <ReactSlider
                        className="horizontal-slider"
                        thumbClassName="example-thumb"
                        trackClassName="example-track"
                        defaultValue={[0, 100]}
                        ariaLabel={["lower", "upper"]}
                        ariaValuetext={state => `Thumb value ${state.valueNow}`}
                        pearling
                        minDistance={10}
                    />
                </div>
            </footer>
        </div>
    );
};

export default App;