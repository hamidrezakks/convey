"""Build and import the real wheel in an isolated consumer; no provider requests."""
import hashlib
import json
import pathlib
import subprocess
import tempfile
import venv

ROOT = pathlib.Path(__file__).resolve().parents[2]


def run(*args, cwd):
    subprocess.run(args, cwd=cwd, check=True)


with tempfile.TemporaryDirectory(prefix="convey-wheel-consumer-") as directory:
    temp = pathlib.Path(directory)
    build_env = temp / "builder"
    consumer_env = temp / "consumer"
    venv.EnvBuilder(with_pip=True).create(build_env)
    venv.EnvBuilder(with_pip=True).create(consumer_env)
    builder = str(build_env / "bin/python")
    consumer = str(consumer_env / "bin/python")
    run(builder, "-m", "pip", "install", "build==1.2.2.post1", "hatchling==1.27.0", cwd=temp)
    run(builder, "-m", "build", "--wheel", "--no-isolation", "--outdir", str(temp / "dist"), str(ROOT / "packages/sdk-py"), cwd=temp)
    wheel, = (temp / "dist").glob("*.whl")
    run(consumer, "-m", "pip", "install", "--no-deps", "--no-index", str(wheel), cwd=temp)
    run(consumer, "-I", "-c", "from convey import Convey, AsyncConvey; import convey; assert 'site-packages' in convey.__file__; assert callable(Convey); assert callable(AsyncConvey)", cwd=temp)
    print(json.dumps({"mode": "mock-only", "wheel": wheel.name, "sha256": hashlib.sha256(wheel.read_bytes()).hexdigest(), "result": "isolated installed wheel imports successfully"}))
