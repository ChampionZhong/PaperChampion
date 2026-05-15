#!/bin/bash
# Fix esbuild binaries to run with glibc-2.35 on systems with older glibc.
# Run after: ./scripts/run_with_glibc.sh npm install
# Usage: ./scripts/fix-esbuild-glibc.sh

set -e

GLIBC_BUILD="${PAPERCHAMPION_GLIBC_BUILD:-${GLIBC_BUILD:-}}"
GCC_LIB="${PAPERCHAMPION_GCC_LIB:-${GCC_LIB:-}}"

if [ -z "$GLIBC_BUILD" ]; then
  echo "Set PAPERCHAMPION_GLIBC_BUILD to the glibc build directory." >&2
  exit 1
fi

GLIBC_LD="${PAPERCHAMPION_GLIBC_LD:-${GLIBC_BUILD}/elf/ld.so}"
[ ! -f "$GLIBC_LD" ] && GLIBC_LD="${GLIBC_BUILD}/elf/ld-linux-x86-64.so.2"
if [ ! -f "$GLIBC_LD" ]; then
  echo "Unable to find the glibc dynamic loader under PAPERCHAMPION_GLIBC_BUILD." >&2
  exit 1
fi

LIB_PATH="${GLIBC_BUILD}:${GLIBC_BUILD}/math:${GLIBC_BUILD}/nptl:${GLIBC_BUILD}/rt:${GLIBC_BUILD}/dlfcn"
if [ -n "$GCC_LIB" ]; then
  LIB_PATH="${LIB_PATH}:${GCC_LIB}"
fi

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="${PROJECT_ROOT}/frontend"

count=0

for search_root in "$FRONTEND" "$PROJECT_ROOT"; do
  [ ! -d "$search_root/node_modules" ] && continue
  while IFS= read -r -d '' bin_path; do
    real_bin=$(readlink -f "$bin_path" 2>/dev/null || true)
    [ -z "$real_bin" ] && real_bin="$bin_path"
    [ ! -f "$real_bin" ] && continue
    # Skip if already a wrapper script
    head -1 "$real_bin" 2>/dev/null | grep -q "#!/bin/bash" && head -2 "$real_bin" 2>/dev/null | grep -q "ld.so" && continue
    # If bin_path is the actual binary (not symlink), move it aside first
    if [ -f "$bin_path" ] && [ ! -L "$bin_path" ]; then
      mv "$bin_path" "${bin_path}.real"
      real_bin="${bin_path}.real"
    else
      rm -f "$bin_path"
    fi
    cat > "$bin_path" << WRAPPER
#!/bin/bash
exec $GLIBC_LD --library-path "$LIB_PATH" $real_bin "\$@"
WRAPPER
    chmod +x "$bin_path"
    ((count++)) || true
    echo "Fixed: $bin_path"
  done < <(find "$search_root/node_modules" -path "*/bin/esbuild" ! -path "*.real" \( -type f -o -type l \) -print0 2>/dev/null)
  # Also fix @esbuild/linux-x64 (exclude .real backups)
  while IFS= read -r -d '' bin_path; do
    [[ "$bin_path" == *.real ]] && continue
    real_bin=$(readlink -f "$bin_path" 2>/dev/null || true)
    [ -z "$real_bin" ] && real_bin="$bin_path"
    [ ! -f "$real_bin" ] && continue
    head -1 "$real_bin" 2>/dev/null | grep -q "#!/bin/bash" && head -2 "$real_bin" 2>/dev/null | grep -q "ld.so" && continue
    if [ -f "$bin_path" ] && [ ! -L "$bin_path" ]; then
      mv "$bin_path" "${bin_path}.real"
      real_bin="${bin_path}.real"
    else
      rm -f "$bin_path"
    fi
    cat > "$bin_path" << WRAPPER
#!/bin/bash
exec $GLIBC_LD --library-path "$LIB_PATH" $real_bin "\$@"
WRAPPER
    chmod +x "$bin_path"
    ((count++)) || true
    echo "Fixed: $bin_path"
  done < <(find "$search_root/node_modules" -path "*@esbuild/linux-x64/bin/*" ! -path "*.real" \( -type f -o -type l \) -print0 2>/dev/null)
done

echo "Fixed $count esbuild binary(ies)."
