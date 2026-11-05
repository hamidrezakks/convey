"""Exercise the real deployment archive parser using disposable directories."""
import gzip
import io
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'extract-website.py'
REQUIRED = {'apps/website/server.js': b'console.log("fixture");',
            'apps/website/.next/BUILD_ID': b'test-build'}


def archive(entries):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode='w') as tar:
        for name, content, kind in entries:
            item = tarfile.TarInfo(name)
            item.type = kind
            item.mode = 0o7777
            if kind in (tarfile.SYMTYPE, tarfile.LNKTYPE):
                item.linkname = '/tmp/website-test-escape'
            elif kind == tarfile.REGTYPE:
                item.size = len(content)
            tar.addfile(item, io.BytesIO(content) if kind == tarfile.REGTYPE else None)
    return gzip.compress(output.getvalue())


def valid_entries():
    return [(name, content, tarfile.REGTYPE) for name, content in REQUIRED.items()]


class ExtractWebsiteTests(unittest.TestCase):
    def run_parser(self, data, *options, existing=False):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'standalone'
            if existing:
                target.mkdir()
                (target / 'keep').write_text('do not overwrite')
            result = subprocess.run(['python3', str(SCRIPT), str(target), *options],
                                    input=data, capture_output=True)
            files = {str(path.relative_to(target)): path.read_bytes()
                     for path in target.rglob('*') if path.is_file()} if target.exists() else {}
            return result, files, target.exists()

    def assert_rejected(self, entries, *options):
        result, files, exists = self.run_parser(archive(entries), *options)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b'archive rejected:', result.stderr)
        self.assertFalse(exists, 'Rejected input must not leave an extraction directory')
        self.assertEqual(files, {})

    def test_valid_standalone_tree_is_extracted(self):
        entries = [('.', b'', tarfile.DIRTYPE), ('./apps', b'', tarfile.DIRTYPE)]
        result, files, exists = self.run_parser(archive(entries + valid_entries()))
        self.assertEqual(result.returncode, 0, result.stderr.decode())
        self.assertTrue(exists)
        self.assertEqual(files, REQUIRED)

    def test_parent_traversal_is_rejected(self):
        self.assert_rejected(valid_entries() + [('apps/../../escape', b'x', tarfile.REGTYPE)])

    def test_absolute_path_is_rejected(self):
        self.assert_rejected(valid_entries() + [('/tmp/escape', b'x', tarfile.REGTYPE)])

    def test_noncanonical_paths_are_rejected(self):
        for name in ['apps//escape', 'apps/./escape', 'apps\\escape']:
            with self.subTest(name=name):
                self.assert_rejected(valid_entries() + [(name, b'x', tarfile.REGTYPE)])

    def test_links_devices_and_pipes_are_rejected(self):
        for kind in [tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.CHRTYPE,
                     tarfile.BLKTYPE, tarfile.FIFOTYPE, tarfile.GNUTYPE_SPARSE]:
            with self.subTest(kind=kind):
                self.assert_rejected(valid_entries() + [('escape', b'', kind)])

    def test_duplicate_files_are_rejected(self):
        self.assert_rejected(valid_entries() + [('./apps/website/server.js', b'replaced', tarfile.REGTYPE)])

    def test_duplicate_directories_are_rejected(self):
        self.assert_rejected([('apps', b'', tarfile.DIRTYPE), ('./apps', b'', tarfile.DIRTYPE)] + valid_entries())

    def test_file_as_parent_is_rejected_in_both_orders(self):
        entries = [('collision', b'x', tarfile.REGTYPE), ('collision/child', b'x', tarfile.REGTYPE)]
        self.assert_rejected(valid_entries() + entries)
        self.assert_rejected(valid_entries() + entries[::-1])

    def test_file_directory_collision_is_rejected(self):
        self.assert_rejected(valid_entries() + [('collision', b'', tarfile.DIRTYPE),
                                              ('collision', b'x', tarfile.REGTYPE)])

    def test_required_entrypoint_and_build_id_are_checked(self):
        self.assert_rejected(valid_entries()[:1])
        self.assert_rejected(valid_entries()[1:])
        self.assert_rejected([('apps/website/server.js', b'', tarfile.DIRTYPE), valid_entries()[1]])

    def test_expanded_tar_stream_limit_is_enforced(self):
        self.assert_rejected(valid_entries(), '--max-bytes', '1024')

    def test_compressed_stream_limit_is_enforced(self):
        result, _, exists = self.run_parser(gzip.compress(os.urandom(5000)), '--max-bytes', '1024')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b'archive rejected:', result.stderr)
        self.assertFalse(exists)

    def test_member_limit_is_enforced(self):
        self.assert_rejected(valid_entries(), '--max-members', '1')

    def test_invalid_gzip_and_truncated_tar_are_rejected(self):
        for data in [b'not gzip', gzip.compress(b'not tar'), archive(valid_entries())[:-8]]:
            with self.subTest(data=data[:10]):
                result, _, exists = self.run_parser(data)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(b'archive rejected:', result.stderr)
                self.assertFalse(exists)

    def test_existing_destination_is_preserved(self):
        result, files, _ = self.run_parser(archive(valid_entries()), existing=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(files, {'keep': b'do not overwrite'})

    def test_no_setuid_or_world_writable_permissions_are_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'standalone'
            result = subprocess.run(['python3', str(SCRIPT), str(target)],
                                    input=archive(valid_entries()), capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr.decode())
            self.assertEqual((target / 'apps/website/server.js').stat().st_mode & 0o7777, 0o755)


if __name__ == '__main__':
    unittest.main()
