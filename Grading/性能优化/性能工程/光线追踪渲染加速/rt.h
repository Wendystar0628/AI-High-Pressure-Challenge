#pragma once
#include <cuda_runtime.h>
// All pointers in Scene are host pointers; only valid during render().
struct Triangle { float v0[3], v1[3], v2[3], color[3], mirror; };
struct Scene {
    int width, height, spp, ao, max_depth, triangle_count;
    unsigned seed;
    float eye[3], u[3], v[3], w[3], light[3], ao_radius;
    const Triangle* triangles;
};
// init has no scene. render includes all scene-dependent work and all transfers.
void init(int max_triangles, int max_pixels, int max_samples);
void render(const Scene& scene, float* device_rgb);
