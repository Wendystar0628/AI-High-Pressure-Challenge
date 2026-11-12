#include "engine.hpp"
#include <array>
#include <limits>
#include <numeric>

#ifndef TIER
#define TIER 1
#endif

#if TIER < 5
// Lower tiers reuse the immutable tier-5 rule core with allocation parameters.
// Its opening search is not used. This instance has internal linkage so the
// development driver can link multiple configurations without shared state.
#include <cstdio>
#ifndef G_MARGIN
#if TIER == 1
#define G_MARGIN 112
#elif TIER == 2
#define G_MARGIN 96
#elif TIER == 3
#define G_MARGIN 72
#elif TIER == 4
#define G_MARGIN 28
#endif
#endif
#ifndef G_MISSIONS
#define G_MISSIONS 48
#endif
#ifndef G_VALUE
#define G_VALUE 60
#endif
#ifndef G_ALPHA
#define G_ALPHA 0.5
#endif
#ifndef G_BETA_RES
#define G_BETA_RES 0.65
#endif
#ifndef G_BETA_CAP
#define G_BETA_CAP 0.5
#endif
#ifndef G_SNIPE
#define G_SNIPE 1.0
#endif
#ifndef G_RHO
#define G_RHO 1.0
#endif
#ifndef G_LOGI
#define G_LOGI 1
#endif
#define P_MARGIN G_MARGIN
#define P_ALPHA G_ALPHA
#define P_BETA_RES G_BETA_RES
#define P_BETA_CAP G_BETA_CAP
#define P_SNIPE G_SNIPE
#define P_RHO G_RHO
#define P_LOGI G_LOGI
#define SEARCH_MODE 0

namespace { namespace graded {
#include "tier5.hpp"
std::vector<Order> play(const State& state) {
    heur::Intent intent;
    intent.valuation=G_VALUE;
    intent.missions=G_MISSIONS;
    return heur::play(state,intent);
}
}}
#endif

#if TIER == 5
#include "tier5.hpp"
#endif

std::vector<Order> decide(const State& s) {
    static_assert(TIER>=1 && TIER<=5,"TIER must be 1 through 5");
#if TIER == 5
    return selected_tier5(s);
#else
    return graded::play(s);
#endif
}
