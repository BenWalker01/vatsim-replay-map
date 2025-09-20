import L from 'leaflet';
import { douglasPeucker, getColourByAlt, getColorFromAtc, parseAirportFilter, matchesAnyAirportPattern } from './utils';

// Define position with timing information
export interface TimedPosition {
    lat: number;
    lng: number;
    time: number; // Time in milliseconds from start
    altitude?: number;
    heading?: number;
    atc?: string
}

interface DotOptions {
    color?: string;
    radius?: number;
    fillOpacity?: number;
    weight?: number;
    callsign?: string;
    altitude?: number;
    heading?: number;
    dest?: string;
    dep?: string;
}

class Dot {
    private map: L.Map;
    private marker: L.CircleMarker | null = null;
    private position: L.LatLngExpression;
    private options: DotOptions;
    private animationId: number | null = null;
    private positions: TimedPosition[] = [];
    private currentPositionIndex: number = 0;
    private trackSegments: L.LayerGroup = L.layerGroup();
    private trackPath: L.Polyline | null = null;
    private colourSettings: boolean = true;
    private currentAnimationTime: number = 0; // Track current animation progress in milliseconds
    private animationStartTime: number = 0; // When the current animation session started
    private isAnimationPaused: boolean = false;
    private trailPoints: L.LatLng[] = []; // Store trail points for performance
    private trailPolyline: L.Polyline | null = null; // Single polyline for better performance
    private maxTrailPoints: number = 6; // Very short trail length for performance
    private trailsVisible: boolean = false; // Track if trails should be visible
    private lastSpeed: number = 0; // Track last calculated speed


    constructor(map: L.Map, position: L.LatLngExpression, options: DotOptions = {}) {
        this.map = map;
        this.position = position;
        this.options = {
            color: options.color || getColorFromAtc(options.dest || ''),
            radius: options.radius || 3,
            fillOpacity: options.fillOpacity || 0.8,
            weight: options.weight || 1,
            callsign: options.callsign,
            altitude: options.altitude,
            heading: options.heading,
            dest: options.dest,
            dep: options.dep,
        };
        this.trackSegments = L.layerGroup();

    }

    private generateTracks(): this {
        if (this.trackSegments.getLayers().length > 0) {
            console.log("Tracks already defined");

        } else {
            const points = this.positions.map(pos => ({ lat: pos.lat, lng: pos.lng, alt: pos.altitude || 0 }));
            const dpPoints = douglasPeucker(points, 0.001); // Add appropriate epsilon value

            for (let i = 0; i < dpPoints.length - 1; i++) {
                const current = dpPoints[i];
                const next = dpPoints[i + 1];

                // Calculate average altitude for this segment
                const avgAltitude = Math.round((current.alt + next.alt) / 2);

                // Get color based on average altitude
                const color = getColourByAlt(avgAltitude);

                // Create polyline for this segment
                const segment = L.polyline(
                    [[current.lat, current.lng], [next.lat, next.lng]],
                    {
                        color: color,
                        weight: 2,
                        opacity: 0.7,
                        smoothFactor: 1
                    }
                )

                this.trackSegments.addLayer(segment);

            }
        }
        if (this.trackPath) {
            console.log("Path already exists");
        } else {

            const pathPoints = this.positions.map(pos => [pos.lat, pos.lng] as L.LatLngTuple);

            // Create polyline with styling
            this.trackPath = L.polyline(pathPoints, {
                color: this.options.color || '#3388ff',
                weight: 2,
                opacity: 0.7,
                smoothFactor: 1
            })

        }
        return this;
    }

