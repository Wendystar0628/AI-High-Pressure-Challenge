"""Demonstration export reuses grading values and survives render retries."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import grade
import replay_data as replay


class ReplaySpeed(unittest.TestCase):
    def test_demo_uses_saved_evaluation_without_rescoring(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            source=root/'answer.json'
            source.write_text(json.dumps({'parts':[{'name':'1','features':[{'type':'extrude',
                'loops':[{'rect':[0,0,10,8]}],'depth':5}]}]}),encoding='utf-8')
            record={'id':'Speed','tier':'simple','name':'box','kind':'part','max':100,'reference':str(source)}
            cfg=grade.load_config()
            cfg.update(_quality='demo',_evaluation={'Speed':{'translation':[0,0,0], 'fscore':.76,
                'fscore_strict':.7,'fscore_wide':1.,'precision':.8,'recall':.7}})
            with patch.multiple(replay,DEMO=False,MESH_LIN=.1,MESH_ANG=.3,CMP_EDGE=4.), \
                    patch.object(grade,'score_dual',side_effect=AssertionError('rescored')), \
                    patch.object(grade,'reference_surfaces',side_effect=AssertionError('resampled')):
                entry,seconds,cached=replay.prepare_problem(record,cfg,source,root,True)
            self.assertFalse(cached)
            self.assertEqual(entry['compare']['fscore'],.76)
            self.assertEqual(entry['compare']['evaluation_source'],'saved')
            self.assertTrue((root/'Speed/cmp_matched.glb').is_file())
            with patch.multiple(replay,DEMO=False,MESH_LIN=.1,MESH_ANG=.3,CMP_EDGE=4.), \
                    patch.object(replay,'export_problem',side_effect=AssertionError('rebuilt')):
                restored,seconds,cached=replay.prepare_problem(record,cfg,source,root,True)
            self.assertTrue(cached)
            self.assertEqual(entry,restored)


if __name__=='__main__':unittest.main()
