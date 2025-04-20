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
    const [colourSettings, setColourSettings] = useState(true);


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

                        const firstPos = positions[0];

                        const flightPlan = processedData.fplans && processedData.fplans[callsign];
                        const destination = flightPlan ? flightPlan.dest : '';


                        const dot = new Dot(
                            leafletMapRef.current!,
                            [firstPos.lat, firstPos.lng],
                            {
                                callsign: callsign,
                                altitude: firstPos.altitude,
                                dest: destination,
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
                <div className="wip-banner" style={{
                    backgroundColor: '#aaaa00',
                    color: '#000',
                    padding: '8px 16px',
                    margin: '8px 0',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    borderRadius: '4px'
                }}>
                    Very WIP (Things are broken)
                </div>
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
                                    if (!tracksVisible) {
                                        dots.forEach(dot => dot.displayTracks());
                                    } else {
                                        dots.forEach(dot => dot.hideTracks());
                                    }
                                }}
                            />
                            Display Tracks
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={colourSettings}
                                onChange={() => {
                                    setColourSettings(!colourSettings);
                                    dots.forEach(dot => dot.toggleColourSettings());
                                    if (tracksVisible) {
                                        dots.forEach(dot => dot.displayTracks());
                                    }
                                }}
                            />
                            Colour by altitude (on) / destination (off)
                        </label>

                    </div>




                    {/* <div className="slider-container">
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
                    </div> */}
                </div>
            </footer >
        </div >
    );
};

export default App;