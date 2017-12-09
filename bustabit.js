let fs = require('fs');
let crypto = require('crypto');

function divisible(hash, mod) {
    // So ABCDEFGHIJ should be chunked like  AB CDEF GHIJ
    var val = 0;

    var o = hash.length % 4;
    for (var i = o > 0 ? o - 4 : 0; i < hash.length; i += 4) {
        val = ((val << 16) + parseInt(hash.substring(i, i+4), 16)) % mod;
    }

    return val === 0;
}

function genGameHash(serverSeed) {
  let hash = crypto.createHash('sha256');
  hash.update(serverSeed);
  return hash.digest('hex');
}

module.exports.genGameHash = genGameHash;

function hmac(key, v) {
  let hmac = crypto.createHmac('sha256', key);
  hmac.update(v);
  let d = hmac.digest('hex');
  return d;
}

module.exports.hm = function(seed){
  return hmac(seed, '000000000000000007a9a31ff7f07463d91af6b5454241d5faf282e5e0fe1b3a');
}

function crashPointFromHash(serverSeed) {
    // see: provably fair seeding event
    var hash = hmac(serverSeed, '000000000000000007a9a31ff7f07463d91af6b5454241d5faf282e5e0fe1b3a');

    // In 1 of 101 games the game crashes instantly.
    if (divisible(hash, 101))
        return 0;

    // Use the most significant 52-bit from the hash to calculate the crash point
    var h = parseInt(hash.slice(0,52/4),16);
    var e = Math.pow(2,52);

    return (Math.floor((100 * e - h) / (e - h))/100).toFixed(2);
};

function generateOutcomes(count, currentHash){
    var hash = currentHash;
    var lastHash = "";

    var result = []

    for(var i=0; i < count; i++){
        var gameHash = (lastHash!=""?genGameHash(lastHash):hash);
        var gameCrash = Number(crashPointFromHash((lastHash!=""?genGameHash(lastHash):hash)));
        result.push(gameCrash);

        lastHash = gameHash;
    }

    return result
}


function lastNyans(count, currentHash){
    var hash = currentHash;
    var lastHash = "";

    var nyansFoundCount = 0;

    var nyans = [];

    var gameNumber = 0;

    while (nyansFoundCount < count) {
      gameNumber++;
        var gameHash = (lastHash!=""?genGameHash(lastHash):hash);
        var gameCrash = Number(crashPointFromHash((lastHash!=""?genGameHash(lastHash):hash)));

        if (gameCrash >= 1000.0) {
          nyansFoundCount++;
          nyans.push({'coeff': Number(gameCrash), 'gameNum': Number(gameNumber)});
        }

        lastHash = gameHash;
    }

    return nyans;
}

function applyToOutcomes(currentHash, func) {

  var hash = currentHash;
  var lastHash = "";

  var currentOutcome;

  var gameNumber = 0;

  do {
    gameNumber++;
    var gameHash = (lastHash!=""?genGameHash(lastHash):hash);
    var gameCrash = Number(crashPointFromHash(gameHash));

    var previousGameHash = genGameHash(gameHash)

    currentOutcome = gameCrash;

    lastHash = gameHash;
  } while (!func(currentOutcome, gameNumber, gameHash))
}

function applyToOutcomes2(currentHash, func) {
  var gameNumber = 0;
  var latestGamehash = currentHash;
  var gameHash;

  var result = false;

  while(result == false) {
    var gameCrash = Number(crashPointFromHash(latestGamehash))
    var currentGameHash = latestGamehash
    var previousGameHash = genGameHash(latestGamehash)
    latestGamehash = previousGameHash

    result = !func(gameCrash, gameNumber, currentGameHash, previousGameHash);
    gameNumber++
  }
}

function getCurrentAndPreviousGame(currentHash) {

  var currentGameCrash = Number(crashPointFromHash(currentHash));
  var previousGameHash = genGameHash(currentHash);
  var previousGameCrash = Number(crashPointFromHash(previousGameHash));

  return {
    current: {
      hash: currentHash,
      outcomeHash: hmac(currentHash, '000000000000000007a9a31ff7f07463d91af6b5454241d5faf282e5e0fe1b3a'),
      crash: currentGameCrash
    },
    previous: {
      hash: previousGameHash,
      outcomeHash: hmac(previousGameHash, '000000000000000007a9a31ff7f07463d91af6b5454241d5faf282e5e0fe1b3a'),
      crash: previousGameCrash
    }
  }
}

function fileDumpOutcomes(path, currentHash, gamesCount) {
  var _currentHash = currentHash;
  var _gamesCount = gamesCount;
  var _path = path;
  fs.open(_path, 'w', function(err, fd){
    if (err) {
      throw new Error(err);
    }

    var _fd = fd;

    applyToOutcomes(_currentHash, function(currentOutcome, gameNumber, gameHash){
      var string = gameNumber + ';' + currentOutcome + ';' + gameHash + '\n';
      fs.writeSync(_fd, string);

      if (gameNumber % 100000 === 0) console.log('Dumped game #' + gameNumber);

      return gameNumber == gamesCount;
    });
    fs.closeSync(_fd);
  });
}

// var readline = require('readline');

function loadGames(path, callback) {

  var stream = fs.createReadStream(path);
  stream.setEncoding('ascii');

  var games = [];

  var _callback = callback.bind(this, games);

  var chunk = '';
  stream.on('readable', function() {
    var bigstring = stream.read();
    if (bigstring === null) {
      return;
    }
    var l = bigstring.length;

    for (var i = 0; i < l; i++) {
      if (bigstring[i] == '\n') {
        var values = chunk.split(';');
        games.push({gameNum: Number(values[0]) | 0, coeff: Number(values[1]), hash: values[2]});
        chunk = '';
      } else {
        chunk = chunk + bigstring[i];
      }
    }
  });
  stream.on('end', _callback);
}

module.exports.generateOutcomes =generateOutcomes;
module.exports.lastNyans = lastNyans;
module.exports.applyToOutcomes = applyToOutcomes;
module.exports.applyToOutcomes2 = applyToOutcomes2;
module.exports.fileDumpOutcomes = fileDumpOutcomes;
module.exports.loadGames = loadGames;
module.exports.getCurrentAndPreviousGame = getCurrentAndPreviousGame;
