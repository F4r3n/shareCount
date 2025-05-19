#!/bin/bash
if ! command -v wasm-pack &> /dev/null; then
  echo "wasm-pack not found. Installing..."
  cargo install wasm-pack
else
  echo "wasm-pack already installed"
fi

wasm-pack build ./wasm-lib --target web