    public draw(): this {
        if (this.marker) {
            this.remove();
        }

        this.marker = L.circleMarker(this.position, {
            color: this.options.color,
            radius: this.options.radius ?? 5,
            fillOpacity: this.options.fillOpacity,
            weight: this.options.weight,
            fillColor: this.options.color
        }).addTo(this.map);

        // Add tooltip if callsign is provided
        if (this.options.callsign) {
            let tooltipContent = `${this.options.callsign}`;
            if (this.options.altitude) {
                tooltipContent += `<br>Alt: ${this.options.altitude} ft`;
            }
            if (this.options.heading !== undefined) {
                tooltipContent += `<br>Hdg: ${this.options.heading}°`;
            }

            this.marker.bindTooltip(tooltipContent, {
                permanent: false,
                direction: 'top'
            });
        }

        return this;
    }

    public displayTracks(): this {
        this.hideTracks();
        if (this.colourSettings) {
            this.trackSegments.addTo(this.map);
        } else {
            if (this.trackPath) {
                this.trackPath.addTo(this.map);
            }

        }
        return this;
    }

    public hideTracks(): this {
        this.trackSegments.remove();
        if (this.trackPath) this.trackPath.remove();
        return this;
    }


    public updatePosition(newPosition: L.LatLngExpression): this {
        this.position = newPosition;
        if (this.marker) {
            this.marker.setLatLng(newPosition);
        }
        
        // Add point to trail for performance-optimized trail rendering
        this.addTrailPoint(newPosition);
        
        return this;
    }

    /**
     * Add a point to the trail with performance optimization and speed-based length
     */
    private addTrailPoint(position: L.LatLngExpression): void {
        const latLng = L.latLng(position as any);
        
        // Calculate speed and adjust trail length with non-linear scaling
        let dynamicTrailLength = 8; // Default trail length
        if (this.trailPoints.length > 0) {
            const lastPoint = this.trailPoints[this.trailPoints.length - 1];
            const distance = lastPoint.distanceTo(latLng); // meters
            
            // Only add point if moved more than ~50 meters for smoother animation
            if (distance < 50) {
                return;
            }
            
            // Calculate speed-based trail length with inverse relationship
            const speed = distance * 1.5; // Rough speed factor
            
            // Non-linear scaling: slower speeds get longer trails, faster speeds get shorter trails
            // Using inverse square root for smooth non-linear relationship
            const normalizedSpeed = Math.min(speed / 1000, 1); // Normalize speed (0-1)
            
            // Inverse relationship: high speed = short trail, low speed = long trail
            // Using 1 - sqrt(speed) for smoother curve
            const speedFactor = 1 - Math.sqrt(normalizedSpeed);
            
            // Trail length: 5 points (fast) to 12 points (slow/stationary)
            const minLength = 5;  // Minimum for fast aircraft
            const maxLength = 12; // Maximum for slow aircraft
            dynamicTrailLength = Math.round(minLength + (maxLength - minLength) * speedFactor);
        }
        
        // Add new point
        this.trailPoints.push(latLng);
        
        // Limit trail length based on speed (non-linear relationship)
        while (this.trailPoints.length > dynamicTrailLength) {
            this.trailPoints.shift(); // Remove oldest point
        }
        
        // Update trail immediately if visible for seamless animation
        if (this.trailsVisible && this.trailPoints.length > 1) {
            this.updateTrail();
        }
    }

    /**
     * Update trail with single polyline for better performance
     */
    private updateTrail(): void {
        if (this.trailPoints.length < 2) {
            return;
        }

        // Update existing polyline or create new one
        if (this.trailPolyline) {
            // Just update the coordinates for better performance
            this.trailPolyline.setLatLngs(this.trailPoints);
        } else {
            // Create new polyline
            this.trailPolyline = L.polyline(this.trailPoints, {
                color: this.options.color || '#3388ff',
                weight: 2,
                opacity: 0.4, // Single opacity for performance
                interactive: false,
                smoothFactor: 1
            });

            // Add to map if trails are visible
            if (this.trailsVisible) {
                this.trailPolyline.addTo(this.map);
            }
        }
    }

