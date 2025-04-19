import './App.css';
import 'leaflet/dist/leaflet.css'; // Import Leaflet CSS
import React, { useEffect, useRef, useState } from 'react';
import { Map as LeafletMap, TileLayer, Marker } from 'leaflet';
import ReactSlider from "react-slider";
import Dot from './Dot';
import { processReplayFile } from './FileUploader';

const App: React.FC = () => {
    const mapRef = useRef<HTMLDivElement>(null);
    const leafletMapRef = useRef<LeafletMap | null>(null);
    const [dots, setDots] = useState<Dot[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [fileName, setFileName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [planesVisible, setPlanesVisible] = useState(true);
    const [tracksVisible, setTracksVisible] = useState(false);


    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFileName(file.name);

        // Read the file
        const reader = new FileReader();
        reader.onload = (e) => {
            const fileContent = e.target?.result as string;
            if (fileContent) {
                // Clear existing dots
                dots.forEach(dot => dot.remove());

                // Process the file and create new dots
                const processedData = processReplayFile(fileContent);

                if (leafletMapRef.current && Object.keys(processedData.positions).length > 0) {
                    // Create new dots based on the processed data
                    const newDots = Object.keys(processedData.positions).map(callsign => {
                        const positions = processedData.positions[callsign];
                        if (positions.length === 0) return null;

                        // Get first position for initial placement
                        const firstPos = positions[0];

                        // Create a dot for this aircraft
                        const dot = new Dot(
                            leafletMapRef.current!,
                            [firstPos.lat, firstPos.lng],
                            {
                                color: getRandomColor(), // You'll need to implement this
                                callsign: callsign,
                                altitude: firstPos.altitude
                            }
                        ).draw();

                        // Set the timeline of positions
                        dot.setPositions(positions);

                        // Initially hide the dot
                        dot.setVisible(false);

                        return dot;
                    }).filter(Boolean) as Dot[]; // Filter out null values

                    setDots(newDots);


                }
            }
        };

        reader.readAsText(file);
    };

    const triggerFileUpload = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    // Helper function to generate random colors for aircraft
    const getRandomColor = (): string => {
        const colors = [
            '#FF5733', '#33FF57', '#3357FF', '#F033FF', '#FF33F0',
            '#33FFF0', '#F0FF33', '#FF8C33', '#8C33FF', '#33FF8C'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    };


    useEffect(() => {
        if (mapRef.current && !leafletMapRef.current) {
            leafletMapRef.current = new LeafletMap(mapRef.current).setView([51.505, -0.09], 13);

            new TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(leafletMapRef.current);
        }
    }, []);


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
                    <div className="file-upload-container">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept=".txt"
                            style={{ display: 'none' }}
                        />
                        <button
                            className="upload-button"
                            onClick={triggerFileUpload}
                        >
                            Upload Replay File
                        </button>
                        {fileName && <div className="file-name">{fileName}</div>}
                    </div>
                </nav>
            </header>

            <div ref={mapRef} className="map-container"></div> {/* Map container */}


            <footer className="toolbar">
                <div className="replay-system">
                    <div className="playback-controls">
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

                    <div className="visibility-controls">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={planesVisible}
                                onChange={() => {
                                    const newVisibility = !planesVisible;
                                    setPlanesVisible(newVisibility);
                                    dots.forEach(dot => dot.setVisible(newVisibility));
                                }}
                            />
                            Display Planes
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={tracksVisible}
                                onChange={() => {
                                    const newVisibility = !tracksVisible;
                                    setTracksVisible(newVisibility);
                                    // Implement track visibility logic here
                                    console.log(tracksVisible)
                                }}
                            />
                            Display Tracks
                        </label>
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
                </div>
            </footer>
        </div>
    );
};

export default App;