import './App.css';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Layer, polyline, Map } from 'leaflet';
import MapComponent from './MapComponent';
import FileUploader from './FileUploader';
import { douglasPeucker, getColourByAlt, generateCircle, hashString, getColorFromHash } from './utils';
import ReactSlider from "react-slider";
import debounce from "lodash/debounce"


const App: React.FC = () => {
    const [fileData, setFileData] = useState<{ [fileName: string]: any }>({});
    const [replayPath, setFilePath] = useState<{ [offset: number]: { [callsign: string]: { lat: number, lng: number, currentlyWith: string } } }>({});
    const [fileVisibility, setFileVisibility] = useState<{ [fileName: string]: boolean }>({});
    const [drawnLayers, setDrawnLayers] = useState<{ [fileName: string]: Layer[] }>({});
    const [leafletMap, setLeafletMap] = useState<Map | null>(null);
    const [sliderValues, setSliderValues] = useState<[number, number]>([0, 100]);
    const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
    const [isLogging, setIsLogging] = useState(false);
    const [counter, setCounter] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [pauseStartTime, setPauseStartTime] = useState<Date | null>(null);
    const [remainingTime, setRemainingTime] = useState(0);
    const [coords, setCoords] = useState<{ [key: string]: { lat: number, lng: number, alt: number }[] }>({});
    const [speed, setSpeed] = useState(1);
    const [seenAtcos] = useState<{ [key: string]: string }>({});
    const circlesRef = useRef<Array<[string, L.Circle<any>]>>([]);
    const prevCoordsRef = useRef<{ [key: string]: { lat: number, lng: number } }>({});


    const drawLines = useCallback((callsignData: { [key: string]: { lat: number, lng: number, alt: number }[] }, fileName: string) => {
        if (!leafletMap) return;

        setDrawnLayers(prevLayers => {
            if (prevLayers[fileName]) {
                prevLayers[fileName].forEach(layer => leafletMap.removeLayer(layer));
            }
            return { ...prevLayers, [fileName]: [] };
        });

        if (!fileVisibility[fileName]) return;


        const newLayers: Layer[] = [];
        Object.keys(callsignData).forEach(callsign => {
            const coords = callsignData[callsign].map(({ lat, lng, alt }) => ({ lat, lng, alt }));
            setCoords(prevCoords => ({ ...prevCoords, [callsign]: coords }));
            const simplifiedCoords = douglasPeucker(coords, 0.001); // Adjust epsilon as needed


            for (let i = 0; i < simplifiedCoords.length - 1; i++) {
                const { lat: lat1, lng: lng1, alt: alt1 } = simplifiedCoords[i];
                const { lat: lat2, lng: lng2, alt: alt2 } = simplifiedCoords[i + 1];
                const avgAlt = (alt1 + alt2) / 2;
                const color = getColourByAlt(avgAlt);
                const line = polyline([[lat1, lng1], [lat2, lng2]], { color });
                line.addTo(leafletMap);
                newLayers.push(line);
            }
        });

        setDrawnLayers(prevLayers => ({ ...prevLayers, [fileName]: newLayers }));
    }, [leafletMap, fileVisibility, setDrawnLayers]);

    const handleFileParsed = (data: { [fileName: string]: any }) => {
        setFileData(prevData => ({ ...prevData, ...data }));
        const newVisibility = Object.keys(data).reduce((acc, fileName) => {
            acc[fileName] = true;
            return acc;
        }, {} as { [fileName: string]: boolean });
        setFileVisibility(prevVisibility => ({ ...prevVisibility, ...newVisibility }));
    };

    const handleVisibilityChange = (fileName: string) => {
        setFileVisibility(prevVisibility => ({
            ...prevVisibility,
            [fileName]: !prevVisibility[fileName]
        }));
    };

    const handlePlayClick = () => {
        if (!isLogging) {
            const intervalDuration = 1000 / speed;
            const id = setInterval(() => {
                setCounter(prevCounter => prevCounter + 1);
            }, intervalDuration);
            setIntervalId(id);
            setIsLogging(true);
            setIsPaused(false);
        }
    };

    const handlePauseClick = () => {
        if (isPaused) {
            // Resume logging
            if (pauseStartTime) {
                const currentTime = new Date();
                const pausedDuration = currentTime.getTime() - pauseStartTime.getTime();
                const newRemainingTime = remainingTime - pausedDuration;

                setTimeout(() => {
                    const intervalDuration = 1000 / speed;
                    const id = setInterval(() => {
                        setCounter(prevCounter => prevCounter + 1);
                    }, intervalDuration);
                    setIntervalId(id);
                }, newRemainingTime);

                setIsPaused(false);
                setPauseStartTime(null);
            }
        } else {
            // Pause logging
            if (intervalId) {
                clearInterval(intervalId);
                setIntervalId(null);
                setIsPaused(true);
                setPauseStartTime(new Date());
                const currentTime = new Date();
                const elapsedTime = currentTime.getTime() % (1000 / speed);
                setRemainingTime((1000 / speed) - elapsedTime);
            }
        }
    };

    const handleIncreaseSpeed = () => {
        setSpeed(prevSpeed => prevSpeed + 1)
    }
    const handleDecreaseSpeed = () => {
        setSpeed(prevSpeed => (prevSpeed > 1 ? prevSpeed - 1 : 1)); // Ensure speed doesn't go below 1
    };

    useEffect(() => {
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [intervalId]);

    useEffect(() => {
        //TODO
    }, []);



    useEffect(() => {
        Object.keys(fileData).forEach(fileName => {
            drawLines(fileData[fileName], fileName);
        });
    }, [fileData, fileVisibility, drawLines, sliderValues]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const debouncedSetSliderValues = useCallback(debounce((values: [number, number]) => setSliderValues(values), 300), []);

    return (
        <div className="app-container">
            <header className="header">
                <h1>VATSIM Replay Map</h1>
                <nav>
                    <div className="nav-title">File Visibility</div>
                    <div className="file-visibility-controls">
                        {Object.keys(fileVisibility).map(fileName => (
                            <label key={fileName} className="file-visibility-label">
                                <input
                                    type="checkbox"
                                    checked={fileVisibility[fileName]}
                                    onChange={() => handleVisibilityChange(fileName)}
                                />
                                <span>{fileName}</span>
                            </label>
                        ))}
                    </div>
                    <FileUploader onFilesParsed={handleFileParsed} />
                </nav>
            </header>
            <MapComponent
                drawnLayers={drawnLayers}
                setDrawnLayers={setDrawnLayers}
                showTracks={true}
                setLeafletMapRef={setLeafletMap}
            />
            <footer className="toolbar">
                <div className="replay-system">
                    <button onClick={handlePlayClick}>Play</button>
                    <button onClick={handlePauseClick}>{isPaused ? 'Resume' : 'Pause'}</button>
                    <div className="speed-controls">
                        <button onClick={handleDecreaseSpeed}>Decrease Speed</button>
                        <span className="speed-text">{speed}x</span>
                        <button onClick={handleIncreaseSpeed}>Increase Speed</button>
                    </div>
                </div>
                <div className="slider-container">
                    <div className="slider-values">
                        <span>Min: {Math.round(((sliderValues[0] / 100) * 400) * 100).toLocaleString()}ft</span>
                        <span>Max: {Math.round(((sliderValues[1] / 100) * 400) * 100).toLocaleString()}ft</span>
                    </div>
                    <ReactSlider
                        className="horizontal-slider"
                        thumbClassName="example-thumb"
                        trackClassName="example-track"
                        defaultValue={[0, 100]}
                        ariaLabel={["lower", "upper"]}
                        ariaValuetext={state => `Thumb value ${state.valueNow}`}
                        pearling
                        minDistance={10}
                        onChange={debouncedSetSliderValues}
                    />
                </div>
            </footer>
        </div>
    );
};
export default App;