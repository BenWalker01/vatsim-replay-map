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
        const callsignData: { [key: string]: { lat: number, lng: number, alt: number, timestamp: number }[] } = {};
        lines.forEach(line => {
            if (line.startsWith("@N:")) {
                const parts = line.split(":");
                if (parts.length >= 8) {
                    const callsign = parts[1];
                    const lat = parseFloat(parts[4]);
                    const lng = parseFloat(parts[5]);
                    const alt = parseFloat(parts[6]);
                    const timestamp = parseFloat(parts[7]);

                    if (!callsignData[callsign]) {
                        callsignData[callsign] = [];
                    }
                    callsignData[callsign].push({ lat, lng, alt, timestamp });
                }
            }
        });
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