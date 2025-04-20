import { TimedPosition } from './Dot'; // Import the TimedPosition type from your Dot file

interface ProcessedData {
    positions: {
        [callsign: string]: TimedPosition[];
    };
    timeRange: {
        start: number;
        end: number;
    };
    fplans: { [callsign: string]: { dep: string, dest: string, actype: string } }
}

/**
 * Process a VATSIM replay file text content
 * @param fileContent Text content of the replay file
 * @returns Processed data with positions by callsign and time range
 */
export function processReplayFile(fileContent: string): ProcessedData {
    console.log("Processing File");


    const lines = fileContent.split('\n');
    const positions: { [callsign: string]: TimedPosition[] } = {};
    let minTime = Number.MAX_SAFE_INTEGER;
    let maxTime = 0;

    const fplans: { [callsign: string]: { dep: string, dest: string, actype: string } } = {};

    // Process each line
    for (let i = 0; i < lines.length - 1; i++) {
        let line = lines[i]
        line = line.trim();
        if (line === '' || line.startsWith('#')) continue; // Skip empty lines and comments

        if (line.startsWith("$FP")) {
            const parts = line.split(':');
            const cs = parts[0].substring(3);
            const dest = parts[9];
            const dep = parts[5];
            const actype = parts[3];

            fplans[cs] = { dep, dest, actype };

        }

        // [13:05:45 >>>> UK_B_FMP]
        // @S:EWG6902:2000:1:51.28150:6.76547:118:0:4191300:226

        if (line.startsWith('@N') || line.startsWith('@S')) {
            try {
                // Extract time from previous line (format like [13:05:45 >>>> UK_B_FMP])
                const timeStr = lines[i - 1].trim().substring(1, 9); // Get "13:05:45"
                const [hours, minutes, seconds] = timeStr.split(':').map(Number);
                const time = (hours * 3600 + minutes * 60 + seconds) * 1000; // Convert to ms

                minTime = Math.min(minTime, time);
                maxTime = Math.max(maxTime, time);

                const parts = line.split(':');
                const callsign = parts[1];
                const squawk = parts[2];
                const lat = parseFloat(parts[4]);
                const lng = parseFloat(parts[5]);
                const altitude = parseFloat(parts[6]);
                const encodedHeading = parseFloat(parts[7]);

                let heading = 0;

                if (!isNaN(encodedHeading)) {
                    const shiftedValue = encodedHeading >> 2;
                    heading = Math.round((shiftedValue - 0.5) / 2.88);
                    // Ensure heading is between 0-359
                    heading = ((heading % 360) + 360) % 360;
                }

                const position: TimedPosition = {
                    lat,
                    lng,
                    time,
                    altitude,
                    heading,
                };

                // Add to positions by callsign
                if (!positions[callsign]) {
                    positions[callsign] = [];
                }
                positions[callsign].push(position);
            } catch (error) {
                console.error('Error parsing lines:', lines[i - 1], line, error);
            }
        }

    }

    // Sort positions by time for each callsign
    Object.keys(positions).forEach(callsign => {
        positions[callsign].sort((a, b) => a.time - b.time);
    });

    // Normalize timestamps to start from 0
    if (minTime !== Number.MAX_SAFE_INTEGER) {
        Object.keys(positions).forEach(callsign => {
            positions[callsign].forEach(pos => {
                pos.time = pos.time - minTime;
            });
        });

        // Update timeRange
        maxTime = maxTime - minTime;
        minTime = 0;
    }
    console.log(`Processed ${Object.keys(positions).length} aircraft`);
    console.log(positions)


    return {
        positions,
        timeRange: {
            start: minTime,
            end: maxTime
        },
        fplans
    };
}