    /**
     * Show or hide the trail
     */
    public setTrailVisible(visible: boolean): this {
        this.trailsVisible = visible;
        
        if (visible && this.trailPoints.length > 1) {
            // Update and show trail
            this.updateTrail();
        } else if (this.trailPolyline) {
            // Hide trail
            this.trailPolyline.remove();
        }
        return this;
    }

    /**
     * Clear the trail
     */
    public clearTrail(): this {
        this.trailPoints = [];
        // Remove trail polyline
        if (this.trailPolyline) {
            this.trailPolyline.remove();
            this.trailPolyline = null;
        }
        this.lastSpeed = 0;
        return this;
    }

    /**
     * Set the timeline of positions for this dot
     * @param positions Array of timed positions (lat, lng, time from start)
     */
    public setPositions(positions: TimedPosition[]): this {
        // Ensure positions are sorted by time
        this.positions = [...positions].sort((a, b) => a.time - b.time);
        this.currentPositionIndex = 0;
        this.currentAnimationTime = 0;
        this.animationStartTime = 0;
        this.isAnimationPaused = false;

        this.generateTracks();

        // If we have positions, set initial position to the first one
        if (this.positions.length > 0) {
            const initial = this.positions[0];
            this.updatePosition([initial.lat, initial.lng]);

            // Update options if provided
            const newOptions: Partial<DotOptions> = {};
            if (initial.altitude !== undefined) newOptions.altitude = initial.altitude;
            if (initial.heading !== undefined) newOptions.heading = initial.heading;
            if (Object.keys(newOptions).length > 0) {
                this.updateOptions(newOptions);
            }
        }

        return this;
    }

    /**
     * Animate the dot according to its predefined positions and timings
     * @param speedFactor Speed multiplier (1 = normal, 2 = twice as fast)
     * @param onComplete Callback function when animation completes
     * @param resumeFromCurrent Whether to resume from current position (default: true)
     */
    public animate(speedFactor: number = 1, onComplete?: () => void, resumeFromCurrent: boolean = true): this {
        // Cancel any existing animation
        this.stopAnimation();

        // Need at least 2 positions to animate
        if (!this.marker || this.positions.length < 2) {
            return this;
        }

        // If we're not resuming or if this is the first animation, reset to start
        if (!resumeFromCurrent || this.currentAnimationTime === 0) {
            this.currentAnimationTime = 0;
            this.isAnimationPaused = false;
        } else {
            // We're resuming, so don't reset the current time
            this.isAnimationPaused = false;
        }

        // Calculate the animation start time based on current progress and speed
        this.animationStartTime = performance.now() - (this.currentAnimationTime / speedFactor);

        // Hide the marker initially if we're at the very start and first position has delay
        if (this.currentAnimationTime === 0 && this.positions[0].time > 0 && this.marker) {
            this.marker.setStyle({ opacity: 0, fillOpacity: 0 });
        }

        const totalDuration = this.positions[this.positions.length - 1].time;

        const animate = (currentTime: number) => {
            const elapsedTime = (currentTime - this.animationStartTime) * speedFactor;
            this.currentAnimationTime = elapsedTime;

            // If we haven't reached the first position yet, keep the marker hidden
            if (elapsedTime < this.positions[0].time) {
                if (this.marker) {
                    this.marker.setStyle({ opacity: 0, fillOpacity: 0 });
                }
                this.animationId = requestAnimationFrame(animate);
                return;
            } else if (this.marker &&
                (this.marker.options.opacity === 0 || this.marker.options.fillOpacity === 0)) {
                // Show the marker when we reach the first position time
                this.marker.setStyle({
                    opacity: 1,
                    fillOpacity: this.options.fillOpacity || 0.8
                });
            }

            // Animation complete
            if (elapsedTime >= totalDuration) {
                // Move to final position
                const finalPos = this.positions[this.positions.length - 1];
                this.updatePosition([finalPos.lat, finalPos.lng]);

                // Update final altitude/heading if available
                const finalOptions: Partial<DotOptions> = {};
                if (finalPos.altitude !== undefined) finalOptions.altitude = finalPos.altitude;
                if (finalPos.heading !== undefined) finalOptions.heading = finalPos.heading;
                if (Object.keys(finalOptions).length > 0) {
                    this.updateOptions(finalOptions);
                }

                // Hide the plane and clear trail when animation is complete
                this.setVisible(false);
                this.clearTrail(); // Clear trail when plane disappears
                this.animationId = null;
                this.currentAnimationTime = totalDuration;

                if (onComplete) {
                    onComplete();
                }
                return;
            }

            // Find current position based on elapsed time
            // Find the positions before and after the current time
            let nextIndex = this.positions.findIndex(pos => pos.time > elapsedTime);
            if (nextIndex === -1) nextIndex = this.positions.length - 1;
            if (nextIndex === 0) nextIndex = 1; // Ensure we have a previous position

            const prevIndex = nextIndex - 1;
            const prevPos = this.positions[prevIndex];
            const nextPos = this.positions[nextIndex];

            // Calculate progress between the two positions
            const segmentDuration = nextPos.time - prevPos.time;
            const segmentProgress = segmentDuration > 0
                ? (elapsedTime - prevPos.time) / segmentDuration
                : 1;

            // Interpolate position
            const newLat = prevPos.lat + (nextPos.lat - prevPos.lat) * segmentProgress;
            const newLng = prevPos.lng + (nextPos.lng - prevPos.lng) * segmentProgress;

            // Update position
            this.updatePosition([newLat, newLng]);

            // Interpolate altitude and heading if available
            const newOptions: Partial<DotOptions> = {};

            if (prevPos.altitude !== undefined && nextPos.altitude !== undefined) {
                newOptions.altitude = Math.round(
                    prevPos.altitude + (nextPos.altitude - prevPos.altitude) * segmentProgress
                );
            }

            if (prevPos.heading !== undefined && nextPos.heading !== undefined) {
                // Handle heading interpolation (keeping existing logic)
                newOptions.heading = prevPos.heading + (nextPos.heading - prevPos.heading) * segmentProgress;
            }

            if (Object.keys(newOptions).length > 0) {
                this.updateOptions(newOptions);
            }

            // Request next frame
            this.animationId = requestAnimationFrame(animate);
        };

        // Start animation
        this.animationId = requestAnimationFrame(animate);

        return this;
    }

