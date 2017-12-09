#!coding:utf-8
# from hashlib import hmac, sha256
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
