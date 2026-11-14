"""Acceleration must preserve exact triangle queries and deterministic cache results."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import numpy as np
import grade


class SpeedTests(unittest.TestCase):
    def test_bucket_queries_match_brute_force(self):
        rng = np.random.default_rng(123)
        surf = grade.Surface.__new__(grade.Surface)
        surf.empty = False
        # Independent triangles span six orders of magnitude; nearest centroid
        # alone is deliberately insufficient for the long triangle below.
        scale = 10.0 ** rng.uniform(-3, 2, (80, 1))
        surf.A = rng.uniform(-10, 10, (80, 3))
        surf.B = surf.A + rng.normal(size=(80, 3)) * scale
        surf.C = surf.A + rng.normal(size=(80, 3)) * scale
        surf.samples = surf.A.copy()
        surf._index()
        pts = np.concatenate([rng.uniform(-20, 20, (300, 3)), surf.A, (surf.A + surf.B + surf.C) / 3])
        for tol in (0.01, 0.2, 2.0):
            expected = np.array([np.any(grade.point_triangle_dist(
                np.repeat(p[None], len(surf.A), axis=0), surf.A, surf.B, surf.C) <= tol) for p in pts])
            np.testing.assert_array_equal(surf.within(pts, tol), expected)
        self.assertEqual(len(surf.within(np.empty((0, 3)), .2)), 0)

    def test_cache_hit_invalidation_and_corruption(self):
        cfg = grade.load_config()
        experiment = grade.HERE.parents[2] / '调研/机械结构重建/实验'
        with tempfile.TemporaryDirectory(dir=experiment) as tmp:
            root = Path(tmp)
            # Keep cache and reference entirely inside the experimental sandbox.
            (root / 'grade.py').write_bytes(Path(grade.__file__).read_bytes())
            ref = root / 'reference.json'
            desc = {'parts': [{'name': '1', 'features': [{'type': 'extrude',
                'loops': [{'rect': [0, 0, 10, 8]}], 'depth': 5}]}]}
            ref.write_text(json.dumps(desc), encoding='utf-8')
            record = {'id': 'cache', 'reference': str(ref)}
            with patch.object(grade, 'HERE', root):
                first = grade.reference_surfaces(record, cfg)
                with patch.object(grade, 'reference_shapes', side_effect=AssertionError('cache miss')):
                    second = grade.reference_surfaces(record, cfg)
                for attr in ('samples', 'A', 'B', 'C'):
                    np.testing.assert_array_equal(getattr(first['1'], attr), getattr(second['1'], attr))
                self.assertEqual(first['1'].face_count, second['1'].face_count)
                for a, b in zip(first['1'].face_samples, second['1'].face_samples):
                    np.testing.assert_array_equal(a, b)
                # Changing sampling parameters or reference content must rebuild.
                altered = copy.deepcopy(cfg)
                altered['sampling']['min_points'] += 1
                with patch.object(grade, 'reference_shapes', wraps=grade.reference_shapes) as build:
                    grade.reference_surfaces(record, altered)
                    self.assertEqual(build.call_count, 1)
                    desc['parts'][0]['features'][0]['depth'] = 7
                    ref.write_text(json.dumps(desc), encoding='utf-8')
                    rebuilt = grade.reference_surfaces(record, cfg)
                    self.assertEqual(build.call_count, 2)
                    self.assertNotEqual(first['1'].area, rebuilt['1'].area)
                for path in (root / '.surface-cache').glob('*.npz'):
                    path.write_bytes(b'broken cache')
                with patch.object(grade, 'reference_shapes', wraps=grade.reference_shapes) as build:
                    grade.reference_surfaces(record, cfg)
                    self.assertEqual(build.call_count, 1)

    def test_coarse_reuses_full_masks(self):
        from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox
        cfg = grade.load_config()
        ref = grade.Surface(BRepPrimAPI_MakeBox(10, 8, 5).Shape(), 10, cfg, reference=True)
        ans = grade.Surface(BRepPrimAPI_MakeBox(12, 8, 5).Shape(), 20, cfg)
        pairs, coarse = [(ans, ref)], []
        grade.evaluate(pairs, np.zeros(3), .2, coarse_out=coarse)
        self.assertEqual(coarse, grade.evaluate(pairs, np.zeros(3), .2, 4000))


if __name__ == '__main__':
    unittest.main()
