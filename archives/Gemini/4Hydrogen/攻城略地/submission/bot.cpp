#include "engine.hpp"
#include "bots/bot_v7_proto.hpp"

std::vector<Order> decide(const State& s) {
    return bot_v7::decide(s);
}
