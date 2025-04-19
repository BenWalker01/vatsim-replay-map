import React from 'react';
import { getColorFromAtc } from './utils';

interface FileUploaderProps {
    onFilesParsed: (data: { [fileName: string]: any }, replayLogs: { [fileName: string]: any }) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFilesParsed }) => {
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            const fileData: { [fileName: string]: any } = {};
            const replayLogs: { [fileName: string]: any } = {};
            let filesProcessed = 0;

            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const contents = e.target?.result;
                    if (contents) {
                        const parsedData = parseFileData(contents as string);
                        const replayLog = generateReplay(contents as string);
                        fileData[file.name] = parsedData;
                        replayLogs[file.name] = replayLog;
                        filesProcessed++;
                        if (filesProcessed === files.length) {
                            onFilesParsed(fileData, replayLogs);
                        }
                    }
                };
                reader.readAsText(file);
            });
        }
    };

    const parseFileData = (data: string) => {
        const lines = data.split("\n");
        const callsignData: { [key: string]: { lat: number, lng: number, alt: number }[] } = {};
        for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i];
            if (line.startsWith("@N:")) { // plane position ??
                const parts = line.split(":");
                if (parts.length >= 8) {
                    const callsign = parts[1];
                    const lat = parseFloat(parts[4]);
                    const lng = parseFloat(parts[5]);
                    const alt = parseFloat(parts[6]);
                    if (!callsignData[callsign]) {
                        callsignData[callsign] = [];
                    }
                    callsignData[callsign].push({ lat, lng, alt });
                }
            }
        }
        return callsignData;
    };

    const generateReplay = (data: string) => {
        const replayLogGlobal: { [offset: number]: { [callsign: string]: { lat: number, lng: number, colour: string } } } = {};
        const replayLog: { [callsign: string]: { coords: [[lat: number, lng: number]], delay: number, colours: [string] } } = {}
        const planesWith: { [callsign: string]: { to: string, from: string, first: boolean } } = {};
        const lines = data.split("\n");
        let startTimeInSeconds;

        for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i];
            if (line.startsWith("$CQ")) { // work out which atco has the plane. TODO. Back fill
                const parts = line.trim().split(":");
                if (parts[2] === "HT") { // handoff accepted??
                    if (!planesWith[parts[3]]) {
                        planesWith[parts[3]] = { to: '', from: '', first: false };
                    }
                    if (!Object.keys(planesWith).includes(parts[3])) {
                        planesWith[parts[3]].first = true;
                    } else {
                        planesWith[parts[3]].first = false;
                    }
                    planesWith[parts[3]].to = parts[0].substring(3);
                    planesWith[parts[3]].from = parts[4];
                } else if (parts[2] === "WH") {
                    if (!planesWith[parts[3]]) {
                        planesWith[parts[3]] = { to: '', from: '', first: false };
                    }
                    if (!Object.keys(planesWith).includes(parts[3])) {
                        planesWith[parts[3]].first = true;
                    } else {
                        planesWith[parts[3]].first = false;
                    }
                    planesWith[parts[3]].to = parts[0].substring(3);
                }
            }
            if (line.startsWith("@N:")) { // plane position
                if (!startTimeInSeconds) { // first plane movement of the file
                    const startTime = lines[i - 1].slice(1, -1).split(" ")[0];
                    const [startHours, startMinutes, startSeconds] = startTime.split(":").map(Number);
                    startTimeInSeconds = startHours * 3600 + startMinutes * 60 + startSeconds;
                }
                const parts = line.split(":");
                if (parts.length >= 8) {
                    const callsign = parts[1];
                    const lat = parseFloat(parts[4]);
                    const lng = parseFloat(parts[5]);
                    const timeLine = lines[i - 1];
                    const time = timeLine.slice(1, -1).split(" ")[0];
                    const [hours, minutes, seconds] = time.split(":").map(Number);
                    const timeInSeconds = hours * 3600 + minutes * 60 + seconds;
                    const offset = timeInSeconds - startTimeInSeconds;


                    if (Object.keys(replayLog).includes(callsign)) {
                        if (Object.keys(planesWith).includes(callsign)) {
                            replayLog[callsign].coords.push([lat, lng])
                            replayLog[callsign].colours.push(getColorFromAtc(planesWith[callsign].to))
                        } else {
                            replayLog[callsign].coords.push([lat, lng])
                            replayLog[callsign].colours.push("blue")
                        }
                    } else {
                        if (Object.keys(planesWith).includes(callsign)) {
                            replayLog[callsign] = { coords: [[lat, lng]], delay: offset, colours: [getColorFromAtc(planesWith[callsign].to)] }
                        } else {
                            replayLog[callsign] = { coords: [[lat, lng]], delay: offset, colours: ["blue"] }
                        }
                    }
                }
            }
        }

        let maxDelay = 0;

        for (const callsign in replayLog) {
            if (replayLog.hasOwnProperty(callsign)) {
                const log = replayLog[callsign];
                maxDelay = Math.max(maxDelay, log.coords.length + log.delay);
                for (let i = log.delay; i < log.coords.length; i++) {
                    if (!replayLogGlobal[i + log.delay]) {
                        replayLogGlobal[i + log.delay] = {};
                    }
                    replayLogGlobal[i + log.delay][callsign] = { lat: log.coords[i][0], lng: log.coords[i][1], colour: log.colours[i] };
                }
            }
        }
        console.log("Global");
        console.log(replayLogGlobal);
        console.log(maxDelay)

        return replayLog;
    };

    return (
        <div>
            <button onClick={() => document.getElementById('fileInput')?.click()}>
                Open Replay Files
            </button>
            <input
                type="file"
                id="fileInput"
                style={{ display: 'none' }}
                multiple
                onChange={handleFileChange}
            />
        </div>
    );
};

export default FileUploader;