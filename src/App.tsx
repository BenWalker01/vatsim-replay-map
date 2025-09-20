import './App.css';
import 'leaflet/dist/leaflet.css'; // Import Leaflet CSS
import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet.heat'; // Import leaflet.heat plugin
import ReactSlider from "react-slider";
import Dot from './Dot';
import { processReplayFile } from './FileUploader';

const App: React.FC = () => {
    const mapRef = useRef<HTMLDivElement>(null);
    const leafletMapRef = useRef<L.Map | null>(null);
    const [dots, setDots] = useState<Dot[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [fileName, setFileName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [planesVisible, setPlanesVisible] = useState(true);
    const [tracksVisible, setTracksVisible] = useState(false);
    const [trailsVisible, setTrailsVisible] = useState(false);
    const [heatMapVisible, setHeatMapVisible] = useState(false);
    const [colourSettings, setColourSettings] = useState(true);
    
    // Timeline state
    const [currentTime, setCurrentTime] = useState(0);
    const [totalDuration, setTotalDuration] = useState(0);
    const [replayStartTime, setReplayStartTime] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    
    // Airport filtering state
    const [airportFilter, setAirportFilter] = useState('');
    const [filterType, setFilterType] = useState<'dep' | 'arr' | 'both'>('dep');
    const [airportFilterEnabled, setAirportFilterEnabled] = useState(false);
    const [airportFilterExpanded, setAirportFilterExpanded] = useState(false);
    
    // Altitude filtering state
    const [altitudeRange, setAltitudeRange] = useState<[number, number]>([0, 45000]);
    const [altitudeFilterEnabled, setAltitudeFilterEnabled] = useState(false);
    const [altitudeFilterExpanded, setAltitudeFilterExpanded] = useState(false);
    const [debouncedAltitudeRange, setDebouncedAltitudeRange] = useState<[number, number]>([0, 45000]);
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const heatMapRef = useRef<any>(null); // Reference to heat map layer
    const heatMapUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Bottom bar collapse state
    const [bottomBarCollapsed, setBottomBarCollapsed] = useState(false);

    // Handlers for filter enable/disable with smart expansion
    const handleAirportFilterToggle = useCallback(() => {
        const newEnabled = !airportFilterEnabled;
        setAirportFilterEnabled(newEnabled);
        // Auto-expand when enabling for first time, but don't auto-collapse when disabling
        if (newEnabled && !airportFilterExpanded) {
            setAirportFilterExpanded(true);
        }
    }, [airportFilterEnabled, airportFilterExpanded]);

    const handleAltitudeFilterToggle = useCallback(() => {
        const newEnabled = !altitudeFilterEnabled;
        setAltitudeFilterEnabled(newEnabled);
        // Auto-expand when enabling for first time, but don't auto-collapse when disabling
        if (newEnabled && !altitudeFilterExpanded) {
            setAltitudeFilterExpanded(true);
        }
    }, [altitudeFilterEnabled, altitudeFilterExpanded]);

    // Debounced altitude range update for performance
    const handleAltitudeRangeChange = useCallback((newRange: [number, number]) => {
        setAltitudeRange(newRange);
        
        // Clear existing timeout
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
        
        // Set new timeout for debounced update
        debounceTimeoutRef.current = setTimeout(() => {
            setDebouncedAltitudeRange(newRange);
        }, 300); // 300ms delay after user stops sliding
    }, []);


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
                        const departure = flightPlan ? flightPlan.dep : '';

                        const dot = new Dot(
                            leafletMapRef.current!,
                            [firstPos.lat, firstPos.lng],
                            {
                                callsign: callsign,
                                altitude: firstPos.altitude,
                                dest: destination,
                                dep: departure,
                            }
                        ).draw();

                        // Set the timeline of positions
                        dot.setPositions(positions);

                        // Initially hide the dot
                        dot.setVisible(false);

                        return dot;
                    }).filter(Boolean) as Dot[]; // Filter out null values

                    setDots(newDots);
                    
                    // Calculate start time and total duration for relative timeline
                    if (newDots.length > 0) {
                        // Get all first times from all aircraft
                        const allFirstTimes = newDots.map(dot => {
                            const positions = (dot as any).positions;
                            return positions.length > 0 ? positions[0].time : 0;
                        }).filter(time => time > 0);
                        
                        // Get all last times from all aircraft
                        const allLastTimes = newDots.map(dot => dot.getTotalDuration());
                        
                        const minStartTime = Math.min(...allFirstTimes);
                        const maxEndTime = Math.max(...allLastTimes);
                        
                        setReplayStartTime(minStartTime);
                        setTotalDuration(maxEndTime - minStartTime);
                        setCurrentTime(0); // Reset timeline to start
                    } else {
                        setReplayStartTime(0);
                        setTotalDuration(0);
                        setCurrentTime(0);
                    }
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
            leafletMapRef.current = new L.Map(mapRef.current).setView([55.3781, -3.436], 6);

            new L.TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(leafletMapRef.current);
        }
    }, []);

    // Function to update heat map data
    const updateHeatMap = useCallback(() => {
        if (!leafletMapRef.current || !heatMapVisible || dots.length === 0) return;

        // Collect positions from visible aircraft
        const heatMapData: [number, number, number][] = [];
        
        dots.forEach(dot => {
            const airportMatch = !airportFilterEnabled || dot.matchesAirportFilter(airportFilter, filterType);
            const altitudeMatch = !altitudeFilterEnabled || dot.isWithinAltitudeRange(debouncedAltitudeRange[0], debouncedAltitudeRange[1]);
            const shouldShow = airportMatch && altitudeMatch;
            
            if (shouldShow) {
                const position = dot.getCurrentPosition();
                if (position) {
                    // Add position with intensity (lat, lng, intensity)
                    heatMapData.push([position.lat, position.lng, 1]);
                }
            }
        });

        // Update existing heat map data
        if (heatMapRef.current && heatMapData.length > 0) {
            heatMapRef.current.setLatLngs(heatMapData);
        }
    }, [heatMapVisible, dots, airportFilterEnabled, airportFilter, filterType, altitudeFilterEnabled, debouncedAltitudeRange]);

    // Timeline update during playback
    useEffect(() => {
        if (!isPlaying || isDragging) return;

        const updateTimeline = () => {
            if (dots.length > 0) {
                const currentTimes = dots.map(dot => dot.getCurrentTime());
                const maxCurrentTime = Math.max(...currentTimes);
                // Convert absolute time to relative time
                const relativeTime = Math.max(0, maxCurrentTime - replayStartTime);
                setCurrentTime(relativeTime);
            }
        };

        const timelineInterval = setInterval(updateTimeline, 100); // Update 10 times per second

        return () => clearInterval(timelineInterval);
    }, [isPlaying, isDragging, dots, replayStartTime]);

    // Handle timeline seeking
    const handleTimelineSeek = useCallback((newTime: number) => {
        setCurrentTime(newTime);
        // Convert relative time back to absolute time for seeking
        const absoluteTime = newTime + replayStartTime;
        dots.forEach(dot => {
            dot.seekToTime(absoluteTime);
        });
    }, [dots, replayStartTime]);

    // Control playback based on UI
    useEffect(() => {
        dots.forEach(dot => {
            if (isPlaying) {
                // Resume animation from current position with current speed
                dot.animate(speed);
            } else {
                // Just stop the animation, don't reset position
                dot.stopAnimation();
            }
        });
        
        // Set up periodic heat map updates when playing
        if (isPlaying && heatMapVisible) {
            heatMapUpdateTimerRef.current = setInterval(() => {
                updateHeatMap();
            }, 1000); // Update every second
        } else {
            // Clear heat map update timer
            if (heatMapUpdateTimerRef.current) {
                clearInterval(heatMapUpdateTimerRef.current);
                heatMapUpdateTimerRef.current = null;
            }
        }
    }, [isPlaying, speed, dots, heatMapVisible, updateHeatMap]);

    // Apply all filtering (airport, altitude) and visibility controls
    useEffect(() => {
        dots.forEach(dot => {
            const airportMatch = !airportFilterEnabled || dot.matchesAirportFilter(airportFilter, filterType);
            const altitudeMatch = !altitudeFilterEnabled || dot.isWithinAltitudeRange(debouncedAltitudeRange[0], debouncedAltitudeRange[1]);
            const shouldShow = airportMatch && altitudeMatch;
            
            // Handle plane visibility
            if (planesVisible && shouldShow) {
                dot.setVisible(true);
            } else {
                dot.setVisible(false);
            }
            
            // Handle track visibility
            if (tracksVisible && shouldShow) {
                dot.displayTracks();
            } else {
                dot.hideTracks();
            }
            
            // Handle trail visibility
            if (trailsVisible && shouldShow) {
                dot.setTrailVisible(true);
            } else {
                dot.setTrailVisible(false);
            }
        });
    }, [airportFilterEnabled, airportFilter, filterType, altitudeFilterEnabled, debouncedAltitudeRange, dots, planesVisible, tracksVisible, trailsVisible]);

    // Heat map update logic
    useEffect(() => {
        if (!leafletMapRef.current) return;

        // Remove existing heat map
        if (heatMapRef.current) {
            leafletMapRef.current.removeLayer(heatMapRef.current);
            heatMapRef.current = null;
        }

        // Create new heat map if enabled and we have visible aircraft
        if (heatMapVisible && dots.length > 0) {
            // Collect positions from visible aircraft
            const heatMapData: [number, number, number][] = [];
            
            dots.forEach(dot => {
                const airportMatch = !airportFilterEnabled || dot.matchesAirportFilter(airportFilter, filterType);
                const altitudeMatch = !altitudeFilterEnabled || dot.isWithinAltitudeRange(debouncedAltitudeRange[0], debouncedAltitudeRange[1]);
                const shouldShow = airportMatch && altitudeMatch;
                
                if (shouldShow) {
                    const position = dot.getCurrentPosition();
                    if (position) {
                        // Add position with intensity (lat, lng, intensity)
                        heatMapData.push([position.lat, position.lng, 1]);
                    }
                }
            });

            // Create heat map layer if we have data
            if (heatMapData.length > 0) {
                heatMapRef.current = (L as any).heatLayer(heatMapData, {
                    radius: 25,
                    blur: 15,
                    maxZoom: 18,
                    max: 1.0,
                    gradient: {
                        0.0: 'blue',
                        0.2: 'cyan',
                        0.4: 'lime',
                        0.6: 'yellow',
                        0.8: 'orange',
                        1.0: 'red'
                    }
                }).addTo(leafletMapRef.current);
            }
        }
    }, [heatMapVisible, dots, airportFilterEnabled, airportFilter, filterType, altitudeFilterEnabled, debouncedAltitudeRange]);

    useEffect(() => {
        return () => {
            dots.forEach(dot => dot.remove());
            // Clean up debounce timeout
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, [dots]);


    return (
        <div className={`app-container ${bottomBarCollapsed ? 'footer-collapsed' : ''}`}>
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

            <footer className={`toolbar ${bottomBarCollapsed ? 'collapsed' : ''}`}>
                {/* Bottom bar toggle */}
                <div className="bottom-bar-toggle">
                    <button 
                        className="collapse-button"
                        onClick={() => setBottomBarCollapsed(!bottomBarCollapsed)}
                        title={bottomBarCollapsed ? "Show Controls" : "Hide Controls"}
                    >
                        {bottomBarCollapsed ? '∧' : '∨'}
                    </button>
                </div>
                <div className="replay-system">
                    <div className="playback-controls">
                        <div className="control-buttons">
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
                            <button onClick={() => {
                                setIsPlaying(false);
                                dots.forEach(dot => dot.resetAnimation());
                            }}>
                                Reset
                            </button>
                        </div>
                        
                        <div className="timeline-container">
                            <div className="timeline-time">
                                {(() => {
                                    const minutes = Math.floor(currentTime / 60);
                                    const seconds = Math.floor(currentTime % 60);
                                    return minutes > 0 
                                        ? `${minutes}:${seconds.toString().padStart(2, '0')}`
                                        : `0:${seconds.toString().padStart(2, '0')}`;
                                })()}
                            </div>
                            <div className="timeline-wrapper">
                                <div 
                                    className="timeline-track"
                                    onClick={(e) => {
                                        if (totalDuration > 0) {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const clickX = e.clientX - rect.left;
                                            const percentage = clickX / rect.width;
                                            const targetTime = percentage * totalDuration;
                                            handleTimelineSeek(targetTime);
                                        }
                                    }}
                                >
                                    <div 
                                        className="timeline-progress"
                                        style={{ 
                                            width: totalDuration > 0 ? `${(currentTime / totalDuration) * 100}%` : '0%' 
                                        }}
                                    />
                                    <div 
                                        className="timeline-handle"
                                        style={{ 
                                            left: totalDuration > 0 ? `${(currentTime / totalDuration) * 100}%` : '0%' 
                                        }}
                                        onMouseDown={(e) => {
                                            setIsDragging(true);
                                            const startX = e.clientX;
                                            const startTime = currentTime;
                                            const track = e.currentTarget.parentElement as HTMLElement;
                                            const trackRect = track.getBoundingClientRect();
                                            
                                            const handleMouseMove = (moveEvent: MouseEvent) => {
                                                const deltaX = moveEvent.clientX - startX;
                                                const percentage = deltaX / trackRect.width;
                                                const newTime = Math.max(0, Math.min(totalDuration, startTime + (percentage * totalDuration)));
                                                handleTimelineSeek(newTime);
                                            };
                                            
                                            const handleMouseUp = () => {
                                                setIsDragging(false);
                                                document.removeEventListener('mousemove', handleMouseMove);
                                                document.removeEventListener('mouseup', handleMouseUp);
                                            };
                                            
                                            document.addEventListener('mousemove', handleMouseMove);
                                            document.addEventListener('mouseup', handleMouseUp);
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="timeline-duration">
                                {(() => {
                                    const minutes = Math.floor(totalDuration / 60);
                                    const seconds = Math.floor(totalDuration % 60);
                                    return minutes > 0 
                                        ? `${minutes}:${seconds.toString().padStart(2, '0')}`
                                        : `0:${seconds.toString().padStart(2, '0')}`;
                                })()}
                            </div>
                        </div>
                    </div>

                    <div className="visibility-controls">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={planesVisible}
                                onChange={() => {
                                    const newVisibility = !planesVisible;
                                    setPlanesVisible(newVisibility);
                                    // The airport filter useEffect will handle the actual visibility logic
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
                                    // The airport filter useEffect will handle the actual visibility logic
                                }}
                            />
                            Display Tracks
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={trailsVisible}
                                onChange={() => {
                                    const newVisibility = !trailsVisible;
                                    setTrailsVisible(newVisibility);
                                    // The filtering useEffect will handle the actual visibility logic
                                }}
                            />
                            Display Trails
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={heatMapVisible}
                                onChange={() => {
                                    const newVisibility = !heatMapVisible;
                                    setHeatMapVisible(newVisibility);
                                }}
                            />
                            Display Heat Map
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

                        <div className={`filter-panel ${airportFilterExpanded ? 'expanded' : 'collapsed'} ${airportFilterEnabled && !airportFilterExpanded ? 'active' : ''}`}>
                            <div className="filter-header" onClick={() => setAirportFilterExpanded(!airportFilterExpanded)}>
                                <input
                                    type="checkbox"
                                    checked={airportFilterEnabled}
                                    onChange={handleAirportFilterToggle}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <span className="filter-title">Airport Filter</span>
                                {airportFilterEnabled && airportFilter && (
                                    <span className="filter-badge">{airportFilter}</span>
                                )}
                                <span className={`filter-chevron ${airportFilterExpanded ? 'expanded' : ''}`}>›</span>
                            </div>
                            
                            <div className={`filter-content ${airportFilterExpanded ? 'show' : 'hide'}`}>
                                <div className="airport-filter-controls">
                                    <input
                                        type="text"
                                        placeholder="Airport(s): EGLL, EG*, KJFK"
                                        value={airportFilter}
                                        onChange={(e) => setAirportFilter(e.target.value.toUpperCase())}
                                        className="airport-input"
                                        style={{ width: '200px' }}
                                    />
                                    <select 
                                        value={filterType} 
                                        onChange={(e) => setFilterType(e.target.value as 'dep' | 'arr' | 'both')}
                                        className="filter-type-select"
                                    >
                                        <option value="dep">Departure</option>
                                        <option value="arr">Arrival</option>
                                        <option value="both">Both</option>
                                    </select>
                                </div>
                                <div className="filter-help-text">
                                    Use wildcards (*) or comma-separated codes
                                </div>
                            </div>
                          </div>

                        <div className={`filter-panel ${altitudeFilterExpanded ? 'expanded' : 'collapsed'} ${altitudeFilterEnabled && !altitudeFilterExpanded ? 'active' : ''}`}>
                            <div className="filter-header" onClick={() => setAltitudeFilterExpanded(!altitudeFilterExpanded)}>
                                <input
                                    type="checkbox"
                                    checked={altitudeFilterEnabled}
                                    onChange={handleAltitudeFilterToggle}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <span className="filter-title">Altitude Filter</span>
                                {altitudeFilterEnabled && (
                                    <span className="filter-badge">
                                        {altitudeRange[0].toLocaleString()} - {altitudeRange[1].toLocaleString()} ft
                                    </span>
                                )}
                                <span className={`filter-chevron ${altitudeFilterExpanded ? 'expanded' : ''}`}>›</span>
                            </div>
                            
                            <div className={`filter-content ${altitudeFilterExpanded ? 'show' : 'hide'}`}>
                                <div className="altitude-filter-controls">
                                    <div className="altitude-slider-container">
                                        <ReactSlider
                                            className="altitude-slider"
                                            thumbClassName="altitude-thumb"
                                            trackClassName="altitude-track"
                                            value={altitudeRange}
                                            onChange={handleAltitudeRangeChange}
                                            min={0}
                                            max={45000}
                                            step={500}
                                            minDistance={1000}
                                            pearling={false}
                                        />
                                        <div className="altitude-labels">
                                            <span>{altitudeRange[0].toLocaleString()} ft</span>
                                            <span>{altitudeRange[1].toLocaleString()} ft</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </footer >
        </div >
    );
};

export default App;