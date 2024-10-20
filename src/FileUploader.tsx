import React from 'react';

interface FileUploaderProps {
    onFilesParsed: (data: { [fileName: string]: any }, replayLogs: { [fileName: string]: any }) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFilesParsed }) => {
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {

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