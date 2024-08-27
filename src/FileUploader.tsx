import React from 'react';

interface FileUploaderProps {
    onFilesParsed: (data: { [fileName: string]: any }) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFilesParsed }) => {
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            const fileData: { [fileName: string]: any } = {};
            let filesProcessed = 0;

            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const contents = e.target?.result;
                    if (contents) {
                        const parsedData = parseFileData(contents as string);
                        console.log(contents)
                        fileData[file.name] = parsedData;
                        filesProcessed++;
                        if (filesProcessed === files.length) {
                            onFilesParsed(fileData);
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
            const line = lines[i]
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
        };
        return callsignData;
    };

    const generateReplay = (data: string) => {
        const lines = data.split("\n");
        const callsignData: { [key: string]: { lat: number, lng: number, alt: number, offset: number, currentlyWith: string }[] } = {};
        const planesWith: { [key: string]: { controller: string } } = {}
        let startTimeInSeconds;
        for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i]
            if (line.startsWith("$CQ")) {
                const parts = line.trim().split(":")
                if (parts[2] === "HT") { // handoff accepted??

                    const to = parts[0].substring(3);
                    const cs = parts[3];
                    planesWith[cs] = { controller: to };
                }

            }
            if (line.startsWith("@N:")) { // plane position ??
                if (!startTimeInSeconds) {
                    const startTime = lines[i - 1].slice(1, -1).split(" ")[0];
                    const [startHours, startMinutes, startSeconds] = startTime.split(":").map(Number);
                    startTimeInSeconds = startHours * 3600 + startMinutes * 60 + startSeconds;
                }
                const parts = line.split(":");
                if (parts.length >= 8) {
                    const callsign = parts[1];
                    const lat = parseFloat(parts[4]);
                    const lng = parseFloat(parts[5]);
                    const alt = parseFloat(parts[6]);
                    const timeLine = lines[i - 1]
                    const time = timeLine.slice(1, -1).split(" ")[0]
                    const [hours, minutes, seconds] = time.split(":").map(Number);
                    const timeInSeconds = hours * 3600 + minutes * 60 + seconds;
                    const offset = timeInSeconds - startTimeInSeconds
                    if (!callsignData[callsign]) {
                        callsignData[callsign] = [];
                    }
                    if (Object.keys(planesWith).includes(callsign)) {
                        callsignData[callsign].push({ lat, lng, alt, offset, currentlyWith: planesWith[callsign].controller });
                    } else {
                        callsignData[callsign].push({ lat, lng, alt, offset, currentlyWith: "default" });
                    }
                }
            }
        };
        return callsignData;
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