import './App.css';
import React, { useEffect, useState, useCallback } from 'react';
import { Layer, polyline, Map } from 'leaflet';
import MapComponent from './MapComponent';
import FileUploader from './FileUploader';
import { douglasPeucker, getColourByAlt } from './utils';
import ReactSlider from "react-slider";
import debounce from "lodash/debounce"

const App: React.FC = () => {
    const [fileData, setFileData] = useState<{ [fileName: string]: any }>({});
    const [fileVisibility, setFileVisibility] = useState<{ [fileName: string]: boolean }>({});
    const [drawnLayers, setDrawnLayers] = useState<{ [fileName: string]: Layer[] }>({});
    const [leafletMap, setLeafletMap] = useState<Map | null>(null);
    const [sliderValues, setSliderValues] = useState<[number, number]>([0, 100])

    const drawLines = useCallback((callsignData: { [key: string]: { lat: number, lng: number, alt: number, timestamp: number }[] }, fileName: string) => {
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
            const coords = callsignData[callsign].map(({ lat, lng, alt, timestamp }) => ({ lat, lng, alt, timestamp }));
            const simplifiedCoords = douglasPeucker(coords, 0.001); // Adjust epsilon as needed
            for (let i = 0; i < simplifiedCoords.length - 1; i++) {
                const { lat: lat1, lng: lng1, alt: alt1 } = simplifiedCoords[i];
                const { lat: lat2, lng: lng2, alt: alt2 } = simplifiedCoords[i + 1];
                const avgAlt = (alt1 + alt2) / 2;
                if (avgAlt >= (sliderValues[0] / 100) * 40000 && avgAlt <= (sliderValues[1] / 100) * 40000) {
                    const color = getColourByAlt(avgAlt);
                    const line = polyline([[lat1, lng1], [lat2, lng2]], { color, weight: 2 }).addTo(leafletMap);
                    newLayers.push(line);
                }
            }
        });

        setDrawnLayers(prevLayers => ({ ...prevLayers, [fileName]: newLayers }));
    }, [leafletMap, fileVisibility, sliderValues]);

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
                    <label className="wip-label">WIP: Replay system</label>
                    <button>Play</button>
                    <button>Pause</button>
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