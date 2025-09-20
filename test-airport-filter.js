// Quick test for airport filtering functions
const { parseAirportFilter, matchesAnyAirportPattern, matchesAirportPattern } = require('./src/utils.ts');

// Test parsing
console.log('Testing parseAirportFilter:');
console.log('EGLL,KJFK:', parseAirportFilter('EGLL,KJFK'));
console.log('EG*,K*:', parseAirportFilter('EG*,K*'));
console.log('  egll  , kjfk  :', parseAirportFilter('  egll  , kjfk  '));

// Test pattern matching
console.log('\nTesting matchesAirportPattern:');
console.log('EGLL matches EGLL:', matchesAirportPattern('EGLL', 'EGLL'));
console.log('EGLL matches EG*:', matchesAirportPattern('EGLL', 'EG*'));
console.log('KJFK matches EG*:', matchesAirportPattern('KJFK', 'EG*'));
console.log('EGKK matches EG*:', matchesAirportPattern('EGKK', 'EG*'));

// Test multiple patterns
console.log('\nTesting matchesAnyAirportPattern:');
console.log('EGLL matches [EGLL,KJFK]:', matchesAnyAirportPattern('EGLL', ['EGLL', 'KJFK']));
console.log('EGKK matches [EG*,K*]:', matchesAnyAirportPattern('EGKK', ['EG*', 'K*']));
console.log('LFPG matches [EG*,K*]:', matchesAnyAirportPattern('LFPG', ['EG*', 'K*']));