let bustabit = require('./bustabit.js')

let currentHash = '70ebfa8495b24eaedfd867b3f9b4090b07b498a89915b812755f0b3310ea17df'
let gamesCount = 100

console.log(`Latest known game: ${currentHash}`);
console.log(`Showing ${gamesCount} latest games`);

bustabit.applyToOutcomes(currentHash, (currentOutcome, gameNumber, gameHash) => {
  console.log(`${gameNumber}: ${currentOutcome.toFixed(2)}x; ${gameHash}`);
  return gameNumber >= gamesCount
})
