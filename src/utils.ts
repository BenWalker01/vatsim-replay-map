export const douglasPeucker = (points: { lat: number, lng: number, alt: number }[], epsilon: number) => {
    if (points.length < 3) return points;
  
    const getPerpendicularDistance = (point: { lat: number, lng: number }, lineStart: { lat: number, lng: number }, lineEnd: { lat: number, lng: number }) => {
      const dx = lineEnd.lng - lineStart.lng;
      const dy = lineEnd.lat - lineStart.lat;
      const mag = Math.sqrt(dx * dx + dy * dy);
      const u = ((point.lng - lineStart.lng) * dx + (point.lat - lineStart.lat) * dy) / (mag * mag);
      const x = lineStart.lng + u * dx;
      const y = lineStart.lat + u * dy;
      const dx1 = point.lng - x;
      const dy1 = point.lat - y;
      return Math.sqrt(dx1 * dx1 + dy1 * dy1);
    };
  
    let dmax = 0;
    let index = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const d = getPerpendicularDistance(points[i], points[0], points[points.length - 1]);
      if (d > dmax) {
        index = i;
        dmax = d;
      }
    }
  
    if (dmax > epsilon) {
      const recResults1: { lat: number, lng: number, alt: number }[] = douglasPeucker(points.slice(0, index + 1), epsilon);
      const recResults2: { lat: number, lng: number, alt: number }[] = douglasPeucker(points.slice(index), epsilon);
      return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
    } else {
      return [points[0], points[points.length - 1]];
    }
  };
  
export const getColourByAlt = (alt: number) => {
    const maxAlt = 40_000;
    const ratio = alt / maxAlt;
    const red = Math.min(255, Math.floor(255 * ratio));
    const blue = Math.min(255, Math.floor(255 * (1 - ratio)));
    return `rgb(${red}, 0, ${blue})`;
  };