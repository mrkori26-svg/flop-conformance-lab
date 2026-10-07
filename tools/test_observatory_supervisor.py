import importlib.util,sys,unittest,tempfile,time,subprocess
from pathlib import Path
from unittest.mock import patch
path=Path(__file__).resolve().with_name('observatory-supervisor.py')
spec=importlib.util.spec_from_file_location('observer',path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ObserverTest(unittest.TestCase):
    def test_output_exit(self):
        r=m.run_step('success',[sys.executable,'-c','print("actual output")'])
        self.assertEqual(r['exitCode'],0);self.assertIn('actual output',r['stdoutTail']);self.assertFalse(r['timedOut'])
    def test_launch_failure(self):
        self.assertEqual(m.run_step('missing',['no-such-flop-executable-20261007.exe'])['exitCode'],127)
    def test_timeout_kills_owned_descendant(self):
        with tempfile.TemporaryDirectory() as d:
            marker=Path(d)/'child-survived'
            child=f'import time,pathlib; time.sleep(2); pathlib.Path({str(marker)!r}).write_text("orphan")'
            parent=f'import subprocess,sys,time; subprocess.Popen([sys.executable,"-c",{child!r}], creationflags=0x08000000); time.sleep(10)'
            r=m.run_step('timeout',[sys.executable,'-c',parent],timeout=.4)
            self.assertEqual(r['exitCode'],124);self.assertTrue(r['timedOut']);self.assertEqual(r['timeoutCleanupExitCode'],0)
            time.sleep(2.2);self.assertFalse(marker.exists())
    def test_cycle_continues_and_reports_failure(self):
        seen=[]
        def fake(name,*args,**kwargs):
            seen.append(name);return {'script':name,'exitCode':124 if name=='longitudinal' else 0}
        with tempfile.TemporaryDirectory() as d, patch.object(m,'run_step',side_effect=fake),patch.object(m,'_delegated_evidence',return_value={'one':{'state':'FRESH'}}),patch.object(m,'STATE',Path(d)/'state.json'),patch.object(m,'LOG',Path(d)/'log'):
            r=m.cycle()
            self.assertEqual(len(seen),9);self.assertIn('appendix-e-coverage',seen);self.assertEqual(r['status'],'DEGRADED')
if __name__=='__main__':unittest.main()

