#!/usr/bin/env python3
"""Validate a bounded gzip tar stream before extracting a Next standalone build.

Only regular files and directories are accepted. Metadata, link targets and
archive permissions never become deployment authority. Destination must be new.
"""
import argparse
import gzip
from pathlib import Path, PurePosixPath
import shutil
import sys
import tarfile
import tempfile

MAX_BYTES = 512 * 1024 * 1024
MAX_MEMBERS = 50_000
REQUIRED_FILES = ('apps/website/server.js', 'apps/website/.next/BUILD_ID')


class ArchiveRejected(ValueError):
    pass


def bounded_copy(source, destination, limit):
    copied = 0
    while True:
        data = source.read(64 * 1024)
        if not data:
            return copied
        copied += len(data)
        if copied > limit:
            raise ArchiveRejected('stream exceeds byte limit')
        destination.write(data)


def member_path(member):
    name = member.name
    if name.startswith('./'):
        name = name[2:]
    if name in ('', '.'):
        if member.isdir():
            return '.'
        raise ArchiveRejected('root entry must be a directory')
    if name.endswith('/') and member.isdir():
        name = name[:-1]
    if name.startswith('/') or '\\' in name or '\x00' in name:
        raise ArchiveRejected('unsafe member path')
    parts = name.split('/')
    if any(part in ('', '.', '..') for part in parts):
        raise ArchiveRejected('noncanonical member path')
    if len(name.encode('utf-8')) > 4096:
        raise ArchiveRejected('member path too long')
    return name


def validate_members(tar, max_bytes, max_members):
    members = []
    seen = {}
    implicit_directories = set()
    total = 0
    for member in tar:
        if len(members) >= max_members:
            raise ArchiveRejected('too many archive members')
        if member.type not in (tarfile.REGTYPE, tarfile.AREGTYPE, tarfile.DIRTYPE) or member.issparse():
            raise ArchiveRejected('only regular files and directories are permitted')
        name = member_path(member)
        if name in seen:
            raise ArchiveRejected('duplicate member path')
        if member.size < 0 or (member.isdir() and member.size != 0):
            raise ArchiveRejected('invalid member size')
        total += member.size
        if total > max_bytes:
            raise ArchiveRejected('file contents exceed byte limit')
        if member.isfile() and name in implicit_directories:
            raise ArchiveRejected('file collides with an existing directory')
        for parent in PurePosixPath(name).parents:
            parent_name = str(parent)
            if seen.get(parent_name) == 'file':
                raise ArchiveRejected('file used as a parent directory')
            implicit_directories.add(parent_name)
        seen[name] = 'directory' if member.isdir() else 'file'
        members.append((member, name))
    for required in REQUIRED_FILES:
        if seen.get(required) != 'file':
            raise ArchiveRejected('required standalone build file missing')
    return members


def extract(source, destination, max_bytes=MAX_BYTES, max_members=MAX_MEMBERS):
    if destination.exists() or destination.is_symlink():
        raise ArchiveRejected('destination already exists')
    with tempfile.TemporaryFile() as compressed, tempfile.TemporaryFile() as expanded:
        bounded_copy(source, compressed, max_bytes)
        compressed.seek(0)
        with gzip.GzipFile(fileobj=compressed, mode='rb') as stream:
            size = bounded_copy(stream, expanded, max_bytes)
        # Requiring tar's terminator also rejects truncated headers/data.
        if size < 1024 or size % 512:
            raise ArchiveRejected('truncated tar stream')
        expanded.seek(-1024, 2)
        if expanded.read(1024) != b'\0' * 1024:
            raise ArchiveRejected('missing tar terminator')
        expanded.seek(0)
        with tarfile.open(fileobj=expanded, mode='r:') as tar:
            members = validate_members(tar, max_bytes, max_members)
            created = False
            try:
                destination.mkdir(mode=0o755)
                created = True
                for member, name in members:
                    if name == '.':
                        continue
                    target = destination / name
                    if member.isdir():
                        target.mkdir(mode=0o755, parents=True, exist_ok=True)
                        continue
                    target.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
                    with tar.extractfile(member) as content, target.open('xb') as output:
                        copied = bounded_copy(content, output, member.size)
                    if copied != member.size:
                        raise ArchiveRejected('truncated file contents')
                    target.chmod(0o755 if member.mode & 0o111 else 0o644)
            except BaseException:
                if created:
                    shutil.rmtree(destination)
                raise


def limited_integer(maximum):
    def parse(value):
        number = int(value)
        if not 0 < number <= maximum:
            raise argparse.ArgumentTypeError('limit must be positive and may only reduce the default')
        return number
    return parse


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination', type=Path)
    parser.add_argument('--max-bytes', type=limited_integer(MAX_BYTES), default=MAX_BYTES)
    parser.add_argument('--max-members', type=limited_integer(MAX_MEMBERS), default=MAX_MEMBERS)
    args = parser.parse_args()
    try:
        extract(sys.stdin.buffer, args.destination, args.max_bytes, args.max_members)
    except (ArchiveRejected, OSError, EOFError, tarfile.TarError, ValueError) as error:
        print(f'archive rejected: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
