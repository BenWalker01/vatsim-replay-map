import './App.css';
import 'leaflet/dist/leaflet.css'; // Import Leaflet CSS
import React, { useEffect, useRef, useState } from 'react';
import { Map as LeafletMap, TileLayer, Marker } from 'leaflet';
import ReactSlider from "react-slider";
import Dot from './Dot';

const App: React.FC = () => {
    const mapRef = useRef<HTMLDivElement>(null);
    const leafletMapRef = useRef<LeafletMap | null>(null);
    const [dots, setDots] = useState<Dot[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);


    useEffect(() => {
        if (mapRef.current && !leafletMapRef.current) {
            leafletMapRef.current = new LeafletMap(mapRef.current).setView([51.505, -0.09], 13);

            new TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(leafletMapRef.current);
        }
    }, []);

    useEffect(() => {
        if (leafletMapRef.current) {
            // Create a new dot
            const newDot = new Dot(
                leafletMapRef.current,
                [51.505, -0.09], // Initial position
                {
                    color: 'red',
                    callsign: 'BAW123'
                }
            ).draw();

            // Set a timeline of positions with timestamps
            newDot.setPositions([
                { lat: 51.505, lng: -0.09, time: 0, altitude: 0, heading: 0 },
                { lat: 51.51, lng: -0.10, time: 5000, altitude: 5000, heading: 330 },
                { lat: 51.52, lng: -0.12, time: 10000, altitude: 10000, heading: 315 },
                { lat: 51.53, lng: -0.11, time: 15000, altitude: 15000, heading: 45 }
            ]);

            // Start animation with speed factor
            newDot.animate(speed);

            setDots(prevDots => [...prevDots, newDot]);
        }
    }, [leafletMapRef.current]);

    // Control playback based on UI
    useEffect(() => {
        dots.forEach(dot => {
            if (isPlaying) {
                dot.animate(speed);
            } else {
                dot.stopAnimation();
            }
        });
    }, [isPlaying, speed, dots]);



    useEffect(() => {
        return () => {
            dots.forEach(dot => dot.remove());
        };
    }, [dots]);


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
                <div className="replay-system">
                    <button onClick={() => setIsPlaying(!isPlaying)}>
                        {isPlaying ? 'Pause' : 'Play'}
                    </button>
                    <button onClick={() => setSpeed((prevSpeed: number) => Math.max(0.5, prevSpeed / 2))}>
                        -
                    </button>
                    <button onClick={() => setSpeed(1)}>
                        {speed}x
                    </button>
                    <button onClick={() => setSpeed(prevSpeed => prevSpeed * 2)}>
                        +
                    </button>
                </div>
                <div className="slider-container">
                    <ReactSlider
                        className="horizontal-slider"
                        thumbClassName="example-thumb"
                        trackClassName="example-track"
                        defaultValue={[0, 660]}
                        ariaLabel={["lower", "upper"]}
                        ariaValuetext={state => `Thumb value ${state.valueNow}`}
                        pearling
                        minDistance={10}
                    />
                    <div className="slider-values">
                        <span>0</span>
                        <span>660</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default App;