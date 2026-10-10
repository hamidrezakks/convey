"""Reject untrusted SSH commands before any privileged deployment work."""
import os
from pathlib import Path
import subprocess
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'deploy-website'


class DeployWebsiteCommandTests(unittest.TestCase):
    def test_rejects_invalid_direct_arguments(self):
        for args in [[], ['deploy'], ['deploy', 'a' * 39], ['deploy', 'A' * 40],
                     ['deploy', 'g' * 40], ['status', 'a' * 40],
                     ['deploy', 'a' * 40, 'extra'], ['deploy', '../escape']]:
            with self.subTest(args=args):
                environment = dict(os.environ)
                environment.pop('SSH_ORIGINAL_COMMAND', None)
                result = subprocess.run(['bash', str(SCRIPT), *args], env=environment,
                                        input=b'', capture_output=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(b'invalid deployment command', result.stderr)
                self.assertEqual(result.stdout, b'')

    def test_rejects_shell_operators_and_extra_ssh_words(self):
        for command in ['deploy ' + 'a' * 40 + '; id',
                        'deploy ' + 'a' * 40 + ' extra',
                        'deploy\t' + 'a' * 40,
                        ' deploy ' + 'a' * 40,
                        'deploy ' + 'a' * 40 + '\n',
                        'deploy $(id)', 'sh', '']:
            with self.subTest(command=command):
                environment = dict(os.environ, SSH_ORIGINAL_COMMAND=command)
                result = subprocess.run(['bash', str(SCRIPT)], env=environment,
                                        input=b'', capture_output=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(b'invalid deployment command', result.stderr)
                self.assertEqual(result.stdout, b'')


if __name__ == '__main__':
    unittest.main()
