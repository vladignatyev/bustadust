// bot to test
const debug = require('debug')('BotTester')
const deposit = require('debug')('Deposit')
const experiment_debug = require('debug')('Experiment')

const bot = require('./5agg.js');
const EventEmitter = require('events');

const bustabit = require('./bustabit.js');



function stupidBot(engine) {
  var coeff = 120;
  engine.on('game_starting', function(){
    engine.placeBet(100, coeff, true);
  })
  engine.on('cashed_out', function(data){
    debug(`Cashed out ${data.username} at ${coeff/100}`);
  })

  engine.on('game_crash', (data) => {
    debug(`Game crashed at ${data.game_crash/100}`);
  })
}


class Engine extends EventEmitter {
  // very lean Bustabit's engine emulator


  constructor(bustabit, initialDeposit) {

    super()
    this.bustabit = bustabit
    this.stopped = false

    this.currentBet = 0
    this.targetCoeff = 0

    this.deposit = initialDeposit || 0
    this.minDeposit = Infinity
    this.maxDeposit = -Infinity
  }

  next() {
    if (this.stopped) throw new Error('Stopped.')

    this.currentBet = 0
    this.targetCoeff = 0

    this.emit('game_starting');

    let outcome = this.bustabit.nextOutcome()

    this.deposit = this.deposit - this.currentBet

    if (this.deposit < this.minDeposit) this.minDeposit = this.deposit

    if (this.currentBet > 0 && outcome > this.targetCoeff) {
      this.emit('cashed_out', {'username': this.getUsername()})
      this.deposit = this.deposit + this.currentBet * (this.targetCoeff / 100)
    }

    if (this.deposit > this.maxDeposit) this.maxDeposit = this.deposit

    this.emit('game_crash', {'game_crash': outcome})

    deposit(`Current deposit: ${this.deposit / 100}; Min deposit: ${this.minDeposit / 100}; Max deposit: ${this.maxDeposit / 100}`)
  }

  getUsername() {
    return 'me'
  }

  placeBet(betAmount, targetCoeff, _) {
    if (_ != true) throw new Error('Not supported!')

    this.currentBet = betAmount
    this.targetCoeff = targetCoeff
  }

  getBalance() {
    return this.deposit
  }

  stop() {
    this.stopped = true;
  }
}

class FakeBustabit {
  constructor() {
    this.flag = true;
  }
  nextOutcome() {
    if (this.flag) {
      this.flag = false
      return 10000
    }
    return 130; // 1.0x coeff
  }
}

class OutcomesBustabit {
  constructor(outcomes) {
    this.games = outcomes
    this.counter = outcomes.length - 1
    this.ended = false
  }

  nextOutcome() {
    if (this.ended) return undefined;

    let outcome = this.games[this.counter][0] * 100;
    this.counter = this.counter - 1
    if (this.counter < 0) this.ended = true
    return outcome
  }

  nextGameHash() {
    return this.games[this.counter][1]
  }

}


class RealBustabit extends OutcomesBustabit{
  constructor(gamesCount, gameHash) {
    super(bustabit.generateOutcomes(gamesCount, gameHash))
  }
}


class MultipassExperiment {
  constructor(bot, gameHash, sliceSize, count) {
    this.outcomes = bustabit.generateOutcomes(count || 100000, gameHash)

    this.worseExperiment = { minDeposit: Infinity, gamehash: undefined }

    this.counter = 0
    this.bot = bot
    this.sliceSize = sliceSize
  }

  next() {
    let start = this.outcomes.length -  1 - (this.counter * this.sliceSize)
    let end = start - this.sliceSize
    let serieOfGames = this.outcomes.slice(end, start)

    console.log(serieOfGames);

    let e = new Engine(new OutcomesBustabit(serieOfGames))
    this.bot(e)
    while (true) {
      try {
        e.next()
      } catch (e) {
        break
      }
    }
    if (e.minDeposit < this.worseExperiment.minDeposit) {
      this.worseExperiment.minDeposit = e.minDeposit
      this.worseExperiment.gamehash = serieOfGames[serieOfGames.length - 1][1]
      experiment_debug(`Worse experiment at experiment #${this.counter}, gamehash: ${this.worseExperiment.gamehash}, mindeposit: ${this.worseExperiment.minDeposit / 100}`);
    }

    this.counter = this.counter + 1;
  }
}

// 1.
// let engine = new Engine(new FakeBustabit())
// stupidBot(engine)

// 2.
// let engine = new Engine(new RealBustabit(1000, '7b495dc9be95ba7b4dc87f3fd1896f709a7db254c4db8099804a38b91901fc39'))
// bot(engine)
//
// for (var i = 0; i < 1000; i++) {
//   if (engine.stopped) return
//   engine.next()
// }

// 3.
// let e = new MultipassExperiment(bot, '7b495dc9be95ba7b4dc87f3fd1896f709a7db254c4db8099804a38b91901fc39', 55)
// for (var i = 0; i < 1000; i++) {
//   e.next()
// }
// experiment_debug(`Worse experiment at experiment gamehash: ${e.worseExperiment.gamehash}, mindeposit: ${e.worseExperiment.minDeposit / 100}`);


//4. BUG: скипы после коэффициента
let testOutcomes = [
  [9.00,''],
  [9.00,''],
  [9.00,''],
  [9.00,''],
  [9.00,''],
  [9.00,''],
  [1.00,''],
  [1.00,''],
  [1.00,''],
  [1.00,''],
  [1.00,''],
  [1.00,''],
  [1.00,''],
  [1.00,''],
  [1.00,''],
  [11.00,''],
  [1.00,''],
  [1.00,''],
  [1.00,''],
  [1.00,''],
  [1.00,''],
  [1.00,''],
  [1.00,''],
  [1.00,''],
  [1.00,''],
  [11.00,''],
];
let e = new Engine(new OutcomesBustabit(testOutcomes))

bot(e);

for (var i = 0; i < testOutcomes.length; i++) e.next()
