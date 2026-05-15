#!/bin/bash
# Wrapper to run Node.js with glibc-2.35 on systems with older glibc.
# Usage: ./scripts/run_with_glibc.sh npm install
#    or: ./scripts/run_with_glibc.sh npm run dev
#    or: source scripts/run_with_glibc.sh  # then: npm run dev

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GLIBC_BUILD="${PAPERCHAMPION_GLIBC_BUILD:-${GLIBC_BUILD:-}}"
GCC_LIB="${PAPERCHAMPION_GCC_LIB:-${GCC_LIB:-}}"

if [ -z "$GLIBC_BUILD" ]; then
  echo "Set PAPERCHAMPION_GLIBC_BUILD to the glibc build directory." >&2
  exit 1
fi

# Find real node (exclude wrapper to avoid recursion)
PATH_NO_WRAPPER=$(echo "${PATH}" | tr ':' '\n' | grep -v "glibc_wrapper" | grep -v "node-glibc-wrapper" | tr '\n' ':' | sed 's/:$//')
NODE_BIN="${PAPERCHAMPION_NODE_BIN:-}"
if [ -z "$NODE_BIN" ]; then
  NODE_BIN=$(PATH="$PATH_NO_WRAPPER" command -v node 2>/dev/null | xargs dirname 2>/dev/null)
fi
if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN/node" ] || file "$NODE_BIN/node" 2>/dev/null | grep -q "script"; then
  for candidate in "${CONDA_PREFIX}/bin" "${HOME}/.nvm/versions/node/v22.22.0/bin"; do
    if [ -x "${candidate}/node" ] && file "${candidate}/node" 2>/dev/null | grep -q ELF; then
      NODE_BIN="${candidate}"
      break
    fi
  done
fi
if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN/node" ]; then
  echo "Unable to find a usable Node.js binary. Set PAPERCHAMPION_NODE_BIN if needed." >&2
  exit 1
fi

LD_SO="${GLIBC_BUILD}/elf/ld.so"
[ ! -f "$LD_SO" ] && LD_SO="${GLIBC_BUILD}/elf/ld-linux-x86-64.so.2"
if [ ! -f "$LD_SO" ]; then
  echo "Unable to find the glibc dynamic loader under PAPERCHAMPION_GLIBC_BUILD." >&2
  exit 1
fi

LIB_PATH="${GLIBC_BUILD}:${GLIBC_BUILD}/math:${GLIBC_BUILD}/nptl:${GLIBC_BUILD}/rt:${GLIBC_BUILD}/dlfcn"
if [ -n "$GCC_LIB" ]; then
  LIB_PATH="${LIB_PATH}:${GCC_LIB}"
fi

WRAPPER_DIR="${PROJECT_ROOT}/.glibc_wrapper"
mkdir -p "$WRAPPER_DIR"
NODE_WRAPPER="${WRAPPER_DIR}/node"
cat > "$NODE_WRAPPER" << WRAPPER_EOF
#!/bin/bash
exec ${LD_SO} --library-path "${LIB_PATH}" ${NODE_BIN}/node "\$@"
WRAPPER_EOF
chmod +x "$NODE_WRAPPER"

export PATH="${WRAPPER_DIR}:${NODE_BIN}:${PATH}"

if [ $# -eq 0 ]; then
  echo "Node/npm environment ready (glibc-2.35). Run: npm install, npm run dev"
else
  exec "$@"
fi
