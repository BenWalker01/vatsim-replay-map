import React, { Component } from 'react';

interface Position {
    time: string;
    lat: number;
    lon: number;
    altitude: number;
}

interface PlaneProps {
    callsign: string;
    positions: Position[];
    initialPosition: Position;
}

interface PlaneState {
    position: Position;
    index: number;
}

class Plane extends Component<PlaneProps, PlaneState> {
    private timer: NodeJS.Timeout | null = null;

    constructor(props: PlaneProps) {
        super(props);
        this.state = {
            position: this.props.initialPosition, // Initialize with the first position
            index: 0,
        };
    }

    componentDidMount() {
        this.startReplay();
    }

    componentWillUnmount() {
        if (this.timer) clearTimeout(this.timer);
    }

    startReplay() {
        const { positions } = this.props;

        const updatePosition = () => {
            if (this.state.index >= positions.length - 1) return;

            const nextIndex = this.state.index + 1;
            const nextPosition = positions[nextIndex];
            const timeDiff = this.calculateTimeDifference(this.state.position.time, nextPosition.time);

            this.timer = setTimeout(() => {
                this.setState({ position: nextPosition, index: nextIndex }, updatePosition);
            }, timeDiff);
        };

        updatePosition();
    }

    calculateTimeDifference(start: string, end: string): number {
        const [startH, startM, startS] = start.split(":").map(Number);
        const [endH, endM, endS] = end.split(":").map(Number);
        const startTime = startH * 3600 + startM * 60 + startS;
        const endTime = endH * 3600 + endM * 60 + endS;
        return (endTime - startTime) * 1000; // Convert to milliseconds
    }

    render() {
        const { callsign } = this.props;
        const { position } = this.state;

        return (
            <div>
                <h3>Callsign: {callsign}</h3>
                <p>Latitude: {position.lat}</p>
                <p>Longitude: {position.lon}</p>
                <p>Altitude: {position.altitude} feet</p>
            </div>
        );
    }
}

export default Plane;
