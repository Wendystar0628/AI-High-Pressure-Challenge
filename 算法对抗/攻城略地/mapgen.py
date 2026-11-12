"""Deterministic, version-stable symmetric map generator; Python standard library only."""
import argparse
import json

VERSION = "siege-map-v1"

class SplitMix64:
    def __init__(self, seed):
        self.value = seed & ((1 << 64) - 1)

    def next(self):
        mask = (1 << 64) - 1
        self.value = (self.value + 0x9E3779B97F4A7C15) & mask
        z = self.value
        z = ((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9) & mask
        z = ((z ^ (z >> 27)) * 0x94D049BB133111EB) & mask
        return z ^ (z >> 31)

    def below(self, n):
        limit = (1 << 64) - ((1 << 64) % n)
        while True:
            x = self.next()
            if x < limit:
                return x % n

    def shuffle(self, values):
        for i in range(len(values) - 1, 0, -1):
            j = self.below(i + 1)
            values[i], values[j] = values[j], values[i]

def generate(seed):
    rng = SplitMix64(seed)
    n = 16 + 2 * rng.below(5)
    candidates = [(x, y) for x in range(11) for y in range(-10, 11)
                  if (x > 0 or y > 0) and 1 <= x*x+y*y <= 100]
    homes = [p for p in candidates if 64 <= p[0]*p[0]+p[1]*p[1] <= 100]
    home = homes[rng.below(len(homes))]
    positions = [home, (-home[0], -home[1])]
    rng.shuffle(candidates)
    for x, y in candidates:
        if all((x-a)**2+(y-b)**2 > 1 and (-x-a)**2+(-y-b)**2 > 1
               for a, b in positions):
            positions.extend([(x,y),(-x,-y)])
            if len(positions) == n:
                break
    if len(positions) != n:
        raise RuntimeError("map placement exhausted")
    nodes = []
    for i in range(0, n, 2):
        troops = 100 if i == 0 else 5 + rng.below(56)
        growth = 5 if i == 0 else 1 + rng.below(5)
        for j in range(2):
            x,y = positions[i+j]
            nodes.append(dict(x=x,y=y,owner=j+1 if i==0 else 0,
                              troops=troops,growth=growth))
    return dict(generator=VERSION,seed=seed,turn=1,max_turns=200,nodes=nodes,fleets=[])

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("seed", type=int)
    parser.add_argument("--output", help="JSON output path (default stdout)")
    args = parser.parse_args()
    data = json.dumps(generate(args.seed), ensure_ascii=False, indent=2) + "\n"
    if args.output:
        with open(args.output,"w",encoding="utf-8") as stream:
            stream.write(data)
    else:
        print(data,end="")