    public stopAnimation(): this {
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
            this.isAnimationPaused = true;
        }
        return this;
    }

    /**
     * Reset the animation to the beginning
     */
    public resetAnimation(): this {
        this.stopAnimation();
        this.currentAnimationTime = 0;
        this.animationStartTime = 0;
        this.isAnimationPaused = false;
        
        // Clear trail when resetting
        this.clearTrail();

        // Reset to initial position if we have positions (without adding to trail)
        if (this.positions.length > 0) {
            const initial = this.positions[0];
            this.position = [initial.lat, initial.lng];
            if (this.marker) {
                this.marker.setLatLng([initial.lat, initial.lng]);
            }

            // Update initial options
            const initialOptions: Partial<DotOptions> = {};
            if (initial.altitude !== undefined) initialOptions.altitude = initial.altitude;
            if (initial.heading !== undefined) initialOptions.heading = initial.heading;
            if (Object.keys(initialOptions).length > 0) {
                this.updateOptions(initialOptions);
            }

            // Hide the marker if the first position has a start time > 0
            if (this.marker && initial.time > 0) {
                this.marker.setStyle({ opacity: 0, fillOpacity: 0 });
            } else if (this.marker) {
                this.marker.setStyle({
                    opacity: 1,
                    fillOpacity: this.options.fillOpacity || 0.8
                });
            }
        }

        return this;
    }

    public updateOptions(options: Partial<DotOptions>): this {
        this.options = { ...this.options, ...options };

        // If marker exists, update its properties
        if (this.marker) {
            this.marker.setStyle({
                color: this.options.color,
                radius: this.options.radius ?? 5,
                fillOpacity: this.options.fillOpacity,
                weight: this.options.weight,
                fillColor: this.options.color
            });

            // Update tooltip if necessary
            if (this.options.callsign && this.marker.getTooltip()) {
                let tooltipContent = `${this.options.callsign}`;
                if (this.options.altitude) {
                    tooltipContent += `<br>Alt: ${this.options.altitude} ft`;
                }
                if (this.options.heading !== undefined) {
                    tooltipContent += `<br>Hdg: ${this.options.heading}°`;
                }

                this.marker.setTooltipContent(tooltipContent);
            }
        }

        return this;
    }

    public setVisible(visible: boolean): this {
        if (this.marker) {
            this.marker.setStyle({
                opacity: visible ? 1 : 0,
                fillOpacity: visible ? (this.options.fillOpacity || 0.8) : 0
            });
        }
        
        // Also hide/show trail when hiding/showing the plane
        if (!visible && this.trailPolyline) {
            this.trailPolyline.remove();
        } else if (visible && this.trailsVisible && this.trailPolyline && this.trailPoints.length > 1) {
            this.trailPolyline.addTo(this.map);
        }
        
        return this;
    }

    /**
     * Get the current position of the aircraft
     */
    public getCurrentPosition(): { lat: number; lng: number } | null {
        if (!this.marker) return null;
        
        const latLng = this.marker.getLatLng();
        return {
            lat: latLng.lat,
            lng: latLng.lng
        };
    }

    public remove(): this {
        this.stopAnimation();
        this.clearTrail(); // Clean up trail when removing dot
        if (this.marker) {
            this.marker.remove();
            this.marker = null;
        }

        return this;
    }

    public getMarker(): L.CircleMarker | null {
        return this.marker;
    }

    public getColourSetting(): boolean {
        return this.colourSettings;
    }

    public setColourSetting(setting: boolean) {
        this.colourSettings = setting;
    }

    public toggleColourSettings() {
        this.colourSettings = !this.colourSettings;
    }

    /**
     * Check if this dot matches the airport filter criteria
     * @param airportFilterString Comma-separated airport codes with optional wildcards (e.g., "EGLL,EG*,KJFK")
     * @param filterType Whether to filter by departure ('dep'), arrival ('arr'), or both ('both')
     * @returns true if the dot matches the filter criteria
     */
    public matchesAirportFilter(airportFilterString: string, filterType: 'dep' | 'arr' | 'both'): boolean {
        if (!airportFilterString.trim()) return true; // No filter applied
        
        const patterns = parseAirportFilter(airportFilterString);
        if (patterns.length === 0) return true;
        
        switch (filterType) {
            case 'dep':
                return this.options.dep ? matchesAnyAirportPattern(this.options.dep, patterns) : false;
            case 'arr':
                return this.options.dest ? matchesAnyAirportPattern(this.options.dest, patterns) : false;
            case 'both':
                const depMatches = this.options.dep ? matchesAnyAirportPattern(this.options.dep, patterns) : false;
                const arrMatches = this.options.dest ? matchesAnyAirportPattern(this.options.dest, patterns) : false;
                return depMatches || arrMatches;
            default:
                return true;
        }
    }

    /**
     * Get the departure airport for this dot
     */
    public getDeparture(): string | undefined {
        return this.options.dep;
    }

    /**
     * Get the destination airport for this dot
     */
    public getDestination(): string | undefined {
        return this.options.dest;
    }

    /**
     * Check if this dot's altitude is within the specified range
     * @param minAltitude Minimum altitude (inclusive)
     * @param maxAltitude Maximum altitude (inclusive)
     * @returns true if the dot's altitude is within range
     */
    public isWithinAltitudeRange(minAltitude: number, maxAltitude: number): boolean {
        const altitude = this.options.altitude;
        if (altitude === undefined) return true; // Show dots without altitude data
        
        return altitude >= minAltitude && altitude <= maxAltitude;
    }
}

export default Dot;