import React, { Component } from 'react';
import Plane from './Plane'; // Import the Plane component

interface Position {
    time: string;
    callsign: string;
    lat: number;
    lon: number;
    altitude: number;
}

interface ReplayComponentProps {
    fileContent: string;
}

interface ReplayComponentState {
    planes: { [key: string]: Position[] };
}

class ReplayComponent extends Component<ReplayComponentProps, ReplayComponentState> {
    constructor(props: ReplayComponentProps) {
        super(props);
        this.state = {
            planes: {}, // Store positions for each plane
        };
    }

    componentDidMount() {
        const parsedPositions = this.parseReplayFile(this.props.fileContent);
        this.groupByPlanes(parsedPositions);
    }

    parseReplayFile(fileContent: string): Position[] {
        const lines = fileContent.split("\n");
        return lines.map(line => {
            const match = line.match(/^\[(\d{2}:\d{2}:\d{2}) >>>> ([^\]]+)\]@\w+:(.*)/);
            if (match) {
                const time = match[1];
                const callsign = match[2];
                const [lat, lon, altitude] = match[3].split(":").slice(4, 7).map(Number);
                return { time, callsign, lat, lon, altitude };
            }
            return null;
        }).filter((pos): pos is Position => pos !== null); // Type guard to filter null entries
    }

    groupByPlanes(parsedPositions: Position[]) {
        const planes: { [key: string]: Position[] } = {};

        parsedPositions.forEach(pos => {
            if (!planes[pos.callsign]) {
                planes[pos.callsign] = [];
            }
            planes[pos.callsign].push(pos);
        });

        this.setState({ planes });
    }

    render() {
        const { planes } = this.state;

        return (
            <div>
                {Object.keys(planes).map(callsign => (
                    <Plane
                        key={callsign}
                        callsign={callsign}
                        positions={planes[callsign]}
                        initialPosition={planes[callsign][0]} // Pass the initial position
                    />
                ))}
            </div>
        );
    }
}

export default ReplayComponent;
