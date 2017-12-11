#!coding:utf-8
import math
import hmac
import hashlib
from decimal import Decimal

PROVABLY_FAIR_SEED = '000000000000000007a9a31ff7f07463d91af6b5454241d5faf282e5e0fe1b3a'


def divisible(h, mod):
    val = 0
    o = len(h) % 4
    for i in range(o - 4 if o > 0 else 0, len(h), 4):
        val = ((val << 16) + int(h[i:i+4], 16)) % mod

    return val == 0


def crash_from_hash(server_seed):
    hm = hmac.new(server_seed, digestmod = hashlib.sha256)
    hm.update(str(PROVABLY_FAIR_SEED))
    digest = hm.hexdigest()

    if (divisible(digest, 101)):
        return 0

    h = Decimal(int(digest[: 52/4], 16))
    e = Decimal(math.pow(2, 52))

    return math.floor(((100 * e - h) / (e - h))) / 100


def evaluate_previous_games(current_hash, condition = None):
    current_game = 0
    game_hash = current_hash
    outcome = crash_from_hash(game_hash)

    condition = condition or (lambda gamenum, outcome, game_hash: gamenum >= 100)

    while not condition(current_game, outcome, game_hash):
        current_game += 1
        yield (current_game, outcome, game_hash)
        hasher = hashlib.sha256()
        hasher.update(game_hash)
        game_hash = hasher.hexdigest()
        outcome = crash_from_hash(game_hash)



class StrategyTester(object):
    class BaseStrategy(object):
        def before_game_start(self, game):
            pass
        def on_win(self, win_amount):
            pass
        def on_fail(self):
            pass
        def after_game_end(self, game):
            pass

    class Account(object):
        def __init__(self, initial_balance, throw_on_minus):
            self.throw_on_minus = throw_on_minus
            self.balance = initial_balance
            self.min_balance = initial_balance
            self.max_balance = 0

        def place_bet(self, bet_amount):
            self.balance = self.balance - bet_amount
            if bet_amount <= 0 or int(bet_amount) != bet_amount:
                raise Exception('Bet amount should be a positive integer')
            if self.balance < 0 and self.throw_on_minus:
                raise Exception('Reached negative balance. Insufficient funds.\n%s' % self.__str__())

            self.update_stats()

        def win(self, win_amount):
            self.balance = self.balance + win_amount
            self.update_stats()

        def update_stats(self):
            if self.balance > self.max_balance:
                self.max_balance = self.balance
            if self.balance < self.min_balance:
                self.min_balance = self.balance

        def __str__(self):
            return 'Min/max balance: %.2f/%.2f' % (self.min_balance, self.max_balance)

    def __init__(self, latest_hash, games_count, initial_balance, throw_on_minus = False):
        self.games = [vals for vals in evaluate_previous_games(latest_hash, condition = lambda gamenum, _, __: gamenum >= games_count )]
        self.account = self.Account(initial_balance, throw_on_minus)
        self.current_bet = None


    def strategy_iterator(self, strategy):
        for current_game, outcome, game_hash in reversed(self.games):
            strategy.before_game_start(self)
            if not self.current_bet:
                strategy.after_game_end()
                yield self.account, 'Skipped game %s' % (current_game)
                continue

            if outcome >= self.current_bet[1]:
                win_amount = Decimal(self.current_bet[0] * outcome)
                self.account.win(win_amount)
                strategy.on_win(win_amount)
            else:
                strategy.on_fail()
            strategy.after_game_end(self)
            yield self.account, None


    def place_bet(self, bet_amount, coeff):
        self.current_bet = (bet_amount, coeff)
        self.account.place_bet(bet_amount)


if __name__ == '__main__':
    # print crash_from_hash('ceb1471887e4328a202941f3f9100799278f0b0fe1ea9942519ff5bd578b637a')  # should be 1.08x

    # See game #4717645 (https://www.bustabit.com/game/4717645)
    current_hash = 'd7ed3539797455292e7ea32cf46a38fd1b4c09a41f6ed8c2009ab62fb3ad86bf'
    games_count = 100

    print "Latest known game: %s" % current_hash
    print "Showing %s latest games" % games_count

    games_iter = evaluate_previous_games(current_hash, condition = lambda gamenum, _, __: gamenum >= games_count )

    for vals in games_iter:
        print "%s: %sx; %s" % (vals)


    class Martingale(StrategyTester.BaseStrategy):
        base_bet = 10
        increase_bet_by = 1.25
        coeff = 5.0

        def __init__(self):
            StrategyTester.BaseStrategy.__init__(self)
            self.current_bet = self.base_bet

        def on_win(self, winning):
            print "     Won %.2f bits!" % winning
            self.current_bet = self.base_bet
        def on_fail(self):
            print "     failed..."
            self.current_bet = (self.current_bet * self.increase_bet_by)

        def before_game_start(self, game):
            bet = int(self.current_bet)
            print "Placed a bet %s" % (bet)
            game.place_bet(bet, self.coeff)

        def __str__():
            return "Martingale strategy: bet %s bits on %sx, on fail increase bet by %s, on win - return to base bet." % (self.base_bet, self.coeff, self.increase_bet_by)

    print ""
    print "Testing Martingale() strategy on 1000 recent games, started with 10000 bits on balance."
    tester = StrategyTester(current_hash, 1000, Decimal(10000), True)
    performance = tester.strategy_iterator(Martingale())

    try:
        for account, msg in performance:
            print "Balance: %.2f" % account.balance
    except Exception as e:
        print "------------------"
        print "%s" % e.message
        print tester.account